"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Navigation } from "@/components/ui/Navigation";
import { db } from "@/lib/firebase";
import { Student } from "@/types";

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function CoordinatorsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [submissions, setSubmissions] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const submissionsQuery = query(
      collection(db, "submissions"),
      orderBy("submittedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const realtimeSubmissions = snapshot.docs.map((submissionDoc) => {
          const data = submissionDoc.data();
          return {
            ...data,
            id: submissionDoc.id,
            submittedAt: data.submittedAt?.toDate?.() ?? new Date(),
            updatedAt: data.updatedAt?.toDate?.(),
            exportedAt: data.exportedAt?.toDate?.(),
            exportLink: data.exportLink || undefined,
          } as Student;
        });

        setSubmissions(realtimeSubmissions);
        setLoadError("");
        setIsLoading(false);
      },
      (error) => {
        console.error("Coordinator lookup listener error:", error);
        setLoadError("Failed to load submissions. Please refresh and try again.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const normalizedSearchTerm = normalizeValue(searchTerm);
  const hasSearch = normalizedSearchTerm.length > 0;

  const matchingSubmissions = useMemo(() => {
    if (!hasSearch) return [];

    return submissions.filter((submission) => {
      const normalizedStudentId = normalizeValue(submission.studentId || "");
      const normalizedName = normalizeValue(submission.name || "");

      return (
        normalizedStudentId.includes(normalizedSearchTerm) ||
        normalizedName.includes(normalizedSearchTerm)
      );
    });
  }, [hasSearch, normalizedSearchTerm, submissions]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="coordinators" showAdminLink={false} />

      <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Coordinator Submission Lookup
            </h1>
            <p className="text-gray-600 mt-2">
              Search by student or leader name, or student ID, to check if a submission
              already exists.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="coordinator-search"
              className="block text-sm font-medium text-gray-700"
            >
              Student/Leader Name or Student ID
            </label>
            <input
              id="coordinator-search"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="e.g. Juan Dela Cruz or 2021-12345"
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {isLoading && (
            <p className="mt-6 text-sm text-gray-500">Loading submissions...</p>
          )}

          {loadError && (
            <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && hasSearch && (
            <div className="mt-6">
              {matchingSubmissions.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    Found {matchingSubmissions.length} matching submission
                    {matchingSubmissions.length > 1 ? "s" : ""}.
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student ID
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Level
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Submitted At
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Submission ID
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {matchingSubmissions.map((submission) => (
                          <tr key={submission.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {submission.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {submission.studentId}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                              {submission.level}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  submission.status === "Cleared"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {submission.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatDate(submission.submittedAt)}
                            </td>
                            <td className="px-4 py-3 text-xs font-mono text-gray-700 break-all">
                              {submission.id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                  No submission found for this search.
                </div>
              )}
            </div>
          )}

          {!isLoading && !loadError && !hasSearch && (
            <p className="mt-6 text-sm text-gray-500">
              Enter a name or student ID to start searching.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
