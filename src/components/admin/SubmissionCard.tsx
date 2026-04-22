"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  GraduationCap,
  Link as LinkIcon,
  Mail,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { downloadWithConfirmation } from "@/services/exportService";
import {
  clearSubmissionExportLink,
  getSubmissionDownloadUrl,
  markSubmissionAsExported,
  setSubmissionExportLink,
  setUndergradAllClear,
  updateSubmissionStatus,
  updateUndergradParticipantClearance,
} from "@/services/submissions";
import { Student } from "@/types";
import { getUndergradClearanceState } from "@/utils/undergradClearance";
import {
  getResearchTypeLabel,
  isNotApplicableResearchType,
} from "@/utils/researchType";

interface SubmissionCardProps {
  submission: Student;
  onClose: () => void;
  onUpdate: () => void;
}

const zipCache = new Map<string, { zip: JSZip; entries: { path: string }[] }>();

function hasStoredFile(submission: Student): boolean {
  return Boolean(submission.zipFile || submission.zipPath);
}

function getFileExtension(path: string): string {
  const fileName = path.split("/").pop() ?? path;
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex < 0 ? "" : fileName.slice(dotIndex + 1).toLowerCase();
}

function getMimeType(path: string): string {
  const extension = getFileExtension(path);

  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "bmp") return "image/bmp";
  if (extension === "webp") return "image/webp";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "txt") return "text/plain";
  if (extension === "csv") return "text/csv";
  if (extension === "json") return "application/json";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function fileNameFromPath(path: string): string {
  return path.split("/").pop() || path;
}

