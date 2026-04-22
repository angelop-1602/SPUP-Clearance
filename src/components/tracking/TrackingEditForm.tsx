"use client";

import React, { useState } from "react";
import { AlertCircle, FileText, Lock, Plus, Save, X } from "lucide-react";

import { MultiFileUpload } from "@/components/forms/MultiFileUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDocumentInstructionsForLevel } from "@/constants/documentInstructions";
import { GroupMember, Level, ResearchType, Student, StudentFormData } from "@/types";
import { isNotApplicableResearchType } from "@/utils/researchType";

interface TrackingEditFormProps {
  submission: Student;
  isSaving: boolean;
  saveError: string;
  onCancel: () => void;
  onSave: (formData: StudentFormData) => void;
}

function toInitialFormData(submission: Student): StudentFormData {
  return {
    level: submission.level,
    name: submission.name,
    email: submission.email,
    studentId: submission.studentId,
    adviser: submission.adviser || "",
    course: submission.course,
    graduationMonth: submission.graduationMonth || "",
    graduationYear: submission.graduationYear || "",
    researchTitle: submission.researchTitle || "",
    researchType:
      submission.level === "undergrad" ? "Thesis" : submission.researchType,
    groupMembers:
      submission.level === "undergrad" && submission.groupMembers?.length
        ? submission.groupMembers
        : [{ name: "", studentID: "" }],
    uploadedFiles: [],
  };
}

function isLockedMember(member: GroupMember): boolean {
  return member.isCleared === true;
}

