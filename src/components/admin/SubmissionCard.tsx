"use client";

import React, { useState } from 'react';
import { Student } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { updateSubmissionStatus } from '@/services/firebase';

interface SubmissionCardProps {
  submission: Student;
  onClose: () => void;
  onUpdate: () => void;
}

export function SubmissionCard({ submission, onClose, onUpdate }: SubmissionCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusUpdate = async (newStatus: 'Submitted' | 'Cleared') => {
    setIsUpdating(true);
    try {
      await updateSubmissionStatus(submission.id, newStatus);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadZip = () => {
    if (submission.zipFile) {
      window.open(submission.zipFile, '_blank');
    } else {
      alert('ZIP file not available');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Submission Details
            </h2>
            <p className="text-sm text-gray-600">ID: {submission.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and ZIP Download */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <StatusBadge status={submission.status} />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownloadZip}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <span>📦</span>
                  <span>Download ZIP ({submission.id}.zip)</span>
                </button>
              </div>
            </div>

            {/* ZIP File Information */}
            <div className="text-xs text-gray-600 bg-white rounded p-3">
              <p className="font-medium mb-2">📁 ZIP file contains:</p>
              <ul className="space-y-1 ml-4">
                <li>• approval_sheet.pdf</li>
                <li>• full_paper.docx (includes ethics clearance in appendix)</li>
                <li>• long_abstract.docx</li>
                <li>• journal_format.docx</li>
              </ul>
            </div>
          </div>

          {/* Student Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                Student Information
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="text-sm text-gray-900">{submission.name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="text-sm text-gray-900">{submission.email}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Student ID</label>
                  <p className="text-sm text-gray-900">{submission.studentId}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Course</label>
                  <p className="text-sm text-gray-900">{submission.course}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Level</label>
                  <p className="text-sm text-gray-900 capitalize">{submission.level}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                Research Information
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Research Title</label>
                  <p className="text-sm text-gray-900">{submission.researchTitle}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Research Type</label>
                  <p className="text-sm text-gray-900">{submission.researchType}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Adviser</label>
                  <p className="text-sm text-gray-900">{submission.adviser}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Submitted At</label>
                  <p className="text-sm text-gray-900">{formatDate(submission.submittedAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Group Members (if undergraduate) */}
          {submission.level === 'undergrad' && submission.groupMembers && submission.groupMembers.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-3">
                Group Members
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {submission.groupMembers.map((member, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-600">{member.studentID}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            
            {submission.status === 'Submitted' && (
              <button
                onClick={() => handleStatusUpdate('Cleared')}
                disabled={isUpdating}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                  isUpdating 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary-700'
                }`}
              >
                {isUpdating ? 'Updating...' : 'Mark as Cleared'}
              </button>
            )}
            
            {submission.status === 'Cleared' && (
              <button
                onClick={() => handleStatusUpdate('Submitted')}
                disabled={isUpdating}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                  isUpdating 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                {isUpdating ? 'Updating...' : 'Mark as Submitted'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 