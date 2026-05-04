export function sanitizeStorageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9\s_-]/g, "").trim().replace(/\s+/g, "_") || "student";
}

export function buildSubmissionZipPath(documentId: string, studentName: string): string {
  const sanitizedName = sanitizeStorageSegment(studentName);
  return `submissions/${documentId}/${sanitizedName}_${documentId}.zip`;
}
