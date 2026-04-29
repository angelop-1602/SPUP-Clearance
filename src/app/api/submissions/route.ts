import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

import { SubmissionInsert } from "@/lib/submissions/records";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  SUBMISSION_UPLOAD_LIMIT_BYTES,
  SUBMISSION_UPLOAD_LIMIT_LABEL,
} from "@/lib/uploads/constants";
import { StudentFormData } from "@/types";
import { generateDocumentId } from "@/utils/documentId";
import { isNotApplicableResearchType, normalizeResearchType } from "@/utils/researchType";

const SUBMISSION_BUCKET_OPTIONS = {
  public: false,
  fileSizeLimit: SUBMISSION_UPLOAD_LIMIT_BYTES,
} as const;

function addDuplicateSuffix(fileName: string, sequence: number): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) return `${fileName} (${sequence})`;

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

function sanitizeStorageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9\s_-]/g, "").trim().replace(/\s+/g, "_") || "student";
}

function getRequiredString(payload: Record<string, unknown>, key: keyof StudentFormData): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

async function ensureSubmissionBucket() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(error.message);
  }

  const hasBucket = data.some((bucket) => bucket.id === SUBMISSION_FILES_BUCKET);
  if (hasBucket) {
    const { error: updateError } = await supabase.storage.updateBucket(
      SUBMISSION_FILES_BUCKET,
      SUBMISSION_BUCKET_OPTIONS
    );

    if (updateError) {
      throw new Error(updateError.message);
    }

    return;
  }

  const { error: createError } = await supabase.storage.createBucket(
    SUBMISSION_FILES_BUCKET,
    SUBMISSION_BUCKET_OPTIONS
  );

  if (createError) {
    throw new Error(createError.message);
  }
}

async function buildArchive(files: File[]): Promise<{
  fileList: string[];
  archive: Uint8Array | null;
}> {
  if (files.length === 0) {
    return { fileList: [], archive: null };
  }

  const zip = new JSZip();
  const fileList: string[] = [];
  const usedNames = new Set<string>();

  await Promise.all(
    files.map(async (file) => {
      const uniqueFileName = getUniqueZipFileName(file.name, usedNames);
      fileList.push(uniqueFileName);
      zip.file(uniqueFileName, await file.arrayBuffer());
    })
  );

  return {
    fileList,
    archive: await zip.generateAsync({ type: "uint8array" }),
  };
}

function getTotalFileSize(files: File[]) {
  return files.reduce((total, file) => total + file.size, 0);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payloadValue = formData.get("payload");

    if (typeof payloadValue !== "string") {
      return NextResponse.json({ error: "Missing submission payload" }, { status: 400 });
    }

    const payload = JSON.parse(payloadValue) as Record<string, unknown>;
    const level = payload.level === "undergrad" || payload.level === "grad"
      ? payload.level
      : null;
    const researchType = normalizeResearchType(
      typeof payload.researchType === "string" ? payload.researchType : "Thesis"
    );

    if (!level) {
      return NextResponse.json({ error: "Invalid academic level" }, { status: 400 });
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
      return NextResponse.json({ error: "Missing required submission fields" }, { status: 400 });
    }

    if (!isNotApplicableResearchType(researchType) && (!adviser || !researchTitle)) {
      return NextResponse.json({ error: "Missing required research details" }, { status: 400 });
    }

    const files = formData
      .getAll("files")
      .filter((file): file is File => file instanceof File && file.size > 0);
    const requiresFiles =
      researchType !== "Capstone" && !isNotApplicableResearchType(researchType);

    if (requiresFiles && files.length === 0) {
      return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
    }

    if (getTotalFileSize(files) > SUBMISSION_UPLOAD_LIMIT_BYTES) {
      return NextResponse.json(
        { error: `Files exceed the ${SUBMISSION_UPLOAD_LIMIT_LABEL} upload limit.` },
        { status: 400 }
      );
    }

    const documentId = generateDocumentId();
    const { fileList, archive } = await buildArchive(files);
    let zipPath: string | null = null;

    if (archive) {
      if (archive.byteLength > SUBMISSION_UPLOAD_LIMIT_BYTES) {
        return NextResponse.json(
          { error: `The zipped submission exceeds the ${SUBMISSION_UPLOAD_LIMIT_LABEL} upload limit.` },
          { status: 400 }
        );
      }

      await ensureSubmissionBucket();

      const sanitizedName = sanitizeStorageSegment(name);
      zipPath = `submissions/${documentId}/${sanitizedName}_${documentId}.zip`;
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
      if (zipPath) {
        await supabase.storage.from(SUBMISSION_FILES_BUCKET).remove([zipPath]);
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ documentId });
  } catch (error) {
    console.error("Submission API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit clearance request" },
      { status: 500 }
    );
  }
}