export function TrackingEditForm({
  submission,
  isSaving,
  saveError,
  onCancel,
  onSave,
}: TrackingEditFormProps) {
  const [formData, setFormData] = useState<StudentFormData>(() =>
    toInitialFormData(submission)
  );
  const [uploadError, setUploadError] = useState("");

  const leaderLocked =
    submission.level === "undergrad" && submission.leaderCleared === true;
  const hasLockedUndergradClearance =
    leaderLocked ||
    (submission.groupMembers ?? []).some((member) => member.isCleared === true);
  const isNotApplicable = isNotApplicableResearchType(formData.researchType);
  const requiresFiles =
    formData.researchType !== "Capstone" && !isNotApplicableResearchType(formData.researchType);
  const hasExistingFiles = (submission.fileList?.length ?? 0) > 0;
  const hasOptionalOnlyPhotoRequirement =
    formData.researchType === "Capstone" || isNotApplicable;
  const documentInstructions = hasOptionalOnlyPhotoRequirement
    ? getDocumentInstructionsForLevel(formData.level).filter(
        (instruction) => instruction.id === "photo-2x2"
      )
    : getDocumentInstructionsForLevel(formData.level);

  const handleInputChange = (
    field: keyof StudentFormData,
    value: string | Level | ResearchType
  ) => {
    if ((field === "name" || field === "studentId") && leaderLocked) return;

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLevelChange = (level: Level) => {
    if (hasLockedUndergradClearance) return;

    setFormData((prev) => ({
      ...prev,
      level,
      researchType: level === "undergrad" ? "Thesis" : prev.researchType,
      groupMembers:
        level === "undergrad"
          ? prev.groupMembers.length > 0
            ? prev.groupMembers
            : [{ name: "", studentID: "" }]
          : [],
    }));
  };

  const handleResearchTypeChange = (researchType: ResearchType) => {
    setFormData((prev) => ({
      ...prev,
      researchType,
      adviser: isNotApplicableResearchType(researchType) ? "" : prev.adviser,
      researchTitle: isNotApplicableResearchType(researchType)
        ? ""
        : prev.researchTitle,
      groupMembers: isNotApplicableResearchType(researchType)
        ? [{ name: "", studentID: "" }]
        : prev.groupMembers,
    }));
  };

  const updateGroupMember = (
    index: number,
    field: "name" | "studentID",
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      groupMembers: prev.groupMembers.map((member, memberIndex) =>
        memberIndex === index && !isLockedMember(member)
          ? { ...member, [field]: value }
          : member
      ),
    }));
  };

  const addGroupMember = () => {
    setFormData((prev) => ({
      ...prev,
      groupMembers: [...prev.groupMembers, { name: "", studentID: "" }],
    }));
  };

  const removeGroupMember = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      groupMembers: prev.groupMembers.filter(
        (member, memberIndex) => memberIndex !== index || isLockedMember(member)
      ),
    }));
  };

  const handleFilesChange = (files: File[]) => {
    setFormData((prev) => ({ ...prev, uploadedFiles: files }));
    if (files.length > 0) setUploadError("");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (requiresFiles && !hasExistingFiles && formData.uploadedFiles.length === 0) {
      setUploadError("Please upload at least one file for this submission.");
      return;
    }

    setUploadError("");
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Changes are allowed only while your submission is under review. Existing
        files stay unchanged unless you select replacement files below.
      </div>

      {hasLockedUndergradClearance && (
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Some undergraduate clearance entries are already marked cleared, so
            those names, IDs, and the academic level are locked.
          </p>
        </div>
      )}

      {saveError && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{saveError}</p>
        </div>
      )}

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">
          Academic Information
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tracking-level">Academic Level</Label>
            <select
              id="tracking-level"
              value={formData.level}
              onChange={(event) => handleLevelChange(event.target.value as Level)}
              disabled={hasLockedUndergradClearance || isSaving}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
            >
              <option value="undergrad">Undergraduate</option>
              <option value="grad">Graduate</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking-research-type">Research Type</Label>
            {formData.level === "undergrad" ? (
              <Input id="tracking-research-type" value="Thesis" disabled />
            ) : (
              <select
                id="tracking-research-type"
                value={formData.researchType}
                onChange={(event) =>
                  handleResearchTypeChange(event.target.value as ResearchType)
                }
                disabled={isSaving}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
              >
                <option value="Capstone">Capstone</option>
                <option value="Thesis">Thesis</option>
                <option value="Dissertation">Dissertation</option>
                <option value="Not Applicable">Not Applicable</option>
              </select>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">
          Student Information
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tracking-name">
              {formData.level === "undergrad" ? "Leader Name" : "Full Name"}
            </Label>
            <Input
              id="tracking-name"
              value={formData.name}
              onChange={(event) => handleInputChange("name", event.target.value)}
              disabled={isSaving || leaderLocked}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking-email">Email Address</Label>
            <Input
              id="tracking-email"
              type="email"
              value={formData.email}
              onChange={(event) => handleInputChange("email", event.target.value)}
              disabled={isSaving}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking-student-id">Student ID</Label>
            <Input
              id="tracking-student-id"
              value={formData.studentId}
              onChange={(event) =>
                handleInputChange("studentId", event.target.value)
              }
              disabled={isSaving || leaderLocked}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking-course">Course</Label>
            <Input
              id="tracking-course"
              value={formData.course}
              onChange={(event) => handleInputChange("course", event.target.value)}
              disabled={isSaving}
              required
            />
          </div>
        </div>
      </section>

      {!isNotApplicable && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900">
            Research Details
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tracking-title">Research Title</Label>
              <Input
                id="tracking-title"
                value={formData.researchTitle}
                onChange={(event) =>
                  handleInputChange("researchTitle", event.target.value)
                }
                disabled={isSaving}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking-adviser">Research Adviser</Label>
              <Input
                id="tracking-adviser"
                value={formData.adviser}
                onChange={(event) =>
                  handleInputChange("adviser", event.target.value)
                }
                disabled={isSaving}
                required
              />
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">
          Graduation Details
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tracking-grad-month">Graduation Month</Label>
            <select
              id="tracking-grad-month"
              value={formData.graduationMonth}
              onChange={(event) =>
                handleInputChange("graduationMonth", event.target.value)
              }
              disabled={isSaving}
              required
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
            >
              <option value="">Select Month</option>
              {[
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ].map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking-grad-year">Graduation Year</Label>
            <select
              id="tracking-grad-year"
              value={formData.graduationYear}
              onChange={(event) =>
                handleInputChange("graduationYear", event.target.value)
              }
              disabled={isSaving}
              required
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
            >
              <option value="">Select Year</option>
              {Array.from({ length: 16 }, (_, index) => {
                const year = new Date().getFullYear() - 10 + index;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </section>

      {formData.level === "undergrad" && !isNotApplicable && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">
              Group Members
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGroupMember}
              disabled={isSaving}
            >
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          </div>

          <div className="space-y-3">
            {formData.groupMembers.map((member, index) => {
              const locked = isLockedMember(member);

              return (
                <div
                  key={`${index}-${member.studentID}-${member.name}`}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">
                      Member {index + 1}
                    </p>
                    {locked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                        <Lock className="h-3 w-3" />
                        Cleared
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Member Name</Label>
                      <Input
                        value={member.name}
                        onChange={(event) =>
                          updateGroupMember(index, "name", event.target.value)
                        }
                        disabled={isSaving || locked}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Student ID</Label>
                      <Input
                        value={member.studentID}
                        onChange={(event) =>
                          updateGroupMember(index, "studentID", event.target.value)
                        }
                        disabled={isSaving || locked}
                      />
                    </div>
                  </div>

                  {!locked && formData.groupMembers.length > 1 && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeGroupMember(index)}
                        disabled={isSaving}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-gray-900">
            Replacement Files
          </h3>
        </div>

        {submission.fileList && submission.fileList.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">
              Current submitted files
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {submission.fileList.map((fileName) => (
                <li key={fileName}>{fileName}</li>
              ))}
            </ul>
          </div>
        )}

        {documentInstructions.length > 0 && (
          <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">File guidance</p>
            <ul className="mt-2 space-y-2">
              {documentInstructions.map((instruction, index) => (
                <li key={instruction.id}>
                  <span className="font-medium">
                    {index + 1}. {instruction.title}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {instruction.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <MultiFileUpload
          files={formData.uploadedFiles}
          onFilesChange={handleFilesChange}
          error={uploadError}
          isRequired={requiresFiles && !hasExistingFiles}
        />
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
