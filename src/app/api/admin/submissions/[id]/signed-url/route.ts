import { NextResponse } from "next/server";

import { ApiError, jsonError, requireAdmin } from "@/lib/api/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const supabase = createSupabaseAdminClient();
    const { data: submission, error: fetchError } = await supabase
      .from("submissions")
      .select("zip_path,is_exported")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!submission) throw new ApiError(404, "Submission not found");
    if (submission.is_exported) throw new ApiError(409, "Submission files were already exported");
    if (!submission.zip_path) throw new ApiError(404, "No file is available for this submission");

    const { data, error } = await supabase.storage
      .from(SUBMISSION_FILES_BUCKET)
      .createSignedUrl(submission.zip_path, 300);

    if (error) throw new Error(error.message);

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    return jsonError(error);
  }
}
