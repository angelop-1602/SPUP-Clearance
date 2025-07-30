"use client";

import React, { useState } from 'react';
import { TrackingForm } from '@/components/tracking/TrackingForm';
import { SubmissionStatus } from '@/components/tracking/SubmissionStatus';
import { Navigation } from '@/components/ui/Navigation';
import { getSubmissionById } from '@/services/firebase';
import { Student } from '@/types';

export default function TrackPage() {
  const [submission, setSubmission] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleTrackSubmission = async (submissionId: string) => {
    setIsLoading(true);
    setError('');
    setSubmission(null);

    try {
      const result = await getSubmissionById(submissionId);
      if (result) {
        setSubmission(result);
      } else {
        setError('Submission not found. Please check your submission ID and try again.');
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to track submission. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSubmission(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="track" showAdminLink={false} />
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Track Your Submission
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Enter your submission ID to check the status of your clearance request. 
            Your submission ID follows the format: <code className="bg-gray-100 px-2 py-1 rounded text-sm">SPUP_Clearance_YYYY_ABC123</code>
          </p>
        </div>

        {!submission ? (
          <TrackingForm 
            onTrack={handleTrackSubmission}
            isLoading={isLoading}
            error={error}
          />
        ) : (
          <SubmissionStatus 
            submission={submission}
            onReset={handleReset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16 fixed bottom-0 w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>&copy; 2025 Student Clearance System. All rights reserved.</p>
            <p className="mt-2">
              For assistance, please contact: <a href="mailto:cprint@spup.edu.ph" className="text-primary-600 hover:text-primary-800">cprint@spup.edu.ph</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
} 