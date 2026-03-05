import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  Timestamp,
  deleteField 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import JSZip from 'jszip';

import { db, storage, auth } from '@/lib/firebase';
import { Student, StudentFormData, FilterOptions } from '@/types';
import { generateDocumentId } from '@/utils/documentId';
import {
  isNotApplicableResearchType,
  normalizeResearchType,
} from '@/utils/researchType';
import {
  UndergradParticipantKey,
  setUndergradAllParticipantsState,
  updateUndergradParticipantState,
} from '@/utils/undergradClearance';

type LegacyDocumentKey = keyof NonNullable<StudentFormData["documents"]>;

function addDuplicateSuffix(fileName: string, sequence: number): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return `${fileName} (${sequence})`;
  }

  const base = fileName.slice(0, dotIndex);
  const extension = fileName.slice(dotIndex);
  return `${base} (${sequence})${extension}`;
}

function getUniqueZipFileName(fileName: string, usedNames: Set<string>): string {
  const safeName = fileName.trim() || 'file';
  let candidate = safeName;
  let sequence = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = addDuplicateSuffix(safeName, sequence);
    sequence += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function getLegacyZipFileName(key: LegacyDocumentKey, file: File): string {
  const fileExtension = file.name.includes('.')
    ? file.name.split('.').pop() ?? ''
    : '';
  const extensionSuffix = fileExtension ? `.${fileExtension}` : '';

  switch (key) {
    case 'approvalSheet':
      return `approval_sheet${extensionSuffix}`;
    case 'fullPaper':
      return `full_paper${extensionSuffix}`;
    case 'longAbstract':
      return `long_abstract${extensionSuffix}`;
    case 'journalFormat':
      return `journal_format${extensionSuffix}`;
    case 'graduationPicture':
      return `graduation_picture${extensionSuffix}`;
    default:
      return `${key}${extensionSuffix}`;
  }
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const timestampLike = value as { toDate?: () => Date };
    return timestampLike.toDate?.();
  }
  return undefined;
}

function mapSubmissionData(submissionId: string, data: Record<string, unknown>): Student {
  const baseData = data as unknown as Student;
  const normalizedResearchType = normalizeResearchType(
    (data.researchType as string | undefined) ?? 'Thesis'
  );
  return {
    ...baseData,
    id: submissionId,
    researchType: normalizedResearchType,
    submittedAt: toDate(data.submittedAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt),
    exportedAt: toDate(data.exportedAt),
    exportLink: (data.exportLink as string | undefined) || undefined,
  };
}

/**
 * Submit a new student clearance request
 */
