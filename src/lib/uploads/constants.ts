// Keep this null to avoid an app-side cap. Supabase may still enforce the
// project's global Storage object-size limit.
export const SUBMISSION_UPLOAD_LIMIT_BYTES: number | null = null;
export const SUBMISSION_UPLOAD_LIMIT_LABEL: string | null = null;

// A null bucket value means "no per-bucket limit" in Supabase Storage.
export const SUBMISSION_STORAGE_FILE_SIZE_LIMIT_BYTES: number | null = null;

export function exceedsSubmissionUploadLimit(totalBytes: number): boolean {
  return (
    typeof SUBMISSION_UPLOAD_LIMIT_BYTES === "number" &&
    totalBytes > SUBMISSION_UPLOAD_LIMIT_BYTES
  );
}
