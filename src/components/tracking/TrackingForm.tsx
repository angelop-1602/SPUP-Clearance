"use client";

import React, { useState } from "react";
import { AlertCircle, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateDocumentId } from "@/utils/documentId";

interface TrackingFormProps {
  onTrack: (submissionId: string) => void;
  isLoading: boolean;
  error: string;
}

export function TrackingForm({ onTrack, isLoading, error }: TrackingFormProps) {
  const [submissionId, setSubmissionId] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextSubmissionId = submissionId.trim();
    setValidationError("");

    if (!nextSubmissionId) {
      setValidationError("Please enter your submission ID.");
      return;
    }

    if (!validateDocumentId(nextSubmissionId)) {
      setValidationError(
        "Invalid submission ID format. Use SPUP_Clearance_2025_ABC123."
      );
      return;
    }

    onTrack(nextSubmissionId);
  };

  const activeError = validationError || error;

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Find Your Submission
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Enter the tracking ID shown after submission to view or update the
              request while it is still under review.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="submissionId">Submission ID</Label>
            <Input
              id="submissionId"
              type="text"
              value={submissionId}
              onChange={(event) => {
                setSubmissionId(event.target.value);
                if (validationError) setValidationError("");
              }}
              placeholder="SPUP_Clearance_2025_ABC123"
              aria-invalid={Boolean(activeError)}
              disabled={isLoading}
            />
          </div>

          {activeError && (
            <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{activeError}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            <Search className="h-4 w-4" />
            {isLoading ? "Searching..." : "Track Submission"}
          </Button>
        </form>

        <div className="mt-5 rounded-md bg-gray-50 p-4 text-sm text-gray-600">
          Copy and paste the ID if possible. The format is
          `SPUP_Clearance_YEAR_XXXXXX`.
        </div>
      </div>
    </div>
  );
}
