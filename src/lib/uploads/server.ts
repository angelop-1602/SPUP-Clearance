import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";
import { SUBMISSION_STORAGE_FILE_SIZE_LIMIT_BYTES } from "@/lib/uploads/constants";

const SUBMISSION_BUCKET_OPTIONS = {
  public: false,
  fileSizeLimit: SUBMISSION_STORAGE_FILE_SIZE_LIMIT_BYTES,
} as const;

export async function ensureSubmissionBucket() {
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

export async function submissionFileExists(path: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(SUBMISSION_FILES_BUCKET).exists(path);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
