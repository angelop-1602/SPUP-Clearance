"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";
import { buildSubmissionArchive } from "@/lib/uploads/archive";
import {
  AdminUser,
  CoordinatorSubmission,
  FilterOptions,
  Student,
  StudentFormData,
} from "@/types";
import {
  isNotApplicableResearchType,
  normalizeResearchType,
} from "@/utils/researchType";
import { UndergradParticipantKey } from "@/utils/undergradClearance";

type ApiStudent = Omit<Student, "submittedAt" | "updatedAt" | "exportedAt"> & {
  submittedAt: string;
  updatedAt?: string | null;
  exportedAt?: string | null;
};

type ApiCoordinatorSubmission = Omit<CoordinatorSubmission, "submittedAt"> & {
  submittedAt: string;
};

function normalizeDate(value: string | Date | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeStudent(value: ApiStudent): Student {
  return {
    ...value,
    researchType: normalizeResearchType(value.researchType),
    submittedAt: normalizeDate(value.submittedAt) ?? new Date(),
    updatedAt: normalizeDate(value.updatedAt),
    exportedAt: normalizeDate(value.exportedAt),
    exportLink: value.exportLink || undefined,
    zipFile: value.zipFile || undefined,
    zipPath: value.zipPath || undefined,
  };
}

function normalizeCoordinatorSubmission(
  value: ApiCoordinatorSubmission
): CoordinatorSubmission {
  return {
    ...value,
    submittedAt: normalizeDate(value.submittedAt) ?? new Date(),
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload.error === "string" ? payload.error : "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

function toSubmissionPayload(formData: StudentFormData) {
  return {
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
    groupMembers: formData.groupMembers,
  };
}

function getSubmissionFiles(formData: StudentFormData): File[] {
  if (formData.uploadedFiles.length > 0) {
    return formData.uploadedFiles;
  }

  if (!formData.documents) return [];

  return Object.values(formData.documents).filter(
    (file): file is File => file instanceof File
  );
}

type SubmissionUploadUrlResponse = {
  documentId: string;
  zipPath: string;
  token: string;
};

async function uploadSubmissionArchive(name: string, files: File[]) {
  const { fileList, archive } = await buildSubmissionArchive(files);

  if (!archive) return null;

  const upload = await readJsonResponse<SubmissionUploadUrlResponse>(
    await fetch("/api/submissions/upload-url/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(SUBMISSION_FILES_BUCKET)
    .uploadToSignedUrl(upload.zipPath, upload.token, archive, {
      contentType: "application/zip",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    documentId: upload.documentId,
    zipPath: upload.zipPath,
    fileList,
    archiveSize: archive.size,
  };
}

export async function submitStudentClearance(
  formData: StudentFormData
): Promise<string> {
  const submissionPayload = toSubmissionPayload(formData);
  const upload = await uploadSubmissionArchive(formData.name, getSubmissionFiles(formData));

  const responsePayload = await readJsonResponse<{ documentId: string }>(
    await fetch("/api/submissions/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: submissionPayload, upload }),
    })
  );

  return responsePayload.documentId;
}

export async function getSubmissionById(
  submissionId: string
): Promise<Student | null> {
  const payload = await readJsonResponse<{ submission: ApiStudent | null }>(
    await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/tracking`, {
      cache: "no-store",
    })
  );

  return payload.submission ? normalizeStudent(payload.submission) : null;
}

export async function searchCoordinatorSubmissions(
  searchTerm: string
): Promise<CoordinatorSubmission[]> {
  if (!searchTerm.trim()) return [];

  const payload = await readJsonResponse<{
    submissions: ApiCoordinatorSubmission[];
  }>(
    await fetch(
      `/api/coordinator-lookup?search=${encodeURIComponent(searchTerm.trim())}`,
      { cache: "no-store" }
    )
  );

  return payload.submissions.map(normalizeCoordinatorSubmission);
}

function applyFilters(submissions: Student[], filters?: FilterOptions): Student[] {
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

export async function getAllSubmissions(
  filters?: FilterOptions
): Promise<Student[]> {
  const payload = await readJsonResponse<{ submissions: ApiStudent[] }>(
    await fetch("/api/admin/submissions", { cache: "no-store" })
  );

  return applyFilters(payload.submissions.map(normalizeStudent), filters);
}

export function subscribeToSubmissions(
  callback: (submissions: Student[]) => void
): () => void {
  let isDisposed = false;
  const supabase = createSupabaseBrowserClient();

  const emit = async () => {
    try {
      const submissions = await getAllSubmissions();
      if (!isDisposed) {
        callback(submissions);
      }
    } catch (error) {
      console.error("Failed to load admin submissions:", error);
      if (!isDisposed) {
        callback([]);
      }
    }
  };

  void emit();

  const channel = supabase
    .channel("admin-submissions")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "submissions" },
      () => {
        void emit();
      }
    )
    .subscribe();

  return () => {
    isDisposed = true;
    void supabase.removeChannel(channel);
  };
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: "Submitted" | "Cleared"
): Promise<void> {
  await readJsonResponse<{ submission: ApiStudent }>(
    await fetch(`/api/admin/submissions/${encodeURIComponent(submissionId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
  );
}

export async function updateSubmissionDetails(
  submissionId: string,
  updates: Partial<Student>
): Promise<void> {
  await readJsonResponse<{ submission: ApiStudent }>(
    await fetch(`/api/admin/submissions/${encodeURIComponent(submissionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
  );
}

export async function updateUndergradParticipantClearance(
  submissionId: string,
  participantKey: UndergradParticipantKey,
  isCleared: boolean
): Promise<void> {
  await readJsonResponse<{ submission: ApiStudent }>(
    await fetch(
      `/api/admin/submissions/${encodeURIComponent(submissionId)}/participants`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantKey, isCleared }),
      }
    )
  );
}

export async function setUndergradAllClear(
  submissionId: string,
  isCleared: boolean = true
): Promise<void> {
  await readJsonResponse<{ submission: ApiStudent }>(
    await fetch(
      `/api/admin/submissions/${encodeURIComponent(submissionId)}/participants`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, isCleared }),
      }
    )
  );
}

async function getAdminUserFromServer(): Promise<AdminUser | null> {
  const response = await fetch("/api/admin/me/", { cache: "no-store" });
  if (response.status === 401 || response.status === 403) {
    return null;
  }

  const payload = await readJsonResponse<{ user: AdminUser }>(response);
  return payload.user;
}

export async function adminLogin(
  email: string,
  password: string
): Promise<AdminUser> {
  const supabase = createSupabaseBrowserClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const user = await getAdminUserFromServer();
  if (!user) {
    await supabase.auth.signOut();
    throw new Error("This account is not authorized for admin access");
  }

  return user;
}

export async function adminLogout(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export function onAuthStateChange(callback: (user: AdminUser | null) => void) {
  let isDisposed = false;
  const supabase = createSupabaseBrowserClient();

  const emit = async () => {
    try {
      const user = await getAdminUserFromServer();
      if (!isDisposed) callback(user);
    } catch {
      if (!isDisposed) callback(null);
    }
  };

  void emit();

  const { data } = supabase.auth.onAuthStateChange(() => {
    void emit();
  });

  return () => {
    isDisposed = true;
    data.subscription.unsubscribe();
  };
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  return getAdminUserFromServer();
}

export async function markSubmissionAsExported(
  submissionId: string,
  deleteFromStorage: boolean = true
): Promise<void> {
  await readJsonResponse<{ submission: ApiStudent }>(
    await fetch(`/api/admin/submissions/${encodeURIComponent(submissionId)}/export`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteFromStorage }),
    })
  );
}

export async function bulkMarkAsExported(
  submissionIds: string[],
  deleteFromStorage: boolean = true
): Promise<{ success: string[]; failed: string[] }> {
  const results: { success: string[]; failed: string[] } = {
    success: [],
    failed: [],
  };

  for (const id of submissionIds) {
    try {
      await markSubmissionAsExported(id, deleteFromStorage);
      results.success.push(id);
    } catch (error) {
      console.error(`Failed to mark ${id} as exported:`, error);
      results.failed.push(id);
    }
  }

  return results;
}

export async function getSubmissionsForExport(): Promise<Student[]> {
  const submissions = await getAllSubmissions();
  return submissions.filter(
    (submission) => submission.status === "Cleared" && !submission.isExported
  );
}

export async function clearSubmissionExportLink(
  submissionId: string
): Promise<void> {
  await readJsonResponse<{ submission: ApiStudent }>(
    await fetch(
      `/api/admin/submissions/${encodeURIComponent(submissionId)}/export-link`,
      { method: "DELETE" }
    )
  );
}

export async function setSubmissionExportLink(
  submissionId: string,
  exportLink: string
): Promise<void> {
  await readJsonResponse<{ submission: ApiStudent }>(
    await fetch(
      `/api/admin/submissions/${encodeURIComponent(submissionId)}/export-link`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportLink }),
      }
    )
  );
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  await readJsonResponse<{ ok: true }>(
    await fetch(`/api/admin/submissions/${encodeURIComponent(submissionId)}`, {
      method: "DELETE",
    })
  );
}

export async function getSubmissionDownloadUrl(submissionId: string): Promise<string> {
  const payload = await readJsonResponse<{ url: string }>(
    await fetch(
      `/api/admin/submissions/${encodeURIComponent(submissionId)}/signed-url`,
      { method: "POST" }
    )
  );

  return payload.url;
}
