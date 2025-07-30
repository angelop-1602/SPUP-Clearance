"use client";

import React, { useState } from "react";
import { StudentFormData, Level, ResearchType } from "@/types";
import { DocumentUpload } from "./DocumentUpload";
import { Label } from "@/components/ui/label";
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
}

export function StudentForm({ onSubmit, isSubmitting }: StudentFormProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    level: "undergrad",
    name: "",
    email: "",
    studentId: "",
    adviser: "",
    course: "",
    researchTitle: "",
    researchType: "Thesis",
    groupMembers: [{ name: "", studentID: "" }],
    documents: {
      approvalSheet: null,
      fullPaper: null,
      longAbstract: null,
      journalFormat: null,
    },
  });

  const [documentErrors, setDocumentErrors] = useState<Record<string, string>>(
    {}
  );

  const handleInputChange = (field: keyof StudentFormData, value: string | Level | ResearchType) => {
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

  const handleDocumentChange = (
    documentType: keyof StudentFormData["documents"],
    file: File | null
  ) => {
    setFormData((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [documentType]: file,
      },
    }));

    // Clear any error for this document type
    if (file) {
      setDocumentErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[documentType];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Check required documents
    const requiredDocs = [
      "approvalSheet",
      "fullPaper",
      "longAbstract",
      "journalFormat",
    ] as const;
    requiredDocs.forEach((docType) => {
      if (!formData.documents[docType]) {
        errors[docType] = "This document is required";
      }
    });

    setDocumentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Student Clearance Submission
            </h1>
            <p className="text-gray-600">
              Please fill out all required fields and upload the necessary
              documents for your clearance request.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Level Selection */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Academic Level
              </h2>
              <div className="w-full">
                <Label
                  htmlFor="level"
                  className="text-sm font-medium text-gray-700 mb-1 block"
                >
                  Select your academic level
                </Label>
                <Select
                  value={formData.level}
                  onValueChange={(value: Level) =>
                    handleInputChange("level", value)
                  }
                >
                  <SelectTrigger id="level" className="w-full">
                    <SelectValue placeholder="Choose level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="undergrad">Undergraduate</SelectItem>
                    <SelectItem value="grad">Graduate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Basic Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Full Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter your full name"
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      formData.studentId && formData.studentId.length < 4
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter your student ID"
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
                    required
                    value={formData.adviser}
                    onChange={(e) =>
                      handleInputChange("adviser", e.target.value)
                    }
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      formData.adviser && formData.adviser.length < 2
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter your adviser's name"
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      formData.course && formData.course.length < 2
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="e.g., BSIT, BSCS, MIT, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Please enter your course abbreviation (e.g., BSIT, BSCS,
                    MIT)
                  </p>
                </div>

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
                    required
                    value={formData.researchTitle}
                    onChange={(e) =>
                      handleInputChange("researchTitle", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter your research title"
                  />
                </div>
              </div>

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
                  <option value="Thesis">Thesis</option>
                  <option value="Capstone">Capstone</option>
                  <option value="Dissertation">Dissertation</option>
                </select>
              </div>
            </div>

            {/* Group Members (Undergraduate only) */}
            {formData.level === "undergrad" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Group Members
                  </h2>
                  <button
                    type="button"
                    onClick={addGroupMember}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm font-medium transition-colors"
                  >
                    + Add Member
                  </button>
                </div>

                {formData.groupMembers.map((member, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-md"
                  >
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter member name"
                      />
                    </div>
                    <div className="flex items-end space-x-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Student ID
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter student ID"
                        />
                      </div>
                      {formData.groupMembers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGroupMember(index)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Document Uploads */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Required Documents
              </h2>
              <p className="text-sm text-gray-600">
                Please upload all required documents. All files must be in the
                specified format and under 10MB each.
              </p>

              <div className="grid grid-cols-2 gap-6">
                <DocumentUpload
                  label="Approval Sheet"
                  accept=".pdf"
                  description="Upload the scanned approval sheet in PDF format."
                  file={formData.documents.approvalSheet}
                  onFileChange={(file) =>
                    handleDocumentChange("approvalSheet", file)
                  }
                  error={documentErrors.approvalSheet}
                />

                <DocumentUpload
                  label="Full Paper"
                  accept=".docx"
                  description="Upload the full paper in DOCX format. The ethics clearance must be included in the appendix."
                  file={formData.documents.fullPaper}
                  onFileChange={(file) =>
                    handleDocumentChange("fullPaper", file)
                  }
                  error={documentErrors.fullPaper}
                />

                <DocumentUpload
                  label="Long Abstract"
                  accept=".docx"
                  description="Upload the long abstract in DOCX format."
                  file={formData.documents.longAbstract}
                  onFileChange={(file) =>
                    handleDocumentChange("longAbstract", file)
                  }
                  error={documentErrors.longAbstract}
                />

                <DocumentUpload
                  label="Journal Format"
                  accept=".docx"
                  description="Upload the journal in DOCX format."
                  file={formData.documents.journalFormat}
                  onFileChange={(file) =>
                    handleDocumentChange("journalFormat", file)
                  }
                  error={documentErrors.journalFormat}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
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
