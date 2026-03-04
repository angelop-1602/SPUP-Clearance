"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { ref, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import Image from "next/image";
import { storage } from "@/lib/firebase";
import { Student } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { downloadWithConfirmation } from "@/services/exportService";
import {
  clearSubmissionExportLink,
  markSubmissionAsExported,
  setSubmissionExportLink,
  setUndergradAllClear,
  updateSubmissionStatus,
  updateUndergradParticipantClearance,
} from "@/services/firebase";
import { getUndergradClearanceState } from "@/utils/undergradClearance";

interface SubmissionCardProps {
  submission: Student;
  onClose: () => void;
  onUpdate: () => void;
}

type PreviewType = "none" | "pdf" | "image" | "text" | "unsupported";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json", "log", "xml", "yaml", "yml", "tsv"]);
const zipCache = new Map<string, { zip: JSZip; entries: { path: string }[] }>();

function getFileExtension(path: string): string {
  const fileName = path.split("/").pop() ?? path;
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function getPreviewType(path: string): PreviewType {
  const extension = getFileExtension(path);
  if (extension === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  return "unsupported";
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

function getMimeType(path: string, type: PreviewType): string {
  if (type === "pdf") return "application/pdf";
  if (type === "image") {
    const extension = getFileExtension(path);
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "png") return "image/png";
    if (extension === "gif") return "image/gif";
    if (extension === "bmp") return "image/bmp";
    if (extension === "webp") return "image/webp";
    if (extension === "svg") return "image/svg+xml";
    return "image/*";
  }
  if (type === "text") return "text/plain";
  return "application/octet-stream";
}

export function SubmissionCard({ submission, onClose, onUpdate }: SubmissionCardProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingClearance, setIsUpdatingClearance] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [isEditingLink, setIsEditingLink] = useState(false);
  const [linkInput, setLinkInput] = useState(submission.exportLink || "");
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [currentExportLink, setCurrentExportLink] = useState(submission.exportLink || "");

  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [zipEntries, setZipEntries] = useState<{ path: string }[]>([]);
  const [zipObject, setZipObject] = useState<JSZip | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);

  const [selectedPreviewPath, setSelectedPreviewPath] = useState("");
  const [previewType, setPreviewTypeState] = useState<PreviewType>("none");
  const [previewText, setPreviewText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  const undergradClearance = useMemo(() => {
    if (submission.level !== "undergrad") return null;
    return getUndergradClearanceState(submission);
  }, [submission]);

  const releasePreviewUrl = useCallback(() => {
    setPreviewUrl((existing) => {
      if (existing) URL.revokeObjectURL(existing);
      return null;
    });
  }, []);

  useEffect(() => {
    setCurrentExportLink(submission.exportLink || "");
    setLinkInput(submission.exportLink || "");
  }, [submission.exportLink]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  const resolveZipDownloadUrl = useCallback(async (): Promise<string> => {
    if (submission.zipFile?.trim()) {
      return submission.zipFile;
    }

    const sanitizedName = submission.name
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");
    const storageFileName = `${sanitizedName}_${submission.id}.zip`;
    const fileRef = ref(storage, `submissions/${storageFileName}`);
    return getDownloadURL(fileRef);
  }, [submission.id, submission.name, submission.zipFile]);

  const fetchZipBlob = useCallback(async (downloadURL: string): Promise<Blob> => {
    let directError: unknown = null;

    try {
      const directResponse = await fetch(downloadURL, { cache: "no-store" });
      if (directResponse.ok) {
        return directResponse.blob();
      }
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
    } catch (error: unknown) {
      console.error("Failed to load ZIP contents", error);
      setFilesError(
        error instanceof Error ? error.message : "Failed to load submitted files."
      );
      return null;
    } finally {
      setIsLoadingFiles(false);
    }
  }, [fetchZipBlob, resolveZipDownloadUrl, submission.id]);

  const handlePreviewFile = useCallback(async (path: string) => {
    setSelectedPreviewPath(path);
    setPreviewError(null);
    setPreviewText("");
    setIsLoadingPreview(true);
    releasePreviewUrl();

    try {
      const activeZip = zipObject ?? (await loadZipContents());
      if (!activeZip) {
        throw new Error("Could not load ZIP archive for preview.");
      }

      const file = activeZip.file(path);
      if (!file) throw new Error("File not found in ZIP archive.");

      const fileBuffer = await file.async("arraybuffer");
      const bytes = new Uint8Array(fileBuffer);

      let type = getPreviewType(path);
      if (hasPdfSignature(bytes)) {
        type = "pdf";
      }
      setPreviewTypeState(type);

      if (type === "unsupported") {
        return;
      }

      if (type === "text") {
        const text = new TextDecoder("utf-8").decode(fileBuffer);
        setPreviewText(text);
        return;
      }

      const blob = new Blob([fileBuffer], { type: getMimeType(path, type) });
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error: unknown) {
      console.error("Failed to preview file", error);
      setPreviewError(error instanceof Error ? error.message : "Failed to preview file.");
    } finally {
      setIsLoadingPreview(false);
    }
  }, [loadZipContents, releasePreviewUrl, zipObject]);

  const openPreviewDialog = (path: string) => {
    setIsPreviewDialogOpen(true);
    void handlePreviewFile(path);
  };

  const closePreviewDialog = () => {
    setIsPreviewDialogOpen(false);
    setSelectedPreviewPath("");
    setPreviewTypeState("none");
    setPreviewText("");
    setPreviewError(null);
    releasePreviewUrl();
  };

  const downloadEntry = async (relativePath: string) => {
    try {
      const activeZip = zipObject ?? (await loadZipContents());
      if (!activeZip) {
        throw new Error("Could not load ZIP archive for download.");
      }
      const file = activeZip.file(relativePath);
      if (!file) return;

      const blob = await file.async("blob");
      const sanitizedName = submission.name.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
      const baseName = relativePath.split("/").pop() || "file";
      const fileName = `${sanitizedName}_${submission.id}_${baseName}`;
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
      toast.error("Failed to download file.");
    }
  };

  useEffect(() => {
    setSelectedPreviewPath("");
    setPreviewTypeState("none");
    setPreviewText("");
    setPreviewError(null);
    releasePreviewUrl();

    const cached = zipCache.get(submission.id);
    if (cached) {
      setZipEntries(cached.entries);
      setZipObject(cached.zip);
      return;
    }

    const listedFiles = (submission.fileList ?? []).map((path) => ({ path }));
    setZipEntries(listedFiles);
    setZipObject(null);
  }, [releasePreviewUrl, submission.fileList, submission.id]);

  const handleDownloadZip = async () => {
    if (submission.isExported) {
      toast.info("This submission was already downloaded and removed from storage.");
      return;
    }

    setIsDownloading(true);
    try {
      await downloadWithConfirmation(submission);
      toast.success(`Download started for ${submission.name}'s submission. Check your Downloads folder.`);

      const shouldDelete = window.confirm(
        "File downloaded successfully.\n\nRemove this file from Firebase Storage to save costs?\n\nIf removed, it cannot be downloaded again from admin."
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
      setIsDownloading(false);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-screen overflow-y-auto">
        <div className="flex flex-col items-center px-6 pt-6 border-b border-gray-200">
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-col items-start">
              <h2 className="text-xl font-semibold text-gray-900">Submission Details</h2>
              <p className="text-sm text-gray-600">ID: {submission.id}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">X</button>
          </div>

          <div className="flex justify-between items-center mb-4 w-full gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <StatusBadge status={submission.status} />
            </div>

            <div className="flex space-x-2">
              {submission.isExported ? (
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-md">
                  <span className="text-sm text-gray-600">File unavailable (already exported)</span>
                  <button type="button" onClick={() => setIsEditingLink(true)} className="ml-2 text-gray-600 hover:text-gray-800">Edit Link</button>
                </div>
              ) : (
                <button
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {isDownloading ? "Downloading..." : `Download ZIP (${submission.id}.zip)`}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Submission Metadata</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Submission ID</p>
                  <p className="text-gray-900 font-mono break-all">{submission.id}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Status</p>
                  <div className="mt-1"><StatusBadge status={submission.status} /></div>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Academic Level</p>
                  <p className="text-gray-900 capitalize">{submission.level}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Submitted At</p>
                  <p className="text-gray-900">{formatDate(submission.submittedAt)}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Last Updated</p>
                  <p className="text-gray-900">{formatDate(submission.updatedAt)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Basic Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-700">{submission.level === "undergrad" ? "Leader Name" : "Full Name"}</p>
                  <p className="text-gray-900">{submission.name || "N/A"}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Email</p>
                  <p className="text-gray-900">{submission.email || "N/A"}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Student ID</p>
                  <p className="text-gray-900">{submission.studentId || "N/A"}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Course</p>
                  <p className="text-gray-900">{submission.course || "N/A"}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Graduation</p>
                  <p className="text-gray-900">{submission.graduationMonth || "N/A"} {submission.graduationYear || ""}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Research Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Research Type</p>
                  <p className="text-gray-900">{submission.researchType || "N/A"}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Research Title</p>
                  <p className="text-gray-900">{submission.researchTitle || "N/A"}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Adviser</p>
                  <p className="text-gray-900">{submission.adviser || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {undergradClearance && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-2">
                <h3 className="text-lg font-medium text-gray-900">Undergraduate Clearance Progress</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{undergradClearance.clearedCount} / {undergradClearance.totalCount} cleared</span>
                  <button
                    type="button"
                    onClick={() => { void handleAllClear(); }}
                    disabled={isUpdatingClearance || undergradClearance.allCleared}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {undergradClearance.allCleared ? "All Cleared" : "All Clear"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {undergradClearance.participants.map((participant) => (
                  <div key={participant.key} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{participant.name}</p>
                        <p className="text-xs text-gray-600">{participant.role === "leader" ? "Leader" : "Member"} - {participant.studentId}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { void handleToggleParticipantClearance(participant.key, !participant.isCleared); }}
                        disabled={isUpdatingClearance}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium ${participant.isCleared ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" : "bg-green-100 text-green-800 hover:bg-green-200"} disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed`}
                      >
                        {participant.isCleared ? "Mark Submitted" : "Mark Cleared"}
                      </button>
                    </div>
                    <div className="mt-2"><StatusBadge status={participant.isCleared ? "Cleared" : "Submitted"} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Submitted Files</h3>
            {submission.isExported ? (
              <p className="text-sm text-gray-600">Files are no longer available in storage (already exported).</p>
            ) : (
              <div className="space-y-4">
                {isLoadingFiles && <p className="text-sm text-gray-600">Loading submitted files...</p>}
                {filesError && <p className="text-sm text-red-600">{filesError}</p>}
                {!isLoadingFiles && !filesError && zipEntries.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Tip: First preview/download may take a moment while the ZIP archive is loaded.
                  </p>
                )}

                {!isLoadingFiles && !filesError && zipEntries.length === 0 && (
                  <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                    <p className="text-sm text-gray-700 mb-3">
                      File list is not loaded yet for this submission.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void loadZipContents();
                      }}
                      className="px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Load Submitted Files
                    </button>
                  </div>
                )}

                {!isLoadingFiles && !filesError && zipEntries.length > 0 && (
                  <div className="border border-gray-200 rounded-md max-h-80 overflow-auto">
                    <ul className="divide-y divide-gray-200">
                      {zipEntries.map((entry) => (
                        <li key={entry.path} className="p-3 text-sm flex items-start justify-between gap-2">
                          <span className="font-mono text-gray-900 break-all">{entry.path}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openPreviewDialog(entry.path)}
                              className="px-2 py-1 rounded-md text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => { void downloadEntry(entry.path); }}
                              className="px-2 py-1 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
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
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Close
            </button>

            {submission.level === "grad" && submission.status === "Submitted" && (
              <button
                onClick={() => { void handleStatusUpdate("Cleared"); }}
                disabled={isUpdatingStatus}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${isUpdatingStatus ? "bg-gray-400 cursor-not-allowed" : "bg-primary hover:bg-primary/80"}`}
              >
                {isUpdatingStatus ? "Updating..." : "Mark as Cleared"}
              </button>
            )}

            {submission.level === "grad" && submission.status === "Cleared" && (
              <button
                onClick={() => { void handleStatusUpdate("Submitted"); }}
                disabled={isUpdatingStatus}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${isUpdatingStatus ? "bg-gray-400 cursor-not-allowed" : "bg-yellow-600 hover:bg-yellow-700"}`}
              >
                {isUpdatingStatus ? "Updating..." : "Mark as Submitted"}
              </button>
            )}
          </div>

          {isPreviewDialogOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[65] p-2 sm:p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Document Preview</h3>
                    <p className="text-xs text-gray-500">PDF, image, and text files are previewable.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closePreviewDialog}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Close Preview
                  </button>
                </div>

                <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
                  <div className="lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-auto">
                    <ul className="divide-y divide-gray-200">
                      {zipEntries.map((entry) => (
                        <li key={`preview-${entry.path}`}>
                          <button
                            type="button"
                            onClick={() => {
                              void handlePreviewFile(entry.path);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm ${
                              selectedPreviewPath === entry.path
                                ? "bg-blue-50 text-blue-700"
                                : "hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <span className="font-mono break-all">{entry.path}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex-1 p-4 overflow-auto">
                    <p className="text-xs text-gray-500 mb-2 break-all">
                      {selectedPreviewPath
                        ? `Preview: ${selectedPreviewPath}`
                        : "Select a file from the list."}
                    </p>

                    {isLoadingPreview && (
                      <p className="text-sm text-gray-600">Loading preview...</p>
                    )}

                    {previewError && (
                      <p className="text-sm text-red-600">{previewError}</p>
                    )}

                    {!isLoadingPreview && !previewError && previewType === "none" && (
                      <p className="text-sm text-gray-500">
                        Select a file from the left panel to preview.
                      </p>
                    )}

                    {!isLoadingPreview &&
                      !previewError &&
                      previewType === "unsupported" && (
                        <p className="text-sm text-gray-500">
                          Preview is not available for this file type. Use Download.
                        </p>
                      )}

                    {!isLoadingPreview &&
                      !previewError &&
                      previewType === "pdf" &&
                      previewUrl && (
                        <iframe
                          title="PDF preview"
                          src={previewUrl}
                          className="w-full h-[62vh] border border-gray-200 rounded-md"
                        />
                      )}

                    {!isLoadingPreview &&
                      !previewError &&
                      previewType === "image" &&
                      previewUrl && (
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                          <Image
                            src={previewUrl}
                            alt="File preview"
                            width={1200}
                            height={800}
                            unoptimized
                            className="max-h-[62vh] w-full object-contain"
                          />
                        </div>
                      )}

                    {!isLoadingPreview &&
                      !previewError &&
                      previewType === "text" && (
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded-md p-3 max-h-[62vh] overflow-auto">
                          {previewText}
                        </pre>
                      )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isEditingLink && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 sm:p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Set export link</h3>
                <input
                  type="url"
                  value={linkInput}
                  onChange={(event) => setLinkInput(event.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <div className="flex justify-between gap-2">
                  {currentExportLink && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await clearSubmissionExportLink(submission.id);
                          setCurrentExportLink("");
                          setLinkInput("");
                          toast.success("Export link removed");
                          onUpdate();
                          setIsEditingLink(false);
                        } catch {
                          toast.error("Failed to remove export link");
                        }
                      }}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
                      disabled={isSavingLink}
                    >
                      Remove Link
                    </button>
                  )}

                  <div className="flex justify-end gap-2 ml-auto">
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
                          toast.error("Please enter a valid URL starting with http or https");
                          return;
                        }
                        setIsSavingLink(true);
                        try {
                          await setSubmissionExportLink(submission.id, linkInput);
                          setCurrentExportLink(linkInput);
                          toast.success("Export link saved");
                          setIsEditingLink(false);
                          onUpdate();
                        } catch {
                          toast.error("Failed to save export link");
                        } finally {
                          setIsSavingLink(false);
                        }
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-medium text-white ${isSavingLink ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
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
      </div>
    </div>
  );
}

