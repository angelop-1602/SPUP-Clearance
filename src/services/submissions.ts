"use client";

import JSZip from "jszip";

import { AdminUser, FilterOptions, Student, StudentFormData } from "@/types";
import { generateDocumentId } from "@/utils/documentId";
import {
  isNotApplicableResearchType,
  normalizeResearchType,
} from "@/utils/researchType";
import {
  UndergradParticipantKey,
  setUndergradAllParticipantsState,
  updateUndergradParticipantState,
} from "@/utils/undergradClearance";

const SUBMISSIONS_STORAGE_KEY = "spup-clearance-submissions";
const ADMIN_USER_STORAGE_KEY = "spup-clearance-admin-user";
const SUBMISSIONS_EVENT = "spup-clearance-submissions-change";
const AUTH_EVENT = "spup-clearance-auth-change";

type LegacyDocumentKey = keyof NonNullable<StudentFormData["documents"]>;

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function addDuplicateSuffix(fileName: string, sequence: number): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${fileName} (${sequence})`;
  }

  const base = fileName.slice(0, dotIndex);
  const extension = fileName.slice(dotIndex);
  return `${base} (${sequence})${extension}`;
}

function getUniqueZipFileName(fileName: string, usedNames: Set<string>): string {
  const safeName = fileName.trim() || "file";
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
  const fileExtension = file.name.includes(".")
    ? file.name.split(".").pop() ?? ""
    : "";
  const extensionSuffix = fileExtension ? `.${fileExtension}` : "";

  switch (key) {
    case "approvalSheet":
      return `approval_sheet${extensionSuffix}`;
    case "fullPaper":
      return `full_paper${extensionSuffix}`;
    case "longAbstract":
      return `long_abstract${extensionSuffix}`;
    case "journalFormat":
      return `journal_format${extensionSuffix}`;
    case "graduationPicture":
      return `graduation_picture${extensionSuffix}`;
    default:
      return `${key}${extensionSuffix}`;
  }
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

function normalizeStoredSubmission(value: unknown): Student | null {
  if (!value || typeof value !== "object") return null;

  const submission = value as Student;
  if (!submission.id) return null;

  return {
    ...submission,
    researchType: normalizeResearchType(submission.researchType),
    submittedAt: toDate(submission.submittedAt) ?? new Date(),
    updatedAt: toDate(submission.updatedAt),
    exportedAt: toDate(submission.exportedAt),
    exportLink: submission.exportLink || undefined,
  };
}

function sortSubmissions(submissions: Student[]): Student[] {
  return [...submissions].sort(
    (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
  );
}

function readSubmissions(): Student[] {
  if (!canUseBrowserStorage()) return [];

  try {
    const rawValue = window.localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (!rawValue) return [];

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return sortSubmissions(
      parsedValue
        .map((submission) => normalizeStoredSubmission(submission))
        .filter((submission): submission is Student => Boolean(submission))
    );
  } catch (error) {
    console.error("Unable to read local submissions:", error);
    return [];
  }
}

function writeSubmissions(submissions: Student[]): void {
  if (!canUseBrowserStorage()) {
    throw new Error("Local browser storage is not available.");
  }

  window.localStorage.setItem(
    SUBMISSIONS_STORAGE_KEY,
    JSON.stringify(sortSubmissions(submissions))
  );
  window.dispatchEvent(new Event(SUBMISSIONS_EVENT));
}

function upsertSubmission(updatedSubmission: Student): void {
  const submissions = readSubmissions();
  const existingIndex = submissions.findIndex(
    (submission) => submission.id === updatedSubmission.id
  );

  if (existingIndex >= 0) {
    submissions[existingIndex] = updatedSubmission;
  } else {
    submissions.unshift(updatedSubmission);
  }

  writeSubmissions(submissions);
}

function getSubmissionOrThrow(submissionId: string): Student {
  const submission = readSubmissions().find((item) => item.id === submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  return submission;
}

async function buildSubmissionArchive(formData: StudentFormData): Promise<{
  fileList: string[];
  zipFile: string;
}> {
  const zip = new JSZip();
  const fileList: string[] = [];

  const uploadedFiles = formData.uploadedFiles ?? [];
  const legacyDocuments = formData.documents;
  const hasLegacyFiles = Boolean(
    legacyDocuments &&
      Object.values(legacyDocuments).some((file) => Boolean(file))
  );
  const requiresFiles =
    formData.researchType !== "Capstone" &&
    !isNotApplicableResearchType(formData.researchType);

  if (requiresFiles && uploadedFiles.length === 0 && !hasLegacyFiles) {
    throw new Error("At least one file is required for submission.");
  }

  if (uploadedFiles.length > 0) {
    const usedNames = new Set<string>();
    await Promise.all(
      uploadedFiles.map(async (file) => {
        const uniqueFileName = getUniqueZipFileName(file.name, usedNames);
        fileList.push(uniqueFileName);
        const arrayBuffer = await file.arrayBuffer();
        zip.file(uniqueFileName, arrayBuffer);
      })
    );
  } else if (legacyDocuments) {
    await Promise.all(
      Object.entries(legacyDocuments).map(async ([key, file]) => {
        if (!file) return;

        const legacyFileName = getLegacyZipFileName(
          key as LegacyDocumentKey,
          file
        );
        fileList.push(legacyFileName);
        const arrayBuffer = await file.arrayBuffer();
        zip.file(legacyFileName, arrayBuffer);
      })
    );
  }

  if (fileList.length === 0 || typeof URL === "undefined") {
    return { fileList, zipFile: "" };
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return {
    fileList,
    zipFile: URL.createObjectURL(zipBlob),
  };
}

function filterSubmissions(submissions: Student[], filters?: FilterOptions): Student[] {
  let filteredSubmissions = submissions;

  if (filters?.researchType && filters.researchType !== "all") {
    filteredSubmissions = filteredSubmissions.filter((submission) => {
      if (isNotApplicableResearchType(filters.researchType)) {
        return isNotApplicableResearchType(submission.researchType);
      }

      return submission.researchType === filters.researchType;
    });
  }

  if (filters?.searchTerm) {
    const searchTerm = filters.searchTerm.toLowerCase();
    filteredSubmissions = filteredSubmissions.filter(
      (submission) =>
        submission.name.toLowerCase().includes(searchTerm) ||
        submission.studentId.toLowerCase().includes(searchTerm) ||
        submission.researchTitle.toLowerCase().includes(searchTerm) ||
        submission.email.toLowerCase().includes(searchTerm)
    );
  }

  return filteredSubmissions;
}

function readAdminUser(): AdminUser | null {
  if (!canUseBrowserStorage()) return null;

  try {
    const rawValue = window.localStorage.getItem(ADMIN_USER_STORAGE_KEY);
    if (!rawValue) return null;

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") return null;

    const user = parsedValue as AdminUser;
    if (!user.email || !user.uid) return null;

    return user;
  } catch {
    return null;
  }
}

function writeAdminUser(user: AdminUser | null): void {
  if (!canUseBrowserStorage()) return;

  if (user) {
    window.localStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
  }

  window.dispatchEvent(new Event(AUTH_EVENT));
}

function createLocalUser(email: string): AdminUser {
  const normalizedEmail = email.trim().toLowerCase();
  const uid = `admin-${normalizedEmail.replace(/[^a-z0-9]/g, "-")}`;
  return {
    email: normalizedEmail,
    uid,
  };
}

export async function submitStudentClearance(
  formData: StudentFormData
): Promise<string> {
  const documentId = generateDocumentId();
  const { fileList, zipFile } = await buildSubmissionArchive(formData);

  const submission: Student = {
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
    zipFile,
    status: "Submitted",
    submittedAt: new Date(),
  };

  if (
    formData.level === "undergrad" &&
    formData.groupMembers &&
    formData.groupMembers.length > 0
  ) {
    const validGroupMembers = formData.groupMembers
      .map((member) => ({
        ...member,
        name: member.name.trim(),
        studentID: member.studentID.trim(),
      }))
      .filter((member) => member.name || member.studentID);

    if (validGroupMembers.length > 0) {
      submission.groupMembers = validGroupMembers;
    }
  }

  upsertSubmission(submission);
  return documentId;
}

export async function getSubmissionById(
  submissionId: string
): Promise<Student | null> {
  return (
    readSubmissions().find((submission) => submission.id === submissionId) ??
    null
  );
}

export async function getAllSubmissions(
  filters?: FilterOptions
): Promise<Student[]> {
  return filterSubmissions(readSubmissions(), filters);
}

export function subscribeToSubmissions(
  callback: (submissions: Student[]) => void
): () => void {
  let isDisposed = false;

  const emit = () => {
    if (!isDisposed) {
      callback(readSubmissions());
    }
  };

  emit();

  if (!canUseBrowserStorage()) {
    return () => {
      isDisposed = true;
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SUBMISSIONS_STORAGE_KEY) {
      emit();
    }
  };

  window.addEventListener(SUBMISSIONS_EVENT, emit);
  window.addEventListener("storage", handleStorage);

  return () => {
    isDisposed = true;
    window.removeEventListener(SUBMISSIONS_EVENT, emit);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: "Submitted" | "Cleared"
): Promise<void> {
  const submission = getSubmissionOrThrow(submissionId);
  upsertSubmission({
    ...submission,
    status,
    updatedAt: new Date(),
  });
}

export async function updateSubmissionDetails(
  submissionId: string,
  updates: Partial<Student>
): Promise<void> {
  const submission = getSubmissionOrThrow(submissionId);
  upsertSubmission({
    ...submission,
    ...updates,
    id: submission.id,
    updatedAt: new Date(),
  });
}

export async function updateUndergradParticipantClearance(
  submissionId: string,
  participantKey: UndergradParticipantKey,
  isCleared: boolean
): Promise<void> {
  const submission = getSubmissionOrThrow(submissionId);

  if (submission.level !== "undergrad") {
    throw new Error("Participant clearance is only available for undergraduate submissions");
  }

  const nextClearanceState = updateUndergradParticipantState(
    submission,
    participantKey,
    isCleared
  );

  upsertSubmission({
    ...submission,
    leaderCleared: nextClearanceState.leaderCleared,
    groupMembers: nextClearanceState.groupMembers,
    status: nextClearanceState.status,
    updatedAt: new Date(),
  });
}

export async function setUndergradAllClear(
  submissionId: string,
  isCleared: boolean = true
): Promise<void> {
  const submission = getSubmissionOrThrow(submissionId);

  if (submission.level !== "undergrad") {
    throw new Error("All clear is only available for undergraduate submissions");
  }

  const nextClearanceState = setUndergradAllParticipantsState(
    submission,
    isCleared
  );

  upsertSubmission({
    ...submission,
    leaderCleared: nextClearanceState.leaderCleared,
    groupMembers: nextClearanceState.groupMembers,
    status: nextClearanceState.status,
    updatedAt: new Date(),
  });
}

export async function adminLogin(
  email: string,
  password: string
): Promise<AdminUser> {
  if (!email.trim() || !password) {
    throw new Error("Email and password are required");
  }

  const user = createLocalUser(email);
  writeAdminUser(user);
  return user;
}

export async function adminLogout(): Promise<void> {
  writeAdminUser(null);
}

export function onAuthStateChange(callback: (user: AdminUser | null) => void) {
  let isDisposed = false;

  const emit = () => {
    if (!isDisposed) {
      callback(readAdminUser());
    }
  };

  emit();

  if (!canUseBrowserStorage()) {
    return () => {
      isDisposed = true;
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_USER_STORAGE_KEY) {
      emit();
    }
  };

  window.addEventListener(AUTH_EVENT, emit);
  window.addEventListener("storage", handleStorage);

  return () => {
    isDisposed = true;
    window.removeEventListener(AUTH_EVENT, emit);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getCurrentUser(): AdminUser | null {
  return readAdminUser();
}

export async function markSubmissionAsExported(
  submissionId: string,
  _removeFile: boolean = true
): Promise<void> {
  const submission = getSubmissionOrThrow(submissionId);
  upsertSubmission({
    ...submission,
    isExported: true,
    exportedAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function bulkMarkAsExported(
  submissionIds: string[],
  removeFile: boolean = true
): Promise<{ success: string[]; failed: string[] }> {
  const results: { success: string[]; failed: string[] } = {
    success: [],
    failed: [],
  };

  for (const id of submissionIds) {
    try {
      await markSubmissionAsExported(id, removeFile);
      results.success.push(id);
    } catch (error) {
      console.error(`Failed to mark ${id} as exported:`, error);
      results.failed.push(id);
    }
  }

  return results;
}

export async function getSubmissionsForExport(): Promise<Student[]> {
  return readSubmissions().filter(
    (submission) => submission.status === "Cleared" && !submission.isExported
  );
}

export async function clearSubmissionExportLink(
  submissionId: string
): Promise<void> {
  const submission = getSubmissionOrThrow(submissionId);
  const { exportLink: _exportLink, ...submissionWithoutLink } = submission;
  upsertSubmission({
    ...submissionWithoutLink,
    updatedAt: new Date(),
  });
}

export async function setSubmissionExportLink(
  submissionId: string,
  exportLink: string
): Promise<void> {
  const submission = getSubmissionOrThrow(submissionId);
  upsertSubmission({
    ...submission,
    exportLink,
    updatedAt: new Date(),
  });
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const submissions = readSubmissions();
  const nextSubmissions = submissions.filter(
    (submission) => submission.id !== submissionId
  );

  if (nextSubmissions.length === submissions.length) {
    throw new Error("Submission not found");
  }

  writeSubmissions(nextSubmissions);
}