export async function submitStudentClearance(formData: StudentFormData): Promise<string> {
  try {
    // Generate unique document ID
    const documentId = generateDocumentId();
    
    // Create ZIP file containing all documents
    const zip = new JSZip();
    const fileList: string[] = [];

    const uploadedFiles = formData.uploadedFiles ?? [];
    const legacyDocuments = formData.documents;
    const hasLegacyFiles = Boolean(
      legacyDocuments &&
      Object.values(legacyDocuments).some((file) => Boolean(file))
    );
    const requiresFiles =
      formData.researchType !== 'Capstone' &&
      !isNotApplicableResearchType(formData.researchType);

    if (requiresFiles && uploadedFiles.length === 0 && !hasLegacyFiles) {
      throw new Error('At least one file is required for submission.');
    }

    if (uploadedFiles.length > 0) {
      const usedNames = new Set<string>();
      const uploadPromises = uploadedFiles.map(async (file) => {
        const uniqueFileName = getUniqueZipFileName(file.name, usedNames);
        fileList.push(uniqueFileName);
        const arrayBuffer = await file.arrayBuffer();
        zip.file(uniqueFileName, arrayBuffer);
      });
      await Promise.all(uploadPromises);
    } else if (legacyDocuments) {
      const legacyPromises = Object.entries(legacyDocuments).map(
        async ([key, file]) => {
          if (!file) return;

          const legacyFileName = getLegacyZipFileName(
            key as LegacyDocumentKey,
            file
          );
          fileList.push(legacyFileName);
          const arrayBuffer = await file.arrayBuffer();
          zip.file(legacyFileName, arrayBuffer);
        }
      );
      await Promise.all(legacyPromises);
    }

    // Generate ZIP file as blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Upload ZIP file to Firebase Storage using student's full name
    const sanitizedName = formData.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const zipFileName = `${sanitizedName}_${documentId}.zip`;
    const zipRef = ref(storage, `submissions/${zipFileName}`);
    const uploadResult = await uploadBytes(zipRef, zipBlob);
    const zipDownloadURL = await getDownloadURL(uploadResult.ref);

    // Prepare submission data (exclude undefined fields for Firebase)
    const submissionData: Record<string, unknown> = {
      id: documentId,
      level: formData.level,
      name: formData.name,
      email: formData.email,
      studentId: formData.studentId,
      adviser: formData.adviser,
      course: formData.course,
      graduationMonth: formData.graduationMonth,
      graduationYear: formData.graduationYear,
      researchTitle: formData.researchTitle,
      researchType: normalizeResearchType(formData.researchType),
      fileList,
      zipFile: zipDownloadURL,
      status: 'Submitted',
      submittedAt: Timestamp.fromDate(new Date()),
    };

    // Only include groupMembers if it exists and has at least one non-empty field (for undergrad).
    // This keeps members visible even when student ID is not provided.
    if (formData.level === 'undergrad' && formData.groupMembers && formData.groupMembers.length > 0) {
      const validGroupMembers = formData.groupMembers
        .map((member) => ({
          ...member,
          name: member.name.trim(),
          studentID: member.studentID.trim(),
        }))
        .filter((member) => member.name || member.studentID);

      if (validGroupMembers.length > 0) {
        submissionData.groupMembers = validGroupMembers;
      }
    }

    // Use setDoc with custom document ID instead of addDoc
    const docRef = doc(db, 'submissions', documentId);
    await setDoc(docRef, submissionData);

    return documentId;
  } catch (error) {
    console.error('Error submitting clearance:', error);
    throw new Error('Failed to submit clearance request. Please try again.');
  }
}

/**
 * Get a specific submission by ID (public tracking)
 */
