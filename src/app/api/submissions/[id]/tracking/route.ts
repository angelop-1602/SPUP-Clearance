import { NextRequest, NextResponse } from "next/server";

import { ApiError, jsonError } from "@/lib/api/admin";
import {
  buildSubmissionArchive,
  ensureSubmissionBucket,
  sanitizeStorageSegment,
} from "@/lib/submissions/files";
import { mapSubmissionRow, SubmissionRow } from "@/lib/submissions/records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";
import { GroupMember, Level, ResearchType, Student } from "@/types";
import { isNotApplicableResearchType, normalizeResearchType } from "@/utils/researchType";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function mapTrackingSubmission(row: SubmissionRow): Student {
  const submission = mapSubmissionRow(row);

  return {
    ...submission,
    zipFile: undefined,
    zipPath: undefined,
    isExported: undefined,
    exportedAt: undefined,
    exportLink: undefined,
  };
}

function normalizeIdentity(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getMemberIdentity(member: GroupMember): string | null {
  const studentId = normalizeIdentity(member.studentID);
  if (studentId) return `id:${studentId}`;

  const name = normalizeIdentity(member.name);
  return name ? `name:${name}` : null;
}

function toSafeGroupMembers(value: GroupMember[] | null): GroupMember[] {
  return Array.isArray(value)
    ? value
        .map((member) => ({
          name: typeof member?.name === "string" ? member.name.trim() : "",
          studentID:
            typeof member?.studentID === "string" ? member.studentID.trim() : "",
          isCleared:
            typeof member?.isCleared === "boolean" ? member.isCleared : undefined,
        }))
        .filter((member) => member.name || member.studentID)
    : [];
}

function hasUndergradClearance(row: SubmissionRow): boolean {
  if (row.level !== "undergrad") return false;
  if (row.leader_cleared === true) return true;
  return toSafeGroupMembers(row.group_members).some(
    (member) => member.isCleared === true
  );
}

function getPayloadString(
  payload: Record<string, unknown>,
  key: string
): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function getPayloadLevel(payload: Record<string, unknown>): Level | null {
  return payload.level === "undergrad" || payload.level === "grad"
    ? payload.level
    : null;
}

function getPayloadResearchType(
  payload: Record<string, unknown>,
  level: Level
): ResearchType {
  if (level === "undergrad") return "Thesis";

  return normalizeResearchType(
    typeof payload.researchType === "string" ? payload.researchType : "Thesis"
  );
}

function getPayloadGroupMembers(payload: Record<string, unknown>): GroupMember[] {
  if (!Array.isArray(payload.groupMembers)) return [];

  return payload.groupMembers.reduce<GroupMember[]>((members, member) => {
    if (!member || typeof member !== "object") return members;

    const item = member as { name?: unknown; studentID?: unknown };
    const nextMember = {
      name: typeof item.name === "string" ? item.name.trim() : "",
      studentID: typeof item.studentID === "string" ? item.studentID.trim() : "",
      isCleared: false,
    };

    if (nextMember.name || nextMember.studentID) {
      members.push(nextMember);
    }

    return members;
  }, []);
}

function mergeUndergradGroupMembers(
  existingMembers: GroupMember[],
  incomingMembers: GroupMember[]
): GroupMember[] {
  const clearedByIdentity = new Map<string, GroupMember>();

  existingMembers.forEach((member) => {
    if (member.isCleared !== true) return;

    const identity = getMemberIdentity(member);
    if (identity) {
      clearedByIdentity.set(identity, member);
    }
  });

  const usedClearedIdentities = new Set<string>();
  const mergedMembers = incomingMembers.map((member) => {
    const identity = getMemberIdentity(member);
    const clearedMember = identity ? clearedByIdentity.get(identity) : null;

    if (identity && clearedMember) {
      usedClearedIdentities.add(identity);
      return clearedMember;
    }

    return {
      name: member.name,
      studentID: member.studentID,
      isCleared: false,
    };
  });

  clearedByIdentity.forEach((member, identity) => {
    if (!usedClearedIdentities.has(identity)) {
      mergedMembers.push(member);
    }
  });

  return mergedMembers;
}

function parsePayload(payloadValue: FormDataEntryValue | null) {
  if (typeof payloadValue !== "string") {
    throw new ApiError(400, "Missing submission payload");
  }

  try {
    return JSON.parse(payloadValue) as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid submission payload");
  }
}

function getReplacementFiles(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      submission: data ? mapTrackingSubmission(data as SubmissionRow) : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  let uploadedZipPath: string | null = null;
  let previousZipPath: string | null = null;

  try {
    const { id } = await params;
    const formData = await request.formData();
    const payload = parsePayload(formData.get("payload"));
    const replacementFiles = getReplacementFiles(formData);

    const supabase = createSupabaseAdminClient();
    const { data: currentRow, error: fetchError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!currentRow) throw new ApiError(404, "Submission not found");

    const current = currentRow as SubmissionRow;
    previousZipPath = current.zip_path;

    if (current.status !== "Submitted") {
      throw new ApiError(409, "Cleared submissions can no longer be edited");
    }

    const level = getPayloadLevel(payload);
    if (!level) {
      throw new ApiError(400, "Invalid academic level");
    }

    if (
      current.level === "undergrad" &&
      hasUndergradClearance(current) &&
      level !== current.level
    ) {
      throw new ApiError(
        409,
        "Academic level cannot be changed after any undergraduate participant has been cleared"
      );
    }

    const existingLeaderCleared =
      current.level === "undergrad" && current.leader_cleared === true;
    const researchType = getPayloadResearchType(payload, level);
    const name =
      level === "undergrad" && existingLeaderCleared
        ? current.name
        : getPayloadString(payload, "name");
    const studentId =
      level === "undergrad" && existingLeaderCleared
        ? current.student_id
        : getPayloadString(payload, "studentId");
    const email = getPayloadString(payload, "email");
    const course = getPayloadString(payload, "course");
    const graduationMonth = getPayloadString(payload, "graduationMonth");
    const graduationYear = getPayloadString(payload, "graduationYear");
    const adviser = isNotApplicableResearchType(researchType)
      ? ""
      : getPayloadString(payload, "adviser");
    const researchTitle = isNotApplicableResearchType(researchType)
      ? ""
      : getPayloadString(payload, "researchTitle");

    if (!name || !email || !studentId || !course || !graduationMonth || !graduationYear) {
      throw new ApiError(400, "Missing required submission fields");
    }

    if (!isNotApplicableResearchType(researchType) && (!adviser || !researchTitle)) {
      throw new ApiError(400, "Missing required research details");
    }

    const existingFileList = current.file_list ?? [];
    const hasExistingFiles = existingFileList.length > 0;
    const requiresFiles =
      researchType !== "Capstone" && !isNotApplicableResearchType(researchType);

    if (requiresFiles && replacementFiles.length === 0 && !hasExistingFiles) {
      throw new ApiError(400, "At least one file is required");
    }

    let nextFileList = existingFileList;
    let nextZipPath = current.zip_path;

    if (replacementFiles.length > 0) {
      const { fileList, archive } = await buildSubmissionArchive(replacementFiles);
      if (!archive) {
        throw new ApiError(400, "No replacement files were provided");
      }

      await ensureSubmissionBucket();

      const sanitizedName = sanitizeStorageSegment(name);
      nextZipPath = `submissions/${id}/${sanitizedName}_${id}.zip`;
      const { error: uploadError } = await supabase.storage
        .from(SUBMISSION_FILES_BUCKET)
        .upload(nextZipPath, archive, {
          contentType: "application/zip",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      uploadedZipPath = nextZipPath;
      nextFileList = fileList;
    }

    const existingMembers = toSafeGroupMembers(current.group_members);
    const incomingMembers = getPayloadGroupMembers(payload);
    const nextGroupMembers =
      level === "undergrad"
        ? current.level === "undergrad"
          ? mergeUndergradGroupMembers(existingMembers, incomingMembers)
          : incomingMembers.map((member) => ({ ...member, isCleared: false }))
        : [];
    const nextLeaderCleared =
      level === "undergrad"
        ? current.level === "undergrad" && current.leader_cleared === true
        : null;

    const { data: updatedRow, error: updateError } = await supabase
      .from("submissions")
      .update({
        level,
        name,
        email,
        student_id: studentId,
        adviser,
        course,
        graduation_month: graduationMonth,
        graduation_year: graduationYear,
        research_title: researchTitle,
        research_type: researchType,
        group_members: nextGroupMembers,
        file_list: nextFileList,
        zip_path: nextZipPath,
        leader_cleared: nextLeaderCleared,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updatedRow) throw new ApiError(404, "Submission not found");

    if (uploadedZipPath && previousZipPath && previousZipPath !== uploadedZipPath) {
      await supabase.storage.from(SUBMISSION_FILES_BUCKET).remove([previousZipPath]);
    }

    return NextResponse.json({
      submission: mapTrackingSubmission(updatedRow as SubmissionRow),
    });
  } catch (error) {
    if (uploadedZipPath && uploadedZipPath !== previousZipPath) {
      const supabase = createSupabaseAdminClient();
      await supabase.storage.from(SUBMISSION_FILES_BUCKET).remove([uploadedZipPath]);
    }

    return jsonError(error);
  }
}
