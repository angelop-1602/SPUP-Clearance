import { NextRequest, NextResponse } from "next/server";

import { ApiError, jsonError, requireAdmin } from "@/lib/api/admin";
import { mapSubmissionRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const { status } = (await request.json()) as { status?: string };

    if (status !== "Submitted" && status !== "Cleared") {
      throw new ApiError(400, "Invalid status");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("submissions")
      .update({ status })
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
