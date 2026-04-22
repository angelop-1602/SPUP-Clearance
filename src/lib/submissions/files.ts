import "server-only";

import JSZip from "jszip";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";

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

export function sanitizeStorageSegment(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "student"
  );
}

export async function ensureSubmissionBucket() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(error.message);
  }

  const hasBucket = data.some((bucket) => bucket.id === SUBMISSION_FILES_BUCKET);
  if (hasBucket) return;

  const { error: createError } = await supabase.storage.createBucket(
    SUBMISSION_FILES_BUCKET,
    { public: false }
  );

  if (createError) {
    throw new Error(createError.message);
  }
}

export async function buildSubmissionArchive(files: File[]): Promise<{
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
