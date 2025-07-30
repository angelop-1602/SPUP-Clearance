"use client";

import React, { useState } from 'react';
import { validateDocumentId } from '@/utils/documentId';

interface TrackingFormProps {
  onTrack: (submissionId: string) => void;
  isLoading: boolean;
  error: string;
}

export function TrackingForm({ onTrack, isLoading, error }: TrackingFormProps) {
  const [submissionId, setSubmissionId] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!submissionId.trim()) {
      setValidationError('Please enter your submission ID');
      return;
    }

    // Validate the submission ID format
    if (!validateDocumentId(submissionId.trim())) {
      setValidationError('Invalid submission ID format. It should be like: SPUP_Clearance_2025_ABC123');
      return;
    }

    onTrack(submissionId.trim());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSubmissionId(value);
    
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError('');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-0">
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Enter Your Submission ID
          </h3>
          <p className="text-sm text-gray-600">
            You received this ID when you submitted your clearance request
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="submissionId" className="block text-sm font-medium text-gray-700 mb-2">
              Submission ID *
            </label>
            <input
              id="submissionId"
              type="text"
              value={submissionId}
              onChange={handleInputChange}
              placeholder="SPUP_Clearance_2025_ABC123"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                validationError || error ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isLoading}
            />
            {validationError && (
              <p className="text-red-600 text-sm mt-1">{validationError}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-md text-white font-medium transition-colors ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500'
            }`}
          >
            {isLoading ? 'Tracking...' : 'Track Submission'}
          </button>
        </form>

        <div className=" p-4 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">💡 Tips:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Copy and paste to avoid typing errors</li>
            <li>• Format: SPUP_Clearance_YEAR_XXXXXX</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 