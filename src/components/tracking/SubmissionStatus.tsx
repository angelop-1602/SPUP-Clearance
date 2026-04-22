"use client";

import React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  Pencil,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Student } from "@/types";
import {
  getResearchTypeLabel,
  isNotApplicableResearchType,
} from "@/utils/researchType";

interface SubmissionStatusProps {
  submission: Student;
  onReset: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <div
        className={`mt-1 text-sm text-gray-900 ${
          mono ? "break-all font-mono" : ""
        }`}
      >
        {value || "N/A"}
      </div>
    </div>
  );
}

export function SubmissionStatus({
  submission,
  onReset,
  onEdit,
  canEdit = false,
}: SubmissionStatusProps) {
  const isCleared = submission.status === "Cleared";
  const isNotApplicable = isNotApplicableResearchType(submission.researchType);
  const StatusIcon = isCleared ? CheckCircle2 : Clock3;
  const statusTitle = isCleared ? "Cleared" : "Under Review";
  const statusMessage = isCleared
    ? "Your clearance has been approved. Please coordinate with your department for next steps."
    : "Your submission is still under review. You can edit the details while it remains submitted.";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-primary px-5 py-6 text-primary-foreground sm:px-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/15">
                <StatusIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium opacity-90">Submission status</p>
                <h2 className="mt-1 text-2xl font-semibold">{statusTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm opacity-95">
                  {statusMessage}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <StatusBadge status={submission.status} />
         
              {canEdit && onEdit && (
                <Button type="button" variant="secondary" onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                  Edit Submission
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Submission Information
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label="Submission ID" value={submission.id} mono />
                <DetailItem
                  label="Submitted On"
                  value={formatDate(submission.submittedAt)}
                />
                <DetailItem
                  label={submission.level === "undergrad" ? "Leader Name" : "Name"}
                  value={submission.name}
                />
                <DetailItem label="Student ID" value={submission.studentId} />
                <DetailItem label="Email" value={submission.email} />
                <DetailItem label="Course" value={submission.course} />
                <DetailItem
                  label="Academic Level"
                  value={
                    submission.level === "undergrad" ? "Undergraduate" : "Graduate"
                  }
                />
                <DetailItem
                  label="Graduation"
                  value={`${submission.graduationMonth} ${submission.graduationYear}`}
                />
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Research Details
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Research Type"
                  value={getResearchTypeLabel(submission.researchType)}
                />
                <DetailItem
                  label="Adviser"
                  value={isNotApplicable ? "N/A" : submission.adviser}
                />
                <div className="sm:col-span-2">
                  <DetailItem
                    label="Research Title"
                    value={isNotApplicable ? "N/A" : submission.researchTitle}
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            {submission.level === "undergrad" &&
              submission.groupMembers &&
              submission.groupMembers.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold text-gray-900">
                      Group Members
                    </h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {submission.groupMembers.map((member, index) => (
                      <div
                        key={`${member.studentID}-${member.name}-${index}`}
                        className="rounded-md bg-gray-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {member.name || `Member ${index + 1}`}
                            </p>
                            <p className="text-xs text-gray-600">
                              {member.studentID || "No student ID"}
                            </p>
                          </div>
                          {member.isCleared && (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                              Cleared
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold text-gray-900">
                  Submitted Files
                </h3>
              </div>
              {submission.fileList && submission.fileList.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  {submission.fileList.map((fileName) => (
                    <li key={fileName} className="break-words">
                      {fileName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-gray-600">
                  No file list is available for this submission.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h3 className="text-base font-semibold text-gray-900">Next Steps</h3>
              <p className="mt-2 text-sm text-gray-700">
                {isCleared
                  ? "Your clearance is approved. Save this tracking result for your records."
                  : "Review your details while the request is still submitted. Edits are disabled after clearance."}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onReset}>
          <Search className="h-4 w-4" />
          Track Another
        </Button>
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4" />
            Submit New Request
          </Link>
        </Button>
      </div>
    </div>
  );
}
