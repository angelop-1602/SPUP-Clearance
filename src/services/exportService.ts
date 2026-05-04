"use client";

import { Student } from '@/types';
import { getSubmissionDownloadUrl } from '@/services/submissions';

/**
 * Export Service for downloading and managing cleared submissions
 */

interface BulkExportFailure {
  submission: Student;
  error: string;
}

export interface BulkFolderExportResult {
  exported: Student[];
  failed: BulkExportFailure[];
}

export type BulkExportStage =
  | 'selecting-folder'
  | 'preparing'
  | 'downloading'
  | 'extracting'
  | 'writing'
  | 'marking'
  | 'completed'
  | 'failed';

export interface BulkExportProgress {
  stage: BulkExportStage;
  current: number;
  total: number;
  submission?: Student;
  message: string;
  bytesLoaded?: number;
  bytesTotal?: number;
  filesWritten?: number;
  filesTotal?: number;
}

export interface BulkFolderExportOptions {
  onProgress?: (progress: BulkExportProgress) => void;
}

interface DownloadProgress {
  loaded: number;
  total?: number;
}

function sanitizePathSegment(value: string, fallback: string) {
  const safe = value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .trim();

  return safe || fallback;
}

function getTimestampForFolderName() {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-') + `_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function getSubmissionFolderName(submission: Student) {
  const safeName = sanitizePathSegment(submission.name, 'Student').slice(0, 50);
  const safeStudentId = sanitizePathSegment(submission.studentId, 'No_ID').slice(0, 30);
  const safeSubmissionId = sanitizePathSegment(submission.id, 'Submission').slice(0, 45);

  return `${safeName}_${safeStudentId}_${safeSubmissionId}`;
}

function getSubmissionZipFileName(submission: Student) {
  return `${getSubmissionFolderName(submission)}.zip`;
}

async function fetchSubmissionZipBlob(
  submission: Student,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Blob> {
  const downloadURL = submission.zipFile || await getSubmissionDownloadUrl(submission.id);

  const response = await fetch('/api/download-submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: downloadURL })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ZIP: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'application/zip';
  const contentLength = Number(response.headers.get('content-length')) || undefined;

  if (!response.body) {
    const blob = await response.blob();
    onProgress?.({ loaded: blob.size, total: contentLength || blob.size });
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.({ loaded, total: contentLength });
  }

  return new Blob(chunks, { type: contentType });
}

async function writeBlobToDirectoryFile(
  root: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
) {
  const fileHandle = await root.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Downloads a single submission file with improved error handling and debugging
 * This function only initiates the download - it doesn't guarantee completion
 */
export async function downloadSubmissionFile(submission: Student): Promise<void> {
  try {
    console.log('Starting download for submission:', submission.id);
    
    const sanitizedName = submission.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const customFileName = `${sanitizedName}_${submission.id}.zip`;
    const downloadURL = submission.zipFile || await getSubmissionDownloadUrl(submission.id);

    const link = document.createElement('a');
    link.href = downloadURL;
    link.download = customFileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    console.log('Triggering download...');
    
    try {
      link.click();
      console.log('Standard click executed');
    } catch (clickError) {
      console.warn('Standard click failed:', clickError);
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: false
      });
      link.dispatchEvent(clickEvent);
      console.log('MouseEvent dispatch executed');
    }
    
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 100);
    
    console.log('Download initiated successfully');
  } catch (error) {
    console.error('Download initiation failed:', error);
    throw error;
  }
}

/**
 * Downloads a file and returns a promise that resolves immediately
 * The confirmation dialog is now handled by the UI components
 */
export async function downloadWithConfirmation(submission: Student): Promise<void> {
  try {
    // Initiate the download
    await downloadSubmissionFile(submission);
    
    // Wait a moment for the download to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return successfully - confirmation is now handled by UI
  } catch (error) {
    throw error;
  }
}

/**
 * Downloads a submission ZIP and writes the completed ZIP file into a
 * user-selected directory using the File System Access API.
 *
 * The caller should only mark the submission as downloaded after this resolves.
 */
