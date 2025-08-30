"use client";

import React, { useState, useEffect } from "react";
import { Student } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { updateSubmissionStatus, setSubmissionExportLink, clearSubmissionExportLink, markSubmissionAsExported } from "@/services/firebase";
import { downloadWithConfirmation } from "@/services/exportService";
import { toast } from "sonner";

interface SubmissionCardProps {
  submission: Student;
  onClose: () => void;
  onUpdate: () => void;
}

export function SubmissionCard({
  submission,
  onClose,
  onUpdate,
}: SubmissionCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [linkInput, setLinkInput] = useState(submission.exportLink || "");
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [currentExportLink, setCurrentExportLink] = useState(submission.exportLink || "");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setCurrentExportLink(submission.exportLink || "");
  }, [submission.exportLink]);

  const handleStatusUpdate = async (newStatus: "Submitted" | "Cleared") => {
    setIsUpdating(true);
    try {
      await updateSubmissionStatus(submission.id, newStatus);
      toast.success(`Status updated to ${newStatus}`);
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadZip = async () => {
    if (submission.isExported) {
      toast.info('This submission was already downloaded and removed from storage.');
      return;
    }
    
    setIsDownloading(true);
    try {
      // Step 1: Download the file immediately
      await downloadWithConfirmation(submission);
      toast.success(`Download started for ${submission.name}'s submission. Check your Downloads folder.`);
      
      // Step 2: Ask for confirmation to delete from storage
      const shouldDelete = window.confirm(
        `File downloaded successfully!\n\n` +
        `Do you want to remove it from Firebase Storage to save costs?\n\n` +
        `✅ File downloaded to your computer\n` +
        `🗑️ Remove from cloud storage (saves money)\n\n` +
        `WARNING: Once deleted from storage, the file cannot be downloaded again from the admin panel.`
      );
      
      if (shouldDelete) {
        await markSubmissionAsExported(submission.id, true);
        toast.success(`File removed from storage to save costs.`);
        onUpdate();
      } else {
        toast.info('File kept in storage. You can download it again later.');
      }
      
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-6 border-b border-gray-200">
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-col items-start">
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

          <div className="flex justify-between items-center mb-4 w-full">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <StatusBadge status={submission.status} />
            </div>
            <div className="flex space-x-2">
              {submission.isExported ? (
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-md">
                  <span className="text-sm text-gray-600">
                    File not available — already exported.
                  </span>
                  <button
                    type="button"
                    title="Set export link"
                    onClick={() => setIsEditingLink(true)}
                    className="ml-2 text-gray-600 hover:text-gray-800"
                  >
                    ✎
                  </button>
                  {currentExportLink && (
                    <>
                      <a
                        href={currentExportLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-3 text-blue-600 hover:underline text-sm"
                      >
                        Open link
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await clearSubmissionExportLink(submission.id);
                            setCurrentExportLink("");
                            toast.success('Export link removed');
                            onUpdate();
                          } catch (_) {
                            toast.error('Failed to remove export link');
                          }
                        }}
                        className="ml-2 text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove link
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleDownloadZip}
                  disabled={submission.isExported || isDownloading}
                  className="bg-primary hover:bg-primary text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <span>
                    {isDownloading ? "Downloading..." : submission.isExported ? "Already Downloaded" : `Download ZIP (${submission.id}.zip)`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and ZIP Download */}

          {/* Student Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                Student Information
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <p className="text-sm text-gray-900">{submission.name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <p className="text-sm text-gray-900">{submission.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Student ID
                  </label>
                  <p className="text-sm text-gray-900">
                    {submission.studentId}
                  </p>
                </div>

                                 <div>
                   <label className="block text-sm font-medium text-gray-700">
                     Course
                   </label>
                   <p className="text-sm text-gray-900">{submission.course}</p>
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700">
                     Graduation
                   </label>
                   <p className="text-sm text-gray-900">
                     {submission.graduationMonth} {submission.graduationYear}
                   </p>
                 </div>
 
                 <div>
                   <label className="block text-sm font-medium text-gray-700">
                     Level
                   </label>
                   <p className="text-sm text-gray-900 capitalize">
                     {submission.level}
                   </p>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                Research Information
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Research Title
                  </label>
                  <p className="text-sm text-gray-900">
                    {submission.researchTitle}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Research Type
                  </label>
                  <p className="text-sm text-gray-900">
                    {submission.researchType}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Adviser
                  </label>
                  <p className="text-sm text-gray-900">{submission.adviser}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Submitted At
                  </label>
                  <p className="text-sm text-gray-900">
                    {formatDate(submission.submittedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Group Members (if undergraduate) */}
          {submission.level === "undergrad" &&
            submission.groupMembers &&
            submission.groupMembers.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-3">
                  Group Members
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {submission.groupMembers.map((member, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm font-medium text-gray-900">
                        {member.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {member.studentID}
                      </p>
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

            {submission.status === "Submitted" && (
              <button
                onClick={() => handleStatusUpdate("Cleared")}
                disabled={isUpdating}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                  isUpdating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-primary hover:bg-primary-700"
                }`}
              >
                {isUpdating ? "Updating..." : "Mark as Cleared"}
              </button>
            )}

            {submission.status === "Cleared" && (
              <button
                onClick={() => handleStatusUpdate("Submitted")}
                disabled={isUpdating}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                  isUpdating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-yellow-600 hover:bg-yellow-700"
                }`}
              >
                {isUpdating ? "Updating..." : "Mark as Submitted"}
              </button>
            )}
          </div>

          {isEditingLink && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Set export link</h3>
                <input
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <div className="flex justify-between space-x-2">
                  {currentExportLink && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await clearSubmissionExportLink(submission.id);
                          toast.success('Export link removed');
                          setCurrentExportLink('');
                          setLinkInput('');
                          onUpdate();
                          setIsEditingLink(false);
                        } catch (_) {
                          toast.error('Failed to remove export link');
                        }
                      }}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
                      disabled={isSavingLink}
                    >
                      Remove link
                    </button>
                  )}
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingLink(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      disabled={isSavingLink}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!linkInput || !/^https?:\/\//i.test(linkInput)) {
                          toast.error('Please enter a valid URL starting with http or https');
                          return;
                        }
                        setIsSavingLink(true);
                        try {
                          await setSubmissionExportLink(submission.id, linkInput);
                          toast.success('Export link saved');
                          setCurrentExportLink(linkInput);
                          setIsEditingLink(false);
                          onUpdate();
                        } catch (e) {
                          toast.error('Failed to save export link');
                        } finally {
                          setIsSavingLink(false);
                        }
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-medium text-white ${isSavingLink ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                      disabled={isSavingLink}
                    >
                      {isSavingLink ? 'Saving...' : 'Save Link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
