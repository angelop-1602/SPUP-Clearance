import { NextRequest, NextResponse } from "next/server";

import { ApiError, jsonError, requireAdmin } from "@/lib/api/admin";
import { mapSubmissionRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = (await request.json()) as {
      deleteFromStorage?: boolean;
      exportLink?: string;
    };
    const supabase = createSupabaseAdminClient();

    const { data: submission, error: fetchError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!submission) throw new ApiError(404, "Submission not found");

    const row = submission as SubmissionRow;
    if (body.deleteFromStorage && row.zip_path) {
      await supabase.storage.from(SUBMISSION_FILES_BUCKET).remove([row.zip_path]);
    }

    const { data, error } = await supabase
      .from("submissions")
      .update({
        is_exported: true,
        exported_at: new Date().toISOString(),
        ...(body.exportLink !== undefined ? { export_link: body.exportLink } : {}),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ApiError(404, "Submission not found");

    return NextResponse.json({ submission: mapSubmissionRow(data as SubmissionRow) });
  } catch (error) {
    return jsonError(error);
  }
}
