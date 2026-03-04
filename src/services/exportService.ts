"use client";

import { Student } from '@/types';
import JSZip from 'jszip';

/**
 * Export Service for downloading and managing cleared submissions
 */

/**
 * Downloads a single submission file with improved error handling and debugging
 * This function only initiates the download - it doesn't guarantee completion
 */
export async function downloadSubmissionFile(submission: Student): Promise<void> {
  try {
    if (!submission.zipFile) {
      throw new Error('No file available for this submission');
    }

    console.log('Starting download for submission:', submission.id);
    console.log('Original zipFile URL:', submission.zipFile);
    
    const sanitizedName = submission.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const customFileName = `${sanitizedName}_${submission.id}.zip`;
    const downloadURL = submission.zipFile;
    console.log('Using submission zip URL for download');

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
 * Downloads a submission's ZIP, extracts it client-side, and writes files
 * into a user-selected directory using the File System Access API.
 *
 * Notes:
 * - Requires Chromium-based browsers with `showDirectoryPicker` support
 * - Firebase Storage must allow CORS for programmatic fetch of the signed URL
 * - Preserves the internal folder structure of the ZIP
 */
export async function downloadSubmissionAsFolder(submission: Student): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('This action must run in the browser.');
  }

  // Feature detection for File System Access API
  // @ts-expect-error: showDirectoryPicker is experimental but present in Chromium
  if (typeof window.showDirectoryPicker !== 'function') {
    throw new Error('Folder download requires a Chromium browser (showDirectoryPicker not available).');
  }

  if (!submission) {
    throw new Error('Invalid submission data.');
  }

  if (!submission.zipFile) {
    throw new Error('No file available for this submission');
  }

  const sanitizedName = submission.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const downloadURL = submission.zipFile;

  // 2) Fetch ZIP via same-origin proxy to avoid Firebase CORS
  const response = await fetch('/api/download-submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: downloadURL })
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ZIP: ${response.status} ${response.statusText}`);
  }
  const zipBlob = await response.blob();

  // 3) Unzip client-side
  const zip = await JSZip.loadAsync(zipBlob);

  // 4) Ask user for a target directory (ID must be <= 32 chars)
  const safeId = (() => {
    const base = sanitizedName || 'Student';
    const trimmed = base.slice(0, 27); // leave room for prefix
    return `sub-${trimmed}`; // <= 31 chars
  })();
  // @ts-expect-error: showDirectoryPicker is experimental but present in Chromium
  const rootDirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    id: safeId,
    mode: 'readwrite'
  });

  // Optionally, create a subfolder with the student's name under the chosen directory
  const studentRoot = await rootDirHandle.getDirectoryHandle(sanitizedName.slice(0, 50) || 'Student', { create: true });

  // Helper: ensure nested directory path exists, return its handle
  async function ensureDirectory(root: FileSystemDirectoryHandle, folders: string[]): Promise<FileSystemDirectoryHandle> {
    let current = root;
    for (const folder of folders) {
      // Some ZIPs may include leading/trailing slashes or empty segments
      if (!folder) continue;
      current = await current.getDirectoryHandle(folder, { create: true });
    }
    return current;
  }

  // 5) Write files preserving structure
  const writeOperations: Promise<void>[] = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return; // skip folders; they are created as needed

    writeOperations.push((async () => {
      const parts = relativePath.split('/');
      const fileName = parts.pop() || 'file';
      const dirHandle = await ensureDirectory(studentRoot, parts);
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      const content = await entry.async('arraybuffer');
      await writable.write(content);
      await writable.close();
    })());
  });

  await Promise.all(writeOperations);
}