export async function downloadSubmissionAsZipFile(
  submission: Student,
  options: BulkFolderExportOptions = {}
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('This action must run in the browser.');
  }

  // Feature detection for File System Access API
  // @ts-expect-error: showDirectoryPicker is experimental but present in Chromium
  if (typeof window.showDirectoryPicker !== 'function') {
    throw new Error('ZIP export requires a Chromium browser (showDirectoryPicker not available).');
  }

  if (!submission) {
    throw new Error('Invalid submission data.');
  }

  const sanitizedName = sanitizePathSegment(submission.name, 'Student');
  const safeId = (() => {
    const base = sanitizedName || 'Student';
    const trimmed = base.slice(0, 27);
    return `sub-${trimmed}`; // <= 31 chars
  })();

  options.onProgress?.({
    stage: 'selecting-folder',
    current: 0,
    total: 1,
    submission,
    message: `Choose where to save ${submission.name}'s ZIP file.`,
  });

  // Ask for the folder first so cancellation never starts a network transfer.
  // @ts-expect-error: showDirectoryPicker is experimental but present in Chromium
  const rootDirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    id: safeId,
    mode: 'readwrite'
  });

  options.onProgress?.({
    stage: 'preparing',
    current: 0,
    total: 1,
    submission,
    message: `Preparing ZIP file for ${submission.name}.`,
  });

  options.onProgress?.({
    stage: 'downloading',
    current: 1,
    total: 1,
    submission,
    message: `Downloading ZIP for ${submission.name}.`,
  });

  const zipBlob = await fetchSubmissionZipBlob(submission, ({ loaded, total }) => {
    options.onProgress?.({
      stage: 'downloading',
      current: 1,
      total: 1,
      submission,
      message: `Downloading ZIP for ${submission.name}.`,
      bytesLoaded: loaded,
      bytesTotal: total,
    });
  });

  options.onProgress?.({
    stage: 'writing',
    current: 1,
    total: 1,
    submission,
    message: `Writing ${submission.name}'s ZIP file locally.`,
  });

  await writeBlobToDirectoryFile(
    rootDirHandle,
    getSubmissionZipFileName(submission),
    zipBlob
  );

  options.onProgress?.({
    stage: 'completed',
    current: 1,
    total: 1,
    submission,
    message: `Finished saving ${submission.name}'s ZIP file.`,
  });
}

export async function bulkDownloadSubmissionsAsZipFiles(
  submissions: Student[],
  options: BulkFolderExportOptions = {}
): Promise<BulkFolderExportResult> {
  if (typeof window === 'undefined') {
    throw new Error('This action must run in the browser.');
  }

  // @ts-expect-error: showDirectoryPicker is experimental but present in Chromium
  if (typeof window.showDirectoryPicker !== 'function') {
    throw new Error('Bulk ZIP export requires a Chromium browser.');
  }

  if (submissions.length === 0) {
    return { exported: [], failed: [] };
  }

  options.onProgress?.({
    stage: 'selecting-folder',
    current: 0,
    total: submissions.length,
    message: 'Choose a destination folder for the ZIP export.',
  });

  // @ts-expect-error: showDirectoryPicker is experimental but present in Chromium
  const targetDirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    id: 'cprint-clearance-bulk-export',
    mode: 'readwrite'
  });

  options.onProgress?.({
    stage: 'preparing',
    current: 0,
    total: submissions.length,
    message: 'Creating the export folder for ZIP files.',
  });

  const exportRoot = await targetDirHandle.getDirectoryHandle(
    `CPRINT_Clearance_Export_${getTimestampForFolderName()}`,
    { create: true }
  );
  const result: BulkFolderExportResult = {
    exported: [],
    failed: [],
  };

  for (const [index, submission] of submissions.entries()) {
    const current = index + 1;

    try {
      options.onProgress?.({
        stage: 'downloading',
        current,
        total: submissions.length,
        submission,
        message: `Downloading ZIP for ${submission.name}.`,
      });

      const zipBlob = await fetchSubmissionZipBlob(submission, ({ loaded, total }) => {
        options.onProgress?.({
          stage: 'downloading',
          current,
          total: submissions.length,
          submission,
          message: `Downloading ZIP for ${submission.name}.`,
          bytesLoaded: loaded,
          bytesTotal: total,
        });
      });

      options.onProgress?.({
        stage: 'writing',
        current,
        total: submissions.length,
        submission,
        message: `Writing ZIP file for ${submission.name}.`,
      });

      await writeBlobToDirectoryFile(
        exportRoot,
        getSubmissionZipFileName(submission),
        zipBlob
      );

      result.exported.push(submission);
      options.onProgress?.({
        stage: 'completed',
        current,
        total: submissions.length,
        submission,
        message: `Finished saving ${submission.name}'s ZIP file.`,
      });
    } catch (error) {
      result.failed.push({
        submission,
        error: error instanceof Error ? error.message : 'Unknown export error',
      });
      options.onProgress?.({
        stage: 'failed',
        current,
        total: submissions.length,
        submission,
        message: `Could not export ${submission.name}. Continuing with the next submission.`,
      });
    }
  }

  return result;
}

export const downloadSubmissionAsFolder = downloadSubmissionAsZipFile;
export const bulkDownloadSubmissionsAsFolder = bulkDownloadSubmissionsAsZipFiles;
