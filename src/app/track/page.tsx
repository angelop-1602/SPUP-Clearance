"use client";

import React, { useState } from "react";

import { TrackingEditForm } from "@/components/tracking/TrackingEditForm";
import { TrackingForm } from "@/components/tracking/TrackingForm";
import { SubmissionStatus } from "@/components/tracking/SubmissionStatus";
import { Navigation } from "@/components/ui/Navigation";
import { getSubmissionById, updateTrackedSubmission } from "@/services/submissions";
import { Student, StudentFormData } from "@/types";

type TrackingMode = "search" | "view" | "edit";

export default function TrackPage() {
  const [submission, setSubmission] = useState<Student | null>(null);
  const [mode, setMode] = useState<TrackingMode>("search");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  const handleTrackSubmission = async (submissionId: string) => {
    setIsLoading(true);
    setError("");
    setSaveError("");
    setSubmission(null);
    setMode("search");

    try {
      const result = await getSubmissionById(submissionId);
      if (result) {
        setSubmission(result);
        setMode("view");
      } else {
        setError("Submission not found. Please check your submission ID.");
      }
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to track submission. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSubmission(null);
    setMode("search");
    setError("");
    setSaveError("");
  };

  const handleSave = async (formData: StudentFormData) => {
    if (!submission) return;

    setIsSaving(true);
    setSaveError("");

    try {
      const updatedSubmission = await updateTrackedSubmission(
        submission.id,
        formData
      );
      setSubmission(updatedSubmission);
      setMode("view");
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save changes. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="track" showAdminLink={false} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Student tracking</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Track Your Submission
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600">
            Use your submission ID to review the current status. If the request
            is still submitted, you can update details and replace files.
          </p>
        </div>

        {mode === "search" && (
          <TrackingForm
            onTrack={handleTrackSubmission}
            isLoading={isLoading}
            error={error}
          />
        )}

        {submission && mode === "view" && (
          <SubmissionStatus
            submission={submission}
            onReset={handleReset}
            onEdit={() => setMode("edit")}
            canEdit={submission.status === "Submitted"}
          />
        )}

        {submission && mode === "edit" && (
          <div className="mx-auto max-w-4xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6">
              <p className="text-sm font-medium text-primary">
                Editing submission
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                Update Your Clearance Request
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Submission ID:{" "}
                <span className="font-mono text-gray-900">{submission.id}</span>
              </p>
            </div>

            <TrackingEditForm
              submission={submission}
              isSaving={isSaving}
              saveError={saveError}
              onCancel={() => {
                setSaveError("");
                setMode("view");
              }}
              onSave={handleSave}
            />
          </div>
        )}
      </main>
    </div>
  );
}
