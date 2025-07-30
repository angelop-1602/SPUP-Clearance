"use client";

import React from "react";
import Link from "next/link";
import { Student } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface SubmissionStatusProps {
  submission: Student;
  onReset: () => void;
}

export function SubmissionStatus({
  submission,
  onReset,
}: SubmissionStatusProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatusMessage = () => {
    switch (submission.status) {
      case "Submitted":
        return {
          icon: "⏳",
          title: "Under Review",
          message:
            "Your submission is being reviewed by the administration. Please check back later for updates.",
          color: "text-yellow-700",
        };
      case "Cleared":
        return {
          icon: "✅",
          title: "Cleared",
          message:
            "Congratulations! Your clearance has been approved. You may proceed with your next steps.",
          color: "text-green-900",
        };
      default:
        return {
          icon: "📄",
          title: "Submitted",
          message: "Your submission has been received.",
          color: "text-gray-700",
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Status Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-8 text-white text-center">
          <div className="text-5xl mb-4">{statusInfo.icon}</div>

          <h2 className={`text-2xl font-bold mb-2 ${statusInfo.color}`}>
            {statusInfo.title}
          </h2>

          <p className={`mb-4 ${statusInfo.color}`}>{statusInfo.message}</p>

          <div className="inline-flex items-center bg-white rounded-full px-4 py-2">
            <StatusBadge status={submission.status} />
          </div>
        </div>

        {/* Submission Details */}
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                Submission Information
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Submission ID
                  </label>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                    {submission.id}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Submitted On
                  </label>
                  <p className="text-sm text-gray-900">
                    {formatDate(submission.submittedAt)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Student Name
                  </label>
                  <p className="text-sm text-gray-900">{submission.name}</p>
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
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                Research Details
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
                    Academic Level
                  </label>
                  <p className="text-sm text-gray-900 capitalize">
                    {submission.level}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Adviser
                  </label>
                  <p className="text-sm text-gray-900">{submission.adviser}</p>
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
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* Next Steps */}
          <div className="bg-primary-50 border border-primary-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-primary-800 mb-2">
              📋 Next Steps:
            </h4>
            <ul className="text-sm text-primary-700 space-y-1">
              {submission.status === "Submitted" && (
                <>
                  <li>• Your submission is under review</li>
                  <li>• You will be notified once the review is complete</li>
                  <li>• No further action required at this time</li>
                </>
              )}
              {submission.status === "Cleared" && (
                <>
                  <li>• Your clearance is approved!</li>
                  <li>• You may proceed with your graduation requirements</li>
                  <li>• Contact your department for the next steps</li>
                </>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onReset}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Track Another Submission
            </button>
            <Link
              href="/"
              className="flex-1 text-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Submit New Request
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
