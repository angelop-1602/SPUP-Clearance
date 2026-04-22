import { NextResponse } from "next/server";

import { jsonError, requireAdmin } from "@/lib/api/admin";
import { mapSubmissionRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

export async function GET() {
  try {
    await requireAdmin();

    const supabase = createSupabaseAdminClient();
    const rows: SubmissionRow[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("submitted_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(error.message);
      }

      rows.push(...((data ?? []) as SubmissionRow[]));

      if (!data || data.length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }

    return NextResponse.json({
      submissions: rows.map((row) => mapSubmissionRow(row)),
    });
  } catch (error) {
    return jsonError(error);
  }
}
