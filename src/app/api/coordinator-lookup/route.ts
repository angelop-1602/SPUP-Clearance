import { NextRequest, NextResponse } from "next/server";

import { mapCoordinatorRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SELECT_COLUMNS = "id,name,student_id,level,status,submitted_at";

export async function GET(request: NextRequest) {
  const searchTerm = request.nextUrl.searchParams.get("search")?.trim();

  if (!searchTerm) {
    return NextResponse.json({ submissions: [] });
  }

  const supabase = createSupabaseAdminClient();
  const searchPattern = `%${searchTerm}%`;

  const [nameResult, studentIdResult] = await Promise.all([
    supabase
      .from("submissions")
      .select(SELECT_COLUMNS)
      .ilike("name", searchPattern)
      .order("submitted_at", { ascending: false })
      .limit(25),
    supabase
      .from("submissions")
      .select(SELECT_COLUMNS)
      .ilike("student_id", searchPattern)
      .order("submitted_at", { ascending: false })
      .limit(25),
  ]);

  if (nameResult.error || studentIdResult.error) {
    return NextResponse.json(
      { error: nameResult.error?.message ?? studentIdResult.error?.message },
      { status: 500 }
    );
  }

  const rowsById = new Map<string, Pick<
    SubmissionRow,
    "id" | "name" | "student_id" | "level" | "status" | "submitted_at"
  >>();

  [...(nameResult.data ?? []), ...(studentIdResult.data ?? [])].forEach((row) => {
    rowsById.set(row.id, row);
  });

  const submissions = Array.from(rowsById.values())
    .sort(
      (a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    )
    .slice(0, 25)
    .map(mapCoordinatorRow);

  return NextResponse.json({ submissions });
}
