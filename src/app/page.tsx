"use client";

import React, { useState } from 'react';
import { StudentForm } from '@/components/forms/StudentForm';
import { Navigation } from '@/components/ui/Navigation';
import { submitStudentClearance } from '@/services/firebase';
import { StudentFormData } from '@/types';

export default function Home() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    documentId?: string;
    error?: string;
  } | null>(null);

  const handleSubmit = async (formData: StudentFormData) => {
    setIsSubmitting(true);
    try {
      const documentId = await submitStudentClearance(formData);
      setSubmissionResult({
        success: true,
        documentId,
      });
    } catch (error: unknown) {
      setSubmissionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Submission failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmissionResult(null);
    window.location.reload();
  };

  if (submissionResult?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Submission Successful!
          </h1>
          <p className="text-gray-600 mb-6">
            Your clearance request has been submitted successfully.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <p className="text-sm font-medium text-blue-800">
              Document ID:
            </p>
            <p className="text-sm text-blue-600 font-mono">
              {submissionResult.documentId}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Please save this ID for tracking your submission
            </p>
          </div>
          <div className="space-y-3">
            <a
              href="/track"
              className="w-full bg-primary hover:bg-primary/80 text-white font-medium py-3 px-4 rounded-md transition-colors inline-block"
            >
              Track This Submission
            </a>
            <button
              onClick={resetForm}
              className="w-full bg-primary hover:bg-primary/80 text-white font-medium py-3 px-4 rounded-md transition-colors"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submissionResult?.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 sm:p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Submission Failed
          </h1>
          <p className="text-gray-600 mb-6">
            {submissionResult.error}
          </p>
          <button
            onClick={resetForm}
            className="w-full bg-primary hover:bg-primary/80 text-white font-medium py-3 px-4 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

    return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="home" showAdminLink={false} />
      <main>
        <StudentForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </main>
    </div>
  );
}
