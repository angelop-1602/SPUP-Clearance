import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
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

/**
 * Submit a new student clearance request
 */
export async function submitStudentClearance(formData: StudentFormData): Promise<string> {
  try {
    // Generate unique document ID
    const documentId = generateDocumentId();
    
    // Create ZIP file containing all documents
    const zip = new JSZip();
    
    if (formData.documents) {
      // Add each document to the ZIP with proper naming
      const documentPromises = Object.entries(formData.documents).map(async ([key, file]) => {
        if (file) {
          const fileExtension = file.name.split('.').pop();
          let fileName = '';
          
          // Use standardized file names in the ZIP
          switch (key) {
            case 'approvalSheet':
              fileName = `approval_sheet.${fileExtension}`;
              break;
            case 'fullPaper':
              fileName = `full_paper.${fileExtension}`;
              break;
            case 'longAbstract':
              fileName = `long_abstract.${fileExtension}`;
              break;
            case 'journalFormat':
              fileName = `journal_format.${fileExtension}`;
              break;
            default:
              fileName = `${key}.${fileExtension}`;
          }
          
          // Convert file to array buffer and add to ZIP
          const arrayBuffer = await file.arrayBuffer();
          zip.file(fileName, arrayBuffer);
        }
      });

      await Promise.all(documentPromises);
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
      researchType: formData.researchType,
      zipFile: zipDownloadURL,
      status: 'Submitted',
      submittedAt: Timestamp.fromDate(new Date()),
    };

    // Only include groupMembers if it exists and has valid data (for undergrad)
    if (formData.level === 'undergrad' && formData.groupMembers && formData.groupMembers.length > 0) {
      const validGroupMembers = formData.groupMembers.filter(
        member => member.name.trim() && member.studentID.trim()
      );
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
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        submittedAt: data.submittedAt?.toDate() || new Date(),
      } as Student;
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
    
    if (filters?.level && filters.level !== 'all') {
      constraints.push(where('level', '==', filters.level));
    }
    
    if (filters?.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }
    
    if (filters?.course) {
      constraints.push(where('course', '==', filters.course));
    }

    // Add ordering
    constraints.push(orderBy('submittedAt', 'desc'));

    const querySnapshot = await getDocs(query(q, ...constraints));
    
    let submissions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id, // This will now be our custom SPUP_Clearance_YYYY_ABC123 format
        submittedAt: data.submittedAt?.toDate() || new Date(),
        exportLink: data.exportLink || undefined,
      } as Student;
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
    await updateDoc(docRef, { status });
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
      Object.entries(updates).filter(([_, value]) => value !== undefined)
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
      exportedAt: Timestamp.now()
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
          zipFile: data.zipFile,
          status: data.status,
          submittedAt: data.submittedAt.toDate(),
          isExported: data.isExported || false,
          exportedAt: data.exportedAt?.toDate(),
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
    await updateDoc(submissionRef, { exportLink: deleteField() });
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
    await updateDoc(submissionRef, { exportLink });
  } catch (error) {
    console.error('Error setting export link:', error);
    throw new Error('Failed to set export link');
  }
}