"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SubmissionCard } from "@/components/admin/SubmissionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import {
  deleteSubmission,
  onAuthStateChange,
  subscribeToSubmissions,
} from "@/services/submissions";
import { AdminUser, Student } from "@/types";
import { toast } from "sonner";

interface DuplicateGroup {
  key: string;
  submissions: Student[];
  matchedStudentIds: string[];
  matchedNames: string[];
}

function normalizeStudentId(studentId: string): string {
  return studentId.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
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

export default function DuplicateSubmissionsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [submissions, setSubmissions] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<Student | null>(
    null
  );
  const [submissionToDelete, setSubmissionToDelete] = useState<Student | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSubmissionIds, setDeletingSubmissionIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChange((nextUser) => {
      setUser(nextUser);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSubmissions([]);
      return;
    }

    const unsubscribe = subscribeToSubmissions((nextSubmissions) => {
      setSubmissions(nextSubmissions);
    });

    return () => unsubscribe();
  }, [user]);

  const duplicateGroups = useMemo(() => {
    if (submissions.length === 0) return [];

    const parent = submissions.map((_, index) => index);

    const find = (index: number): number => {
      if (parent[index] !== index) {
        parent[index] = find(parent[index]);
      }
      return parent[index];
    };

    const union = (a: number, b: number) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) {
        parent[rootB] = rootA;
      }
    };

    const studentIdIndexMap = new Map<string, number[]>();
    const nameIndexMap = new Map<string, number[]>();

    submissions.forEach((submission, index) => {
      const normalizedId = normalizeStudentId(submission.studentId || "");
      const normalizedName = normalizeName(submission.name || "");

      if (normalizedId) {
        const existing = studentIdIndexMap.get(normalizedId) ?? [];
        existing.push(index);
        studentIdIndexMap.set(normalizedId, existing);
      }

      if (normalizedName) {
        const existing = nameIndexMap.get(normalizedName) ?? [];
        existing.push(index);
        nameIndexMap.set(normalizedName, existing);
      }
    });

    const unionMatchingIndexes = (indexMap: Map<string, number[]>) => {
      indexMap.forEach((indexes) => {
        if (indexes.length < 2) return;
        const [first, ...rest] = indexes;
        rest.forEach((index) => union(first, index));
      });
    };

    unionMatchingIndexes(studentIdIndexMap);
    unionMatchingIndexes(nameIndexMap);

    const componentMap = new Map<number, Student[]>();
    submissions.forEach((submission, index) => {
      const root = find(index);
      const existing = componentMap.get(root) ?? [];
      existing.push(submission);
      componentMap.set(root, existing);
    });

    const duplicates: DuplicateGroup[] = Array.from(componentMap.entries())
      .filter(([, groupedSubmissions]) => groupedSubmissions.length > 1)
      .map(([root, groupedSubmissions]) => {
        const orderedSubmissions = [...groupedSubmissions].sort(
          (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
        );

        const studentIdCounts = new Map<string, number>();
        const nameCounts = new Map<string, number>();

        orderedSubmissions.forEach((submission) => {
          const normalizedId = normalizeStudentId(submission.studentId || "");
          const normalizedName = normalizeName(submission.name || "");
          if (normalizedId) {
            studentIdCounts.set(
              normalizedId,
              (studentIdCounts.get(normalizedId) ?? 0) + 1
            );
          }
          if (normalizedName) {
            nameCounts.set(
              normalizedName,
              (nameCounts.get(normalizedName) ?? 0) + 1
            );
          }
        });

        const matchedStudentIds = Array.from(studentIdCounts.entries())
          .filter(([, count]) => count > 1)
          .map(([normalizedId]) => {
            const match = orderedSubmissions.find(
              (submission) =>
                normalizeStudentId(submission.studentId || "") === normalizedId
            );
            return match?.studentId || normalizedId;
          });

        const matchedNames = Array.from(nameCounts.entries())
          .filter(([, count]) => count > 1)
          .map(([normalizedName]) => {
            const match = orderedSubmissions.find(
              (submission) =>
                normalizeName(submission.name || "") === normalizedName
            );
            return match?.name || normalizedName;
          });

        return {
          key: `group-${root}`,
          submissions: orderedSubmissions,
          matchedStudentIds,
          matchedNames,
        };
      })
      .sort((a, b) => {
        const latestA = a.submissions[0]?.submittedAt.getTime() ?? 0;
        const latestB = b.submissions[0]?.submittedAt.getTime() ?? 0;
        return latestB - latestA;
      });

    if (!searchTerm.trim()) {
      return duplicates;
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return duplicates.filter((group) => {
      if (
        group.matchedStudentIds.some((studentId) =>
          studentId.toLowerCase().includes(normalizedSearch)
        )
      ) {
        return true;
      }

      if (
        group.matchedNames.some((name) =>
          name.toLowerCase().includes(normalizedSearch)
        )
      ) {
        return true;
      }

      return group.submissions.some((submission) =>
        [
          submission.id,
          submission.name,
          submission.email,
          submission.studentId,
          submission.researchTitle,
          submission.course,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });
  }, [searchTerm, submissions]);

  const duplicateSubmissionCount = useMemo(
    () =>
      duplicateGroups.reduce(
        (count, group) => count + group.submissions.length,
        0
      ),
    [duplicateGroups]
  );

  const handleLogout = () => {
    setUser(null);
    setSubmissions([]);
    setSelectedSubmission(null);
  };

  const handleLoginSuccess = (nextUser: AdminUser) => {
    setUser(nextUser);
  };

  const handleSubmissionUpdate = () => {
    // The local listener handles updates.
  };

  const handleDeleteClick = (submission: Student) => {
    if (deletingSubmissionIds.has(submission.id)) return;
    setSubmissionToDelete(submission);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSubmission = async () => {
    const targetSubmission = submissionToDelete;
    if (!targetSubmission) return;
    if (deletingSubmissionIds.has(targetSubmission.id)) return;

    setDeletingSubmissionIds((prev) => new Set(prev).add(targetSubmission.id));
    toast.loading(`Deleting ${targetSubmission.name}'s submission...`, {
      id: `delete-${targetSubmission.id}`,
    });

    const previousSubmissions = submissions;
    setSubmissions((prev) =>
      prev.filter((item) => item.id !== targetSubmission.id)
    );

    if (selectedSubmission?.id === targetSubmission.id) {
      setSelectedSubmission(null);
    }

    try {
      await deleteSubmission(targetSubmission.id);
      toast.success("Submission deleted.", { id: `delete-${targetSubmission.id}` });
    } catch (error) {
      console.error("Delete error:", error);
      setSubmissions(previousSubmissions);
      toast.error("Failed to delete submission.", {
        id: `delete-${targetSubmission.id}`,
      });
    } finally {
      setDeletingSubmissionIds((prev) => {
        const next = new Set(prev);
        next.delete(targetSubmission.id);
        return next;
      });
      setSubmissionToDelete(null);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AdminLayout
      user={user}
      onLogout={handleLogout}
      currentPage="admin-duplicates"
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Duplicate Submissions
            </h1>
            <p className="text-gray-600 mt-1">
              Review submissions with the same student ID or the same name.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-red-600">
              {duplicateGroups.length}
            </div>
            <div className="text-sm text-gray-600">Duplicate Groups</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-orange-600">
              {duplicateSubmissionCount}
            </div>
            <div className="text-sm text-gray-600">Duplicate Submissions</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">
              {submissions.length}
            </div>
            <div className="text-sm text-gray-600">Total Submissions</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <label
            htmlFor="duplicates-search"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Search duplicate groups
          </label>
          <input
            id="duplicates-search"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by student ID, name, email, course, title, or submission ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-4">
          {duplicateGroups.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No duplicate submissions found.
            </div>
          ) : (
            duplicateGroups.map((group) => (
              <div key={group.key} className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Duplicate Group
                    </h2>
                    <p className="text-sm text-gray-600">
                      {group.submissions.length} submissions found
                    </p>
                    {group.matchedStudentIds.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Matching Student ID: {group.matchedStudentIds.join(", ")}
                      </p>
                    )}
                    {group.matchedNames.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Matching Name: {group.matchedNames.join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Latest: {formatDate(group.submissions[0].submittedAt)}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submission ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name / Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Course / Level
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {group.submissions.map((submission) => (
                        <tr key={submission.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-700">
                            {submission.id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <p className="font-medium text-gray-900">
                              {submission.name}
                            </p>
                            <p className="text-gray-500">{submission.email}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <p>{submission.course}</p>
                            <p className="text-gray-500 capitalize">
                              {submission.level}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={submission.status} />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {formatDate(submission.submittedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedSubmission(submission)}
                                disabled={deletingSubmissionIds.has(submission.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                View Details
                              </button>
                              <button
                                onClick={() => handleDeleteClick(submission)}
                                disabled={deletingSubmissionIds.has(submission.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                {deletingSubmissionIds.has(submission.id)
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedSubmission && (
          <SubmissionCard
            submission={selectedSubmission}
            onClose={() => setSelectedSubmission(null)}
            onUpdate={handleSubmissionUpdate}
          />
        )}

        <ConfirmationDialog
          isOpen={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setSubmissionToDelete(null);
            }
          }}
          title="Delete Submission"
          description={`Are you sure you want to delete ${submissionToDelete?.name}'s submission?\n\nThis action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => {
            void handleDeleteSubmission();
          }}
          variant="destructive"
        />
      </div>
    </AdminLayout>
  );
}