export async function getSubmissionById(submissionId: string): Promise<Student | null> {
  try {
    const docRef = doc(db, 'submissions', submissionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as Record<string, unknown>;
      return mapSubmissionData(docSnap.id, data);
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching submission:', error);
    throw new Error('Failed to fetch submission details');
  }
}

/**
 * Get all submissions (admin only)
 */
export async function getAllSubmissions(filters?: FilterOptions): Promise<Student[]> {
  try {
    const q = collection(db, 'submissions');
    
    // Apply filters
    const constraints = [];
    
    if (filters?.researchType && filters.researchType !== 'all') {
      if (isNotApplicableResearchType(filters.researchType)) {
        constraints.push(where('researchType', 'in', ['Not Applicable', 'Non-Thesis']));
      } else {
        constraints.push(where('researchType', '==', filters.researchType));
      }
    }

    // Add ordering
    constraints.push(orderBy('submittedAt', 'desc'));

    const querySnapshot = await getDocs(query(q, ...constraints));
    
    let submissions = querySnapshot.docs.map((submissionDoc) => {
      const data = submissionDoc.data() as Record<string, unknown>;
      return mapSubmissionData(submissionDoc.id, data);
    });

    // Apply search filter if provided
    if (filters?.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      submissions = submissions.filter(submission =>
        submission.name.toLowerCase().includes(searchTerm) ||
        submission.studentId.toLowerCase().includes(searchTerm) ||
        submission.researchTitle.toLowerCase().includes(searchTerm) ||
        submission.email.toLowerCase().includes(searchTerm)
      );
    }

    return submissions;
  } catch (error) {
    console.error('Error fetching submissions:', error);
    throw new Error('Failed to fetch submissions');
  }
}

/**
 * Update submission status (admin only)
 */
export async function updateSubmissionStatus(
  submissionId: string, 
  status: 'Submitted' | 'Cleared'
): Promise<void> {
  try {
    const docRef = doc(db, 'submissions', submissionId);
    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating submission status:', error);
    throw new Error('Failed to update submission status');
  }
}

/**
 * Update submission details (admin only)
 */
export async function updateSubmissionDetails(
  submissionId: string, 
  updates: Partial<Student>
): Promise<void> {
  try {
    const docRef = doc(db, 'submissions', submissionId);
    
    // Remove undefined fields and add timestamp
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    await updateDoc(docRef, { 
      ...cleanUpdates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating submission details:', error);
    throw new Error('Failed to update submission details');
  }
}

/**
 * Update a single undergrad participant clearance state (leader or member).
 * Old records without clearance fields are supported via fallback derived from status.
 */
export async function updateUndergradParticipantClearance(
  submissionId: string,
  participantKey: UndergradParticipantKey,
  isCleared: boolean
): Promise<void> {
  try {
    const submissionRef = doc(db, 'submissions', submissionId);
    const submissionDoc = await getDoc(submissionRef);

    if (!submissionDoc.exists()) {
      throw new Error('Submission not found');
    }

    const mappedSubmission = mapSubmissionData(
      submissionDoc.id,
      submissionDoc.data() as Record<string, unknown>
    );

    if (mappedSubmission.level !== 'undergrad') {
      throw new Error('Participant clearance is only available for undergraduate submissions');
    }

    const nextClearanceState = updateUndergradParticipantState(
      mappedSubmission,
      participantKey,
      isCleared
    );

    await updateDoc(submissionRef, {
      leaderCleared: nextClearanceState.leaderCleared,
      groupMembers: nextClearanceState.groupMembers,
      status: nextClearanceState.status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating undergrad participant clearance:', error);
    throw new Error('Failed to update participant clearance');
  }
}

/**
 * Set clear state for all undergrad participants (leader + members).
 * Old records without clearance fields are supported via fallback derived from status.
 */
export async function setUndergradAllClear(
  submissionId: string,
  isCleared: boolean = true
): Promise<void> {
  try {
    const submissionRef = doc(db, 'submissions', submissionId);
    const submissionDoc = await getDoc(submissionRef);

    if (!submissionDoc.exists()) {
      throw new Error('Submission not found');
    }

    const mappedSubmission = mapSubmissionData(
      submissionDoc.id,
      submissionDoc.data() as Record<string, unknown>
    );

    if (mappedSubmission.level !== 'undergrad') {
      throw new Error('All clear is only available for undergraduate submissions');
    }

    const nextClearanceState = setUndergradAllParticipantsState(
      mappedSubmission,
      isCleared
    );

    await updateDoc(submissionRef, {
      leaderCleared: nextClearanceState.leaderCleared,
      groupMembers: nextClearanceState.groupMembers,
      status: nextClearanceState.status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error setting undergrad all clear state:', error);
    throw new Error('Failed to update all-clear state');
  }
}

/**
 * Admin login
 */
export async function adminLogin(email: string, password: string): Promise<User> {
  try {
    // Check if email is authorized
    if (email !== 'cprint@spup.edu.ph') {
      throw new Error('Unauthorized email address');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: unknown) {
    console.error('Error during admin login:', error);
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string; message?: string };
      if (firebaseError.code === 'auth/user-not-found') {
        throw new Error('Admin account not found');
      } else if (firebaseError.code === 'auth/wrong-password') {
        throw new Error('Invalid password');
      } else if (firebaseError.code === 'auth/invalid-email') {
        throw new Error('Invalid email format');
      }
    }
    if (error instanceof Error && error.message === 'Unauthorized email address') {
      throw error;
    }
    throw new Error('Login failed. Please try again.');
  }
}

/**
 * Admin logout
 */
export async function adminLogout(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error during logout:', error);
    throw new Error('Logout failed');
  }
}

/**
 * Monitor authentication state
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Mark submission as exported and optionally delete files from storage
 */
export async function markSubmissionAsExported(
  submissionId: string, 
  deleteFromStorage: boolean = true
): Promise<void> {
  try {
    const submissionRef = doc(db, 'submissions', submissionId);
    
    // Update submission metadata
    await updateDoc(submissionRef, {
      isExported: true,
      exportedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Optionally delete file from Firebase Storage
    if (deleteFromStorage) {
      try {
        // Get submission data to find the actual filename
        const submissionDoc = await getDoc(submissionRef);
        if (submissionDoc.exists()) {
          const data = submissionDoc.data();
          const studentName = data.name;
          const sanitizedName = studentName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
          const fileName = `${sanitizedName}_${submissionId}.zip`;
          const fileRef = ref(storage, `submissions/${fileName}`);
          await deleteObject(fileRef);
          console.log(`Deleted file: ${fileName}`);
        }
      } catch (error) {
        console.warn(`Failed to delete file for ${submissionId}:`, error);
        // Don't throw error if file deletion fails - metadata is still updated
      }
    }
  } catch (error) {
    console.error('Error marking submission as exported:', error);
    throw new Error('Failed to mark submission as exported');
  }
}

/**
 * Bulk mark submissions as exported
 */
export async function bulkMarkAsExported(
  submissionIds: string[], 
  deleteFromStorage: boolean = true
): Promise<{ success: string[], failed: string[] }> {
  const results: { success: string[], failed: string[] } = { success: [], failed: [] };
  
  for (const id of submissionIds) {
    try {
      await markSubmissionAsExported(id, deleteFromStorage);
      (results.success as string[]).push(id);
    } catch (error) {
      console.error(`Failed to mark ${id} as exported:`, error);
      (results.failed as string[]).push(id);
    }
  }
  
  return results;
}

/**
 * Get submissions ready for export (cleared but not exported)
 */
export async function getSubmissionsForExport(): Promise<Student[]> {
  try {
    // Simple query without orderBy to avoid composite index requirement
    const q = query(
      collection(db, 'submissions'),
      where('status', '==', 'Cleared')
    );
    
    const querySnapshot = await getDocs(q);
    const submissions: Student[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Only include submissions that haven't been exported
      if (!data.isExported) {
        submissions.push({
          id: doc.id,
          level: data.level,
          name: data.name,
          email: data.email,
          studentId: data.studentId,
          adviser: data.adviser,
          course: data.course,
          graduationMonth: data.graduationMonth || '',
          graduationYear: data.graduationYear || '',
          researchTitle: data.researchTitle,
          researchType: data.researchType,
          groupMembers: data.groupMembers,
          fileList: data.fileList,
          leaderCleared: data.leaderCleared,
          zipFile: data.zipFile,
          status: data.status,
          submittedAt: toDate(data.submittedAt) || new Date(),
          updatedAt: toDate(data.updatedAt),
          isExported: data.isExported || false,
          exportedAt: toDate(data.exportedAt),
          exportLink: data.exportLink || undefined
        });
      }
    });
    
    // Sort client-side by submission date (newest first)
    submissions.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    
    return submissions;
  } catch (error) {
    console.error('Error fetching submissions for export:', error);
    throw new Error('Failed to fetch submissions for export');
  }
} 

/**
 * Clear the custom export link for a submission
 */
export async function clearSubmissionExportLink(submissionId: string): Promise<void> {
  try {
    const submissionRef = doc(db, 'submissions', submissionId);
    await updateDoc(submissionRef, {
      exportLink: deleteField(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error clearing export link:', error);
    throw new Error('Failed to clear export link');
  }
}

/**
 * Set or update a custom export link for a submission
 */
export async function setSubmissionExportLink(submissionId: string, exportLink: string): Promise<void> {
  try {
    const submissionRef = doc(db, 'submissions', submissionId);
    await updateDoc(submissionRef, {
      exportLink,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error setting export link:', error);
    throw new Error('Failed to set export link');
  }
}

/**
 * Delete a submission and its associated files (admin only)
 */
export async function deleteSubmission(submissionId: string): Promise<void> {
  try {
    // Get submission data to find the filename
    const submissionRef = doc(db, 'submissions', submissionId);
    const submissionDoc = await getDoc(submissionRef);
    
    if (!submissionDoc.exists()) {
      throw new Error('Submission not found');
    }
    
    const data = submissionDoc.data();
    
    // Delete file from Firebase Storage if it exists
    try {
      const studentName = data.name;
      const sanitizedName = studentName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const fileName = `${sanitizedName}_${submissionId}.zip`;
      const fileRef = ref(storage, `submissions/${fileName}`);
      await deleteObject(fileRef);
      console.log(`Deleted file: ${fileName}`);
    } catch (error) {
      console.warn(`Failed to delete file for ${submissionId}:`, error);
      // Continue with document deletion even if file deletion fails
    }
    
    // Delete the document from Firestore
    await deleteDoc(submissionRef);
  } catch (error) {
    console.error('Error deleting submission:', error);
    throw new Error('Failed to delete submission');
  }
}
