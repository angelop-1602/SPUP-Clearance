import { NextRequest, NextResponse } from "next/server";

import { ApiError, jsonError, requireAdmin } from "@/lib/api/admin";
import { mapSubmissionRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  setUndergradAllParticipantsState,
  UndergradParticipantKey,
  updateUndergradParticipantState,
} from "@/utils/undergradClearance";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = (await request.json()) as {
      all?: boolean;
      participantKey?: UndergradParticipantKey;
      isCleared?: boolean;
    };

    if (typeof body.isCleared !== "boolean") {
      throw new ApiError(400, "Missing clearance state");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ApiError(404, "Submission not found");

    const submission = mapSubmissionRow(data as SubmissionRow);
    if (submission.level !== "undergrad") {
      throw new ApiError(400, "Participant clearance is only available for undergraduate submissions");
    }

    const nextState = body.all
      ? setUndergradAllParticipantsState(submission, body.isCleared)
      : updateUndergradParticipantState(
          submission,
          body.participantKey ?? "leader",
          body.isCleared
        );

    const { data: updatedSubmission, error: updateError } = await supabase
      .from("submissions")
      .update({
        leader_cleared: nextState.leaderCleared,
        group_members: nextState.groupMembers,
        status: nextState.status,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updatedSubmission) throw new ApiError(404, "Submission not found");

    return NextResponse.json({
      submission: mapSubmissionRow(updatedSubmission as SubmissionRow),
    });
  } catch (error) {
    return jsonError(error);
  }
}
