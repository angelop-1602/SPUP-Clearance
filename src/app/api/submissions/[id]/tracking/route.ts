import { NextResponse } from "next/server";

import { mapSubmissionRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id,level,name,student_id,adviser,course,graduation_month,graduation_year,research_title,research_type,group_members,status,submitted_at,updated_at,leader_cleared"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ submission: null });
  }

  const submission = mapSubmissionRow({
    ...(data as Partial<SubmissionRow>),
    email: "",
    file_list: [],
    zip_path: null,
    is_exported: false,
    exported_at: null,
    export_link: null,
  } as SubmissionRow);

  return NextResponse.json({ submission });
}
