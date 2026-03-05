"use client";

import React, { useState, useEffect } from "react";
import { StudentFormData, Level, ResearchType } from "@/types";
import { MultiFileUpload } from "./MultiFileUpload";
import { Label } from "@/components/ui/label";
import { getDocumentInstructionsForLevel } from "@/constants/documentInstructions";
import { isNotApplicableResearchType } from "@/utils/researchType";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StudentFormProps {
  onSubmit: (formData: StudentFormData) => void;
  isSubmitting: boolean;
  fixedLevel: Level;
  lockLevel?: boolean;
  fixedResearchType?: ResearchType;
  hideResearchType?: boolean;
  hideAcademicInformation?: boolean;
}

export function StudentForm({
  onSubmit,
  isSubmitting,
  fixedLevel,
  lockLevel = false,
  fixedResearchType,
  hideResearchType = false,
  hideAcademicInformation = false,
}: StudentFormProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    level: fixedLevel,
    name: "",
    email: "",
    studentId: "",
    adviser: "",
    course: "",
    graduationMonth: "",
    graduationYear: "",
    researchTitle: "",
    researchType: fixedResearchType ?? ("Thesis" as ResearchType),
    groupMembers: [{ name: "", studentID: "" }],
    uploadedFiles: [],
  });

  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      level: fixedLevel,
    }));
  }, [fixedLevel]);

  useEffect(() => {
    if (!fixedResearchType) return;

    setFormData((prev) => ({
      ...prev,
      researchType: fixedResearchType,
    }));
  }, [fixedResearchType]);

  // Clear research-related fields when switching to Not Applicable.
  useEffect(() => {
    if (isNotApplicableResearchType(formData.researchType)) {
      setFormData(prev => ({
        ...prev,
        adviser: "",
        researchTitle: "",
        groupMembers: [{ name: "", studentID: "" }],
      }));
    }
  }, [formData.researchType]);

  const handleInputChange = (
    field: keyof StudentFormData,
    value: string | Level | ResearchType
  ) => {
    if (field === "level" && lockLevel) {
      return;
    }
    if (field === "researchType" && fixedResearchType) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGroupMemberChange = (
    index: number,
    field: "name" | "studentID",
    value: string
  ) => {
    const updatedMembers = [...formData.groupMembers];
    updatedMembers[index] = { ...updatedMembers[index], [field]: value };
    setFormData((prev) => ({ ...prev, groupMembers: updatedMembers }));
  };

  const addGroupMember = () => {
    setFormData((prev) => ({
      ...prev,
      groupMembers: [...prev.groupMembers, { name: "", studentID: "" }],
    }));
  };

  const removeGroupMember = (index: number) => {
    if (formData.groupMembers.length > 1) {
      const updatedMembers = formData.groupMembers.filter(
        (_, i) => i !== index
      );
      setFormData((prev) => ({ ...prev, groupMembers: updatedMembers }));
    }
  };

  const handleFilesChange = (files: File[]) => {
    setFormData((prev) => ({
      ...prev,
      uploadedFiles: files,
    }));

    if (files.length > 0) {
      setUploadError("");
    }
  };

  const validateForm = (): boolean => {
    if (
      formData.researchType !== ("Capstone" as ResearchType) &&
      !isNotApplicableResearchType(formData.researchType) &&
      formData.uploadedFiles.length === 0
    ) {
      setUploadError("Please upload at least one file.");
      return false;
    }
    setUploadError("");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  const isNotApplicable = isNotApplicableResearchType(formData.researchType);
  const isCapstone = formData.researchType === ("Capstone" as ResearchType);
  const hasOptionalOnlyPhotoRequirement = isCapstone || isNotApplicable;
  const levelDocumentInstructions = getDocumentInstructionsForLevel(formData.level);
  const documentInstructions = hasOptionalOnlyPhotoRequirement
    ? levelDocumentInstructions.filter(
        (instruction) => instruction.id === "photo-2x2"
      )
    : levelDocumentInstructions;

  useEffect(() => {
    if (hasOptionalOnlyPhotoRequirement) {
      setUploadError("");
    }
  }, [hasOptionalOnlyPhotoRequirement]);

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 lg:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              CPRINT Student Clearance Submission
            </h1>
            <p className="text-sm sm:text-base text-gray-600 px-2 sm:px-0">
              Please fill out all required fields and upload the necessary
              documents for your clearance request.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            {/* Level and Research Type Selection */}
            {!hideAcademicInformation && (
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                  Academic Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label
                      htmlFor="level"
                      className="text-sm font-medium text-gray-700 mb-1 block"
                    >
                      Academic Level *
                    </Label>
                    <Select
                      value={formData.level}
                      onValueChange={(value: Level) =>
                        handleInputChange("level", value)
                      }
                      disabled={lockLevel}
                    >
                      <SelectTrigger id="level" className="w-full">
                        <SelectValue placeholder="Choose level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="undergrad">Undergraduate</SelectItem>
                        <SelectItem value="grad">Graduate</SelectItem>
                      </SelectContent>
                    </Select>
                    {lockLevel && (
                      <p className="text-xs text-gray-500 mt-2">
                        Academic level is fixed for this page.
                      </p>
                    )}
                  </div>

                  {!hideResearchType && (
                    <div>
                      <label
                        htmlFor="researchType"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Research Type *
                      </label>
                      <select
                        id="researchType"
                        required
                        value={formData.researchType}
                        onChange={(e) =>
                          handleInputChange(
                            "researchType",
                            e.target.value as ResearchType
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="Capstone">Capstone</option>
                        <option value="Thesis">Thesis</option>
                        <option value="Dissertation">Dissertation</option>
                        <option value="Not Applicable">Not Applicable</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Basic Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    {formData.level === "undergrad"
                      ? "Leader Name (First Name Middle Initial Last Name)*"
                      : "Full Name (First Name Middle Initial Last Name)*"}
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                    placeholder={
                      formData.level === "undergrad"
                        ? "Enter leader name"
                        : "Enter your full name"
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={`w-full px-3 py-2.5 sm:py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base ${
                      formData.email && !formData.email.includes("@")
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="studentId"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Student ID *
                  </label>
                  <input
                    id="studentId"
                    type="text"
                    required
                    value={formData.studentId}
                    onChange={(e) =>
                      handleInputChange("studentId", e.target.value)
                    }
                    className={`w-full px-3 py-2.5 sm:py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base ${
                      formData.studentId && formData.studentId.length < 4
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter your student ID"
                  />
                </div>
                <div>
                  <label
                    htmlFor="course"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Course *
                  </label>
                  <input
                    id="course"
                    type="text"
                    required
                    value={formData.course}
                    onChange={(e) =>
                      handleInputChange("course", e.target.value)
                    }
                    className={`w-full px-3 py-2.5 sm:py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base ${
                      formData.course && formData.course.length < 2
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="e.g., BSIT, BSCS, MIT, etc."
                  />
                </div>
                {!isNotApplicable && (
                  <>
                  
                  <div>
                      <label
                        htmlFor="researchTitle"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Research Title *
                      </label>
                      <input
                        id="researchTitle"
                        type="text"
                        required={!isNotApplicable}
                        value={formData.researchTitle}
                        onChange={(e) =>
                          handleInputChange("researchTitle", e.target.value)
                        }
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                        placeholder="Enter your research title"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="adviser"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Research Adviser *
                      </label>
                      <input
                        id="adviser"
                        type="text"
                        required={!isNotApplicable}
                        value={formData.adviser}
                        onChange={(e) =>
                          handleInputChange("adviser", e.target.value)
                        }
                        className={`w-full px-3 py-2.5 sm:py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base ${
                          !isNotApplicable && formData.adviser && formData.adviser.length < 2
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                        placeholder="Enter your adviser's name"
                      />
                    </div>

                  </>
                )}

                {/* Graduation Date - Mobile Responsive */}
                <div className="col-span-1 sm:col-span-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="graduationMonth"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Graduation Month *
                      </label>
                      <select
                        id="graduationMonth"
                        required
                        value={formData.graduationMonth}
                        onChange={(e) =>
                          handleInputChange("graduationMonth", e.target.value)
                        }
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                      >
                        <option value="">Select Month</option>
                        <option value="January">January</option>
                        <option value="February">February</option>
                        <option value="March">March</option>
                        <option value="April">April</option>
                        <option value="May">May</option>
                        <option value="June">June</option>
                        <option value="July">July</option>
                        <option value="August">August</option>
                        <option value="September">September</option>
                        <option value="October">October</option>
                        <option value="November">November</option>
                        <option value="December">December</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="graduationYear"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Graduation Year *
                      </label>
                      <select
                        id="graduationYear"
                        required
                        value={formData.graduationYear}
                        onChange={(e) =>
                          handleInputChange("graduationYear", e.target.value)
                        }
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                      >
                        <option value="">Select Year</option>
                        {Array.from({ length: 16 }, (_, i) => {
                          const currentYear = new Date().getFullYear();
                          const year = currentYear - 10 + i; // Start from 10 years ago
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Group Members (Undergraduate only and not Not Applicable) */}
            {formData.level === "undergrad" && !isNotApplicable && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Group Members
                  </h2>
                  <button
                    type="button"
                    onClick={addGroupMember}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full sm:w-auto"
                  >
                    + Add Member
                  </button>
                </div>

                {formData.groupMembers.map((member, index) => (
                  <div
                    key={index}
                    className="space-y-4 p-4 border border-gray-200 rounded-md"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Member {index + 1} Name
                        </label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) =>
                            handleGroupMemberChange(index, "name", e.target.value)
                          }
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          placeholder="Enter member name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Student ID (optional)
                        </label>
                        <input
                          type="text"
                          value={member.studentID}
                          onChange={(e) =>
                            handleGroupMemberChange(
                              index,
                              "studentID",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          placeholder="Enter student ID"
                        />
                      </div>
                    </div>
                    {formData.groupMembers.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeGroupMember(index)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                        >
                          Remove Member
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Document Uploads */}
            <div className="space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {hasOptionalOnlyPhotoRequirement
                  ? "Document Submission Instructions"
                  : "Document Submission Instructions"}
              </h2>
              <p className="text-sm text-gray-600">
                {hasOptionalOnlyPhotoRequirement
                  ? "Only the 2x2 photo requirement applies, and it is optional if a graduation picture is already available."
                  : "Upload all applicable files in one submission. Document checks are instruction-based, so include every file relevant to your case."}
              </p>

              {documentInstructions.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <ul className="space-y-3">
                    {documentInstructions.map((instruction, index) => (
                      <li key={instruction.id} className="text-sm text-gray-800">
                        <p>
                          <span className="font-medium">{index + 1}. {instruction.title}</span>
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {instruction.description}
                        </p>
                        {(instruction.optional ||
                          instruction.itOnly ||
                          instruction.conditional) && (
                          <p className="text-xs text-gray-500 mt-1">
                            {[
                              instruction.optional ? "Optional" : null,
                              instruction.itOnly ? "Information Technology courses only" : null,
                              instruction.conditional ?? null,
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <MultiFileUpload
                files={formData.uploadedFiles}
                onFilesChange={handleFilesChange}
                error={hasOptionalOnlyPhotoRequirement ? "" : uploadError}
                isRequired={!hasOptionalOnlyPhotoRequirement}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors text-base sm:text-lg ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-primary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                }`}
              >
                {isSubmitting ? "Submitting..." : "Submit Clearance Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
