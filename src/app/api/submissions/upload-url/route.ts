import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";
import { ensureSubmissionBucket } from "@/lib/uploads/server";
import { buildSubmissionZipPath } from "@/lib/uploads/storage-paths";
import { generateDocumentId } from "@/utils/documentId";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { name?: unknown }
      | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "student";
    const documentId = generateDocumentId();
    const zipPath = buildSubmissionZipPath(documentId, name);

    await ensureSubmissionBucket();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(SUBMISSION_FILES_BUCKET)
      .createSignedUploadUrl(zipPath, { upsert: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      documentId,
      zipPath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (error) {
    console.error("Submission signed upload URL error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare file upload" },
      { status: 500 }
    );
  }
}
