import { NextRequest, NextResponse } from "next/server";

import { SubmissionInsert } from "@/lib/submissions/records";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildSubmissionArchive } from "@/lib/uploads/archive";
import { ensureSubmissionBucket, submissionFileExists } from "@/lib/uploads/server";
import { buildSubmissionZipPath } from "@/lib/uploads/storage-paths";
import { StudentFormData } from "@/types";
import { generateDocumentId, validateDocumentId } from "@/utils/documentId";
import { isNotApplicableResearchType, normalizeResearchType } from "@/utils/researchType";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type SubmissionPayload = Record<string, unknown>;

type StoredArchive = {
  documentId: string;
  fileList: string[];
  zipPath: string | null;
  cleanupStorageOnFailure: boolean;
  verifyUpload: boolean;
};

function getRequiredString(payload: SubmissionPayload, key: keyof StudentFormData): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function getFileList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStoredArchive(value: unknown): StoredArchive | null {
  if (!value || typeof value !== "object") return null;

  const upload = value as Record<string, unknown>;
  const documentId = typeof upload.documentId === "string" ? upload.documentId.trim() : "";
  const zipPath = typeof upload.zipPath === "string" ? upload.zipPath.trim() : "";
  const fileList = getFileList(upload.fileList);

  if (!validateDocumentId(documentId)) {
    throw new ApiError(400, "Invalid uploaded submission ID.");
  }

  if (fileList.length > 0 && !zipPath) {
    throw new ApiError(400, "Missing uploaded ZIP path.");
  }

  if (zipPath && !zipPath.startsWith(`submissions/${documentId}/`)) {
    throw new ApiError(400, "Uploaded ZIP path does not match the submission ID.");
  }

  return {
    documentId,
    fileList,
    zipPath: zipPath || null,
    cleanupStorageOnFailure: Boolean(zipPath),
    verifyUpload: Boolean(zipPath),
  };
}

function getPayload(value: unknown): SubmissionPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Missing submission payload");
  }

  return value as SubmissionPayload;
}

async function removeStoredArchive(zipPath: string | null) {
  if (!zipPath) return;

  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(SUBMISSION_FILES_BUCKET).remove([zipPath]);
}

async function saveSubmission(payload: SubmissionPayload, archive: StoredArchive | null) {
  const level = payload.level === "undergrad" || payload.level === "grad" ? payload.level : null;
  const researchType = normalizeResearchType(
    typeof payload.researchType === "string" ? payload.researchType : "Thesis"
  );

  if (!level) {
    throw new ApiError(400, "Invalid academic level");
  }

  const name = getRequiredString(payload, "name");
  const email = getRequiredString(payload, "email");
  const studentId = getRequiredString(payload, "studentId");
  const course = getRequiredString(payload, "course");
  const graduationMonth = getRequiredString(payload, "graduationMonth");
  const graduationYear = getRequiredString(payload, "graduationYear");
  const adviser = getRequiredString(payload, "adviser");
  const researchTitle = getRequiredString(payload, "researchTitle");

  if (!name || !email || !studentId || !course || !graduationMonth || !graduationYear) {
    throw new ApiError(400, "Missing required submission fields");
  }

  if (!isNotApplicableResearchType(researchType) && (!adviser || !researchTitle)) {
    throw new ApiError(400, "Missing required research details");
  }

  const documentId = archive?.documentId ?? generateDocumentId();
  const fileList = archive?.fileList ?? [];
  const zipPath = archive?.zipPath ?? null;
  const requiresFiles = researchType !== "Capstone" && !isNotApplicableResearchType(researchType);

  if (requiresFiles && fileList.length === 0) {
    throw new ApiError(400, "At least one file is required.");
  }

  if (archive?.verifyUpload && zipPath && !(await submissionFileExists(zipPath))) {
    throw new ApiError(400, "Uploaded ZIP file was not found. Please upload again.");
  }

  const groupMembers = Array.isArray(payload.groupMembers)
    ? payload.groupMembers
        .map((member) => {
          if (!member || typeof member !== "object") {
            return null;
          }
          const item = member as { name?: unknown; studentID?: unknown };
          return {
            name: typeof item.name === "string" ? item.name.trim() : "",
            studentID: typeof item.studentID === "string" ? item.studentID.trim() : "",
          };
        })
        .filter((member): member is { name: string; studentID: string } =>
          Boolean(member && (member.name || member.studentID))
        )
    : [];

  const submission: SubmissionInsert = {
    id: documentId,
    level,
    name,
    email,
    student_id: studentId,
    adviser,
    course,
    graduation_month: graduationMonth,
    graduation_year: graduationYear,
    research_title: researchTitle,
    research_type: researchType,
    group_members: level === "undergrad" ? groupMembers : [],
    file_list: fileList,
    zip_path: zipPath,
    status: "Submitted",
    leader_cleared: level === "undergrad" ? false : null,
    is_exported: false,
    export_link: null,
    submitted_at: new Date().toISOString(),
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("submissions").insert(submission);

  if (error) {
    throw new Error(error.message);
  }

  return documentId;
}

async function handleJsonSubmission(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { payload?: unknown; upload?: unknown }
    | null;
  const payload = getPayload(body?.payload);
  const archive = getStoredArchive(body?.upload);

  try {
    const documentId = await saveSubmission(payload, archive);
    return NextResponse.json({ documentId });
  } catch (error) {
    if (archive?.cleanupStorageOnFailure) {
      await removeStoredArchive(archive.zipPath);
    }
    throw error;
  }
}

async function handleLegacyMultipartSubmission(request: NextRequest) {
  const formData = await request.formData();
  const payloadValue = formData.get("payload");

  if (typeof payloadValue !== "string") {
    throw new ApiError(400, "Missing submission payload");
  }

  const payload = getPayload(JSON.parse(payloadValue));
  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);
  const documentId = generateDocumentId();
  const { fileList, archive } = await buildSubmissionArchive(files);
  let zipPath: string | null = null;

  if (archive) {
    await ensureSubmissionBucket();

    const name = getRequiredString(payload, "name");
    zipPath = buildSubmissionZipPath(documentId, name);
    const supabase = createSupabaseAdminClient();
    const { error: uploadError } = await supabase.storage
      .from(SUBMISSION_FILES_BUCKET)
      .upload(zipPath, archive, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }
  }

  const storedArchive: StoredArchive = {
    documentId,
    fileList,
    zipPath,
    cleanupStorageOnFailure: Boolean(zipPath),
    verifyUpload: false,
  };

  try {
    const savedDocumentId = await saveSubmission(payload, storedArchive);
    return NextResponse.json({ documentId: savedDocumentId });
  } catch (error) {
    if (storedArchive.cleanupStorageOnFailure) {
      await removeStoredArchive(storedArchive.zipPath);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return await handleJsonSubmission(request);
    }

    return await handleLegacyMultipartSubmission(request);
  } catch (error) {
    console.error("Submission API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit clearance request" },
      { status: error instanceof ApiError ? error.status : 500 }
    );
  }
}
