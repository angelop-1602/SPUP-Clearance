import { NextRequest, NextResponse } from "next/server";

import { ApiError, jsonError, requireAdmin } from "@/lib/api/admin";
import { mapSubmissionRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const { exportLink } = (await request.json()) as { exportLink?: string };

    if (!exportLink || !/^https?:\/\//i.test(exportLink)) {
      throw new ApiError(400, "A valid export link is required");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("submissions")
      .update({ export_link: exportLink })
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
    const { data, error } = await supabase
      .from("submissions")
      .update({ export_link: null })
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
