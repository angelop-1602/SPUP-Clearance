import { NextRequest, NextResponse } from "next/server";

import { ApiError, jsonError, requireAdmin } from "@/lib/api/admin";
import {
  mapStudentPatchToRow,
  mapSubmissionRow,
  SubmissionRow,
} from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";
import { Student } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const updates = (await request.json()) as Partial<Student>;
    const patch = mapStudentPatchToRow(updates);

    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, "No valid updates provided");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("submissions")
      .update(patch)
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

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: submission, error: fetchError } = await supabase
      .from("submissions")
      .select("zip_path")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!submission) throw new ApiError(404, "Submission not found");

    if (submission.zip_path) {
      await supabase.storage
        .from(SUBMISSION_FILES_BUCKET)
        .remove([submission.zip_path]);
    }

    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
