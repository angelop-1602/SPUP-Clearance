import { NextRequest, NextResponse } from "next/server";

import { SubmissionInsert } from "@/lib/submissions/records";
import {
  buildSubmissionArchive,
  ensureSubmissionBucket,
  sanitizeStorageSegment,
} from "@/lib/submissions/files";
import { SUBMISSION_FILES_BUCKET } from "@/lib/supabase/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StudentFormData } from "@/types";
import { generateDocumentId } from "@/utils/documentId";
import { isNotApplicableResearchType, normalizeResearchType } from "@/utils/researchType";

function getRequiredString(payload: Record<string, unknown>, key: keyof StudentFormData): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payloadValue = formData.get("payload");

    if (typeof payloadValue !== "string") {
      return NextResponse.json({ error: "Missing submission payload" }, { status: 400 });
    }

    const payload = JSON.parse(payloadValue) as Record<string, unknown>;
    const level = payload.level === "undergrad" || payload.level === "grad"
      ? payload.level
      : null;
    const researchType = normalizeResearchType(
      typeof payload.researchType === "string" ? payload.researchType : "Thesis"
    );

    if (!level) {
      return NextResponse.json({ error: "Invalid academic level" }, { status: 400 });
    }

    const name = getRequiredString(payload, "name");
    const email = getRequiredString(payload, "email");
    const studentId = getRequiredString(payload, "studentId");
    const course = getRequiredString(payload, "course");
    const graduationMonth = getRequiredString(payload, "graduationMonth");
    const graduationYear = getRequiredString(payload, "graduationYear");
    const adviser = getRequiredString(payload, "adviser");
    const researchTitle = getRequiredString(payload, "researchTitle");

    if (!name || !email || !studentId || !course || !graduationMonth || !graduationYear) {
      return NextResponse.json({ error: "Missing required submission fields" }, { status: 400 });
    }

    if (!isNotApplicableResearchType(researchType) && (!adviser || !researchTitle)) {
      return NextResponse.json({ error: "Missing required research details" }, { status: 400 });
    }

    const files = formData
      .getAll("files")
      .filter((file): file is File => file instanceof File && file.size > 0);
    const requiresFiles =
      researchType !== "Capstone" && !isNotApplicableResearchType(researchType);

    if (requiresFiles && files.length === 0) {
      return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
    }

    const documentId = generateDocumentId();
    const { fileList, archive } = await buildSubmissionArchive(files);
    let zipPath: string | null = null;

    if (archive) {
      await ensureSubmissionBucket();

      const sanitizedName = sanitizeStorageSegment(name);
      zipPath = `submissions/${documentId}/${sanitizedName}_${documentId}.zip`;
      const supabase = createSupabaseAdminClient();
      const { error: uploadError } = await supabase.storage
        .from(SUBMISSION_FILES_BUCKET)
        .upload(zipPath, archive, {
          contentType: "application/zip",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }
    }

    const groupMembers = Array.isArray(payload.groupMembers)
      ? payload.groupMembers
          .map((member) => {
            if (!member || typeof member !== "object") {
              return null;
            }
            const item = member as { name?: unknown; studentID?: unknown };
            return {
              name: typeof item.name === "string" ? item.name.trim() : "",
              studentID: typeof item.studentID === "string" ? item.studentID.trim() : "",
            };
          })
          .filter((member): member is { name: string; studentID: string } =>
            Boolean(member && (member.name || member.studentID))
          )
      : [];

    const submission: SubmissionInsert = {
      id: documentId,
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
      group_members: level === "undergrad" ? groupMembers : [],
      file_list: fileList,
      zip_path: zipPath,
      status: "Submitted",
      leader_cleared: level === "undergrad" ? false : null,
      is_exported: false,
      export_link: null,
      submitted_at: new Date().toISOString(),
    };

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("submissions").insert(submission);

    if (error) {
      if (zipPath) {
        await supabase.storage.from(SUBMISSION_FILES_BUCKET).remove([zipPath]);
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ documentId });
  } catch (error) {
    console.error("Submission API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit clearance request" },
      { status: 500 }
    );
  }
}
