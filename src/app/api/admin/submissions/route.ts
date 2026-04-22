import { NextResponse } from "next/server";

import { jsonError, requireAdmin } from "@/lib/api/admin";
import { mapSubmissionRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdmin();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      submissions: ((data ?? []) as SubmissionRow[]).map((row) =>
        mapSubmissionRow(row)
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}