function DetailItem({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`mt-2 text-sm text-gray-900 ${mono ? "break-all font-mono" : ""}`}
      >
        {value || "N/A"}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function SubmissionCard({ submission, onClose, onUpdate }: SubmissionCardProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingClearance, setIsUpdatingClearance] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [zipEntries, setZipEntries] = useState<{ path: string }[]>([]);
  const [zipObject, setZipObject] = useState<JSZip | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);

  const [isEditingLink, setIsEditingLink] = useState(false);
  const [linkInput, setLinkInput] = useState(submission.exportLink || "");
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [currentExportLink, setCurrentExportLink] = useState(
    submission.exportLink || ""
  );

  const undergradClearance = useMemo(() => {
    if (submission.level !== "undergrad") return null;
    return getUndergradClearanceState(submission);
  }, [submission]);
  const isNotApplicable = isNotApplicableResearchType(submission.researchType);

  useEffect(() => {
    setCurrentExportLink(submission.exportLink || "");
    setLinkInput(submission.exportLink || "");
  }, [submission.exportLink]);

  useEffect(() => {
    const cached = zipCache.get(submission.id);
    if (cached) {
      setZipEntries(cached.entries);
      setZipObject(cached.zip);
      return;
    }

    setZipEntries((submission.fileList ?? []).map((path) => ({ path })));
    setZipObject(null);
    setFilesError(null);
  }, [submission.fileList, submission.id]);

  const formatDate = (date?: Date) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const resolveZipDownloadUrl = useCallback(async (): Promise<string> => {
    if (submission.zipFile?.trim()) return submission.zipFile;
    return getSubmissionDownloadUrl(submission.id);
  }, [submission.id, submission.zipFile]);

  const fetchZipBlob = useCallback(async (downloadURL: string): Promise<Blob> => {
    let directError: unknown = null;

    try {
      const directResponse = await fetch(downloadURL, { cache: "no-store" });
      if (directResponse.ok) return directResponse.blob();
      directError = new Error(`Direct fetch failed (${directResponse.status})`);
    } catch (error) {
      directError = error;
    }

    try {
      const proxyResponse = await fetch("/api/download-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: downloadURL }),
      });

      if (!proxyResponse.ok) {
        const proxyErrorText = await proxyResponse.text();
        throw new Error(
          `Proxy fetch failed (${proxyResponse.status})${proxyErrorText ? `: ${proxyErrorText}` : ""}`
        );
      }

      return proxyResponse.blob();
    } catch (proxyError) {
      const directMessage =
        directError instanceof Error ? directError.message : "unknown direct fetch error";
      const proxyMessage =
        proxyError instanceof Error ? proxyError.message : "unknown proxy error";
      throw new Error(`Unable to load ZIP file. ${directMessage}; ${proxyMessage}`);
    }
  }, []);

  const loadZipContents = useCallback(async (): Promise<JSZip | null> => {
    const cached = zipCache.get(submission.id);
    if (cached) {
      setZipEntries(cached.entries);
      setZipObject(cached.zip);
      return cached.zip;
    }

    setIsLoadingFiles(true);
    setFilesError(null);

    try {
      const downloadURL = await resolveZipDownloadUrl();
      const blob = await fetchZipBlob(downloadURL);
      const loadedZip = await JSZip.loadAsync(blob);
      const entries: { path: string }[] = [];

      loadedZip.forEach((relativePath, entry) => {
        if (!entry.dir) entries.push({ path: relativePath });
      });

      entries.sort((a, b) => a.path.localeCompare(b.path));
      zipCache.set(submission.id, { zip: loadedZip, entries });
      setZipEntries(entries);
      setZipObject(loadedZip);
      return loadedZip;
    } catch (error) {
      console.error("Failed to load ZIP contents", error);
      setFilesError(
        error instanceof Error ? error.message : "Failed to load submitted files."
      );
      return null;
    } finally {
      setIsLoadingFiles(false);
    }
  }, [fetchZipBlob, resolveZipDownloadUrl, submission.id]);

  const handleOpenEntry = async (relativePath: string) => {
    const openedWindow = window.open("about:blank", "_blank");
    if (!openedWindow) {
      toast.error("Pop-up blocked. Allow pop-ups and try again.");
      return;
    }

    openedWindow.opener = null;
    openedWindow.document.write("<p style='font-family:sans-serif'>Opening document...</p>");

    try {
      const activeZip = zipObject ?? (await loadZipContents());
      if (!activeZip) throw new Error("Could not load ZIP archive.");

      const file = activeZip.file(relativePath);
      if (!file) throw new Error("File not found in ZIP archive.");

      const buffer = await file.async("arraybuffer");
      const blob = new Blob([buffer], { type: getMimeType(relativePath) });
      const url = URL.createObjectURL(blob);

      openedWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (error) {
      openedWindow.close();
      console.error("Failed to open file", error);
      toast.error(error instanceof Error ? error.message : "Failed to open file.");
    }
  };

  const handleDownloadEntry = async (relativePath: string) => {
    try {
      const activeZip = zipObject ?? (await loadZipContents());
      if (!activeZip) throw new Error("Could not load ZIP archive.");

      const file = activeZip.file(relativePath);
      if (!file) throw new Error("File not found in ZIP archive.");

      const blob = await file.async("blob");
      const sanitizedName = submission.name
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "_");
      const fileName = `${sanitizedName}_${submission.id}_${fileNameFromPath(relativePath)}`;
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download entry", error);
      toast.error(error instanceof Error ? error.message : "Failed to download file.");
    }
  };

  const handleDownloadZip = async () => {
    if (submission.isExported) {
      toast.info("This submission was already downloaded and removed from storage.");
      return;
    }

    if (!hasStoredFile(submission)) {
      toast.info("No ZIP file is attached to this submission.");
      return;
    }

    setIsDownloadingZip(true);
    try {
      await downloadWithConfirmation(submission);
      toast.success("Download started. Check your Downloads folder.");

      const shouldDelete = window.confirm(
        "File downloaded successfully.\n\nRemove this file from cloud storage to save costs?\n\nIf removed, it cannot be downloaded again from admin."
      );

      if (shouldDelete) {
        await markSubmissionAsExported(submission.id, true);
        toast.success("File removed from storage.");
        onUpdate();
      } else {
        toast.info("File kept in storage.");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file. Please try again.");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleStatusUpdate = async (newStatus: "Submitted" | "Cleared") => {
    setIsUpdatingStatus(true);
    try {
      await updateSubmissionStatus(submission.id, newStatus);
      toast.success(`Status updated to ${newStatus}`);
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status. Please try again.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleParticipantClearance = async (
    participantKey: "leader" | `member:${number}`,
    nextState: boolean
  ) => {
    setIsUpdatingClearance(true);
    try {
      await updateUndergradParticipantClearance(submission.id, participantKey, nextState);
      toast.success("Participant clearance updated.");
      onUpdate();
    } catch (error) {
      console.error("Failed to update participant clearance:", error);
      toast.error("Failed to update participant clearance.");
    } finally {
      setIsUpdatingClearance(false);
    }
  };

  const handleAllClear = async () => {
    setIsUpdatingClearance(true);
    try {
      await setUndergradAllClear(submission.id, true);
      toast.success("All participants marked as cleared.");
      onUpdate();
    } catch (error) {
      console.error("Failed to set all clear:", error);
      toast.error("Failed to set all-clear state.");
    } finally {
      setIsUpdatingClearance(false);
    }
  };

  const handleSaveExportLink = async () => {
    if (!linkInput || !/^https?:\/\//i.test(linkInput)) {
      toast.error("Please enter a valid URL starting with http or https.");
      return;
    }

    setIsSavingLink(true);
    try {
      await setSubmissionExportLink(submission.id, linkInput);
      setCurrentExportLink(linkInput);
      toast.success("Export link saved.");
      setIsEditingLink(false);
      onUpdate();
    } catch (error) {
      console.error("Failed to save export link", error);
      toast.error("Failed to save export link.");
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleRemoveExportLink = async () => {
    setIsSavingLink(true);
    try {
      await clearSubmissionExportLink(submission.id);
      setCurrentExportLink("");
      setLinkInput("");
      toast.success("Export link removed.");
      setIsEditingLink(false);
      onUpdate();
    } catch (error) {
      console.error("Failed to remove export link", error);
      toast.error("Failed to remove export link.");
    } finally {
      setIsSavingLink(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <header className="border-b border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  {submission.name}
                </h2>
                <StatusBadge status={submission.status} />
              </div>
              <p className="mt-1 break-all font-mono text-xs text-gray-500">
                {submission.id}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
              aria-label="Close submission details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {submission.isExported && currentExportLink ? (
              <a
                href={currentExportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4" />
                Open Export Link
              </a>
            ) : (
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isDownloadingZip || submission.isExported || !hasStoredFile(submission)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                <Download className="h-4 w-4" />
                {isDownloadingZip
                  ? "Downloading..."
                  : hasStoredFile(submission)
                    ? "Download ZIP"
                    : "No ZIP Attached"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditingLink(true)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <LinkIcon className="h-4 w-4" />
              {currentExportLink ? "Edit Export Link" : "Set Export Link"}
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-5 overflow-y-auto bg-gray-50 p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DetailItem
              label="Student ID"
              value={submission.studentId}
              icon={<UserRound className="h-4 w-4" />}
            />
            <DetailItem
              label="Email"
              value={submission.email}
              icon={<Mail className="h-4 w-4" />}
            />
            <DetailItem
              label="Submitted"
              value={formatDate(submission.submittedAt)}
              icon={<CalendarDays className="h-4 w-4" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
            <Section
              title="Academic Details"
              icon={<GraduationCap className="h-5 w-5 text-primary" />}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Level"
                  value={submission.level === "undergrad" ? "Undergraduate" : "Graduate"}
                />
                <DetailItem label="Course" value={submission.course} />
                <DetailItem
                  label="Graduation"
                  value={`${submission.graduationMonth || "N/A"} ${submission.graduationYear || ""}`}
                />
                <DetailItem
                  label="Last Updated"
                  value={formatDate(submission.updatedAt)}
                />
              </div>
            </Section>

            <Section title="Research" icon={<FileText className="h-5 w-5 text-primary" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Research Type"
                  value={getResearchTypeLabel(submission.researchType)}
                />
                <DetailItem
                  label="Adviser"
                  value={isNotApplicable ? "N/A" : submission.adviser || "N/A"}
                />
                <div className="sm:col-span-2">
                  <DetailItem
                    label="Research Title"
                    value={isNotApplicable ? "N/A" : submission.researchTitle || "N/A"}
                  />
                </div>
              </div>
            </Section>
          </div>

          {undergradClearance && (
            <Section
              title="Undergraduate Clearance"
              icon={<UsersRound className="h-5 w-5 text-primary" />}
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">
                  {undergradClearance.clearedCount} of {undergradClearance.totalCount} participants cleared.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void handleAllClear();
                  }}
                  disabled={isUpdatingClearance || undergradClearance.allCleared}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {undergradClearance.allCleared ? "All Cleared" : "All Clear"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {undergradClearance.participants.map((participant) => (
                  <div
                    key={participant.key}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {participant.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {participant.role === "leader" ? "Leader" : "Member"} - {participant.studentId}
                        </p>
                      </div>
                      <StatusBadge status={participant.isCleared ? "Cleared" : "Submitted"} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleToggleParticipantClearance(
                          participant.key,
                          !participant.isCleared
                        );
                      }}
                      disabled={isUpdatingClearance}
                      className={`mt-3 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 ${
                        participant.isCleared
                          ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                          : "bg-green-100 text-green-800 hover:bg-green-200"
                      }`}
                    >
                      {participant.isCleared ? "Mark Submitted" : "Mark Cleared"}
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Submitted Documents" icon={<FileArchive className="h-5 w-5 text-primary" />}>
            {submission.isExported ? (
              <p className="text-sm text-gray-600">
                Files are no longer available in storage because this submission has been exported.
              </p>
            ) : !hasStoredFile(submission) ? (
              <p className="text-sm text-gray-600">
                No submitted files are attached to this submission.
              </p>
            ) : (
              <div className="space-y-4">
                {isLoadingFiles && (
                  <p className="text-sm text-gray-600">Loading submitted files...</p>
                )}
                {filesError && <p className="text-sm text-red-600">{filesError}</p>}

                {!isLoadingFiles && !filesError && zipEntries.length === 0 && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-sm text-gray-700">
                      The file list is not loaded yet for this submission.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void loadZipContents();
                      }}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
                    >
                      Load Submitted Files
                    </button>
                  </div>
                )}

                {!isLoadingFiles && !filesError && zipEntries.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <ul className="max-h-80 divide-y divide-gray-200 overflow-auto">
                      {zipEntries.map((entry) => (
                        <li
                          key={entry.path}
                          className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="break-all font-mono text-sm text-gray-900">
                            {entry.path}
                          </span>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void handleOpenEntry(entry.path);
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleDownloadEntry(entry.path);
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Section>
        </main>

        <footer className="flex flex-col gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            {submission.level === "grad" && submission.status === "Submitted" && (
              <button
                type="button"
                onClick={() => {
                  void handleStatusUpdate("Cleared");
                }}
                disabled={isUpdatingStatus}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isUpdatingStatus ? "Updating..." : "Mark as Cleared"}
              </button>
            )}

            {submission.level === "grad" && submission.status === "Cleared" && (
              <button
                type="button"
                onClick={() => {
                  void handleStatusUpdate("Submitted");
                }}
                disabled={isUpdatingStatus}
                className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isUpdatingStatus ? "Updating..." : "Mark as Submitted"}
              </button>
            )}
          </div>
        </footer>
      </div>

      {isEditingLink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900">Set Export Link</h3>
            <p className="mt-1 text-sm text-gray-600">
              Use this when files have been exported elsewhere.
            </p>

            <input
              type="url"
              value={linkInput}
              onChange={(event) => setLinkInput(event.target.value)}
              placeholder="https://..."
              className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {currentExportLink && (
                <button
                  type="button"
                  onClick={() => {
                    void handleRemoveExportLink();
                  }}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  disabled={isSavingLink}
                >
                  Remove Link
                </button>
              )}

              <div className="flex gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => setIsEditingLink(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={isSavingLink}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveExportLink();
                  }}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  disabled={isSavingLink}
                >
                  {isSavingLink ? "Saving..." : "Save Link"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
