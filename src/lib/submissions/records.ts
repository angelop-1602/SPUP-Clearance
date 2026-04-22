import { CoordinatorSubmission, GroupMember, Level, Student } from "@/types";
import { normalizeResearchType } from "@/utils/researchType";

export interface SubmissionRow {
  id: string;
  level: Level;
  name: string;
  email: string;
  student_id: string;
  adviser: string | null;
  course: string;
  graduation_month: string;
  graduation_year: string;
  research_title: string | null;
  research_type: string;
  group_members: GroupMember[] | null;
  file_list: string[] | null;
  zip_path: string | null;
  status: "Submitted" | "Cleared";
  submitted_at: string;
  updated_at: string | null;
  is_exported: boolean | null;
  exported_at: string | null;
  export_link: string | null;
  leader_cleared: boolean | null;
}

export type SubmissionInsert = Omit<SubmissionRow, "updated_at" | "exported_at"> & {
  updated_at?: string | null;
  exported_at?: string | null;
};

function toDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function mapSubmissionRow(
  row: SubmissionRow,
  options: { zipFile?: string } = {}
): Student {
  return {
    id: row.id,
    level: row.level,
    name: row.name,
    email: row.email,
    studentId: row.student_id,
    adviser: row.adviser ?? "",
    course: row.course,
    graduationMonth: row.graduation_month,
    graduationYear: row.graduation_year,
    researchTitle: row.research_title ?? "",
    researchType: normalizeResearchType(row.research_type),
    groupMembers: Array.isArray(row.group_members) ? row.group_members : [],
    fileList: row.file_list ?? [],
    zipPath: row.zip_path ?? undefined,
    zipFile: options.zipFile,
    status: row.status,
    submittedAt: toDate(row.submitted_at) ?? new Date(),
    updatedAt: toDate(row.updated_at),
    isExported: Boolean(row.is_exported),
    exportedAt: toDate(row.exported_at),
    exportLink: row.export_link ?? undefined,
    leaderCleared: row.leader_cleared ?? undefined,
  };
}

export function mapCoordinatorRow(row: Pick<
  SubmissionRow,
  "id" | "name" | "student_id" | "level" | "status" | "submitted_at"
>): CoordinatorSubmission {
  return {
    id: row.id,
    name: row.name,
    studentId: row.student_id,
    level: row.level,
    status: row.status,
    submittedAt: toDate(row.submitted_at) ?? new Date(),
  };
}

export function mapStudentPatchToRow(updates: Partial<Student>) {
  const patch: Record<string, unknown> = {};

  if (updates.level !== undefined) patch.level = updates.level;
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.studentId !== undefined) patch.student_id = updates.studentId;
  if (updates.adviser !== undefined) patch.adviser = updates.adviser;
  if (updates.course !== undefined) patch.course = updates.course;
  if (updates.graduationMonth !== undefined) patch.graduation_month = updates.graduationMonth;
  if (updates.graduationYear !== undefined) patch.graduation_year = updates.graduationYear;
  if (updates.researchTitle !== undefined) patch.research_title = updates.researchTitle;
  if (updates.researchType !== undefined) patch.research_type = normalizeResearchType(updates.researchType);
  if (updates.groupMembers !== undefined) patch.group_members = updates.groupMembers;
  if (updates.fileList !== undefined) patch.file_list = updates.fileList;
  if (updates.zipPath !== undefined) patch.zip_path = updates.zipPath;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.isExported !== undefined) patch.is_exported = updates.isExported;
  if (updates.exportedAt !== undefined) patch.exported_at = updates.exportedAt?.toISOString();
  if (updates.exportLink !== undefined) patch.export_link = updates.exportLink;
  if (updates.leaderCleared !== undefined) patch.leader_cleared = updates.leaderCleared;

  return patch;
}
