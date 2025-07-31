"use client";

import { Student } from '@/types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { storage } from '@/lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

/**
 * Export Service for downloading and managing cleared submissions
 */

export interface ExportOptions {
  includePending?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

/**
 * Downloads a single submission file using native browser download (bypasses CORS)
 */
export async function downloadSubmissionFile(submission: Student): Promise<void> {
  try {
    if (!submission.zipFile) {
      throw new Error('No file available for this submission');
    }

    // Get signed download URL from Firebase Storage
    const storageFileName = `${submission.id}.zip`;
    const fileRef = ref(storage, `submissions/${storageFileName}`);
    const downloadURL = await getDownloadURL(fileRef);
    
    // Use submission ID as filename
    const customFileName = `${submission.id}.zip`;
    
    // Create temporary download link and trigger native browser download
    const link = document.createElement('a');
    link.href = downloadURL;
    link.download = customFileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    throw error;
  }
}

/**
 * Streamlined bulk download - back to original working approach but with custom confirmation
 */
export async function bulkExportSubmissions(
  submissions: Student[], 
  options: ExportOptions = {},
  onProgress?: (current: number, total: number, fileName: string) => void,
  showConfirmation?: (message: string, fileList: string[]) => Promise<boolean>
): Promise<{ downloadedCount: number; totalCount: number }> {
  try {
    // Filter submissions based on options
    let filteredSubmissions = submissions.filter(sub => sub.status === 'Cleared');
    
    if (!options.includePending) {
      filteredSubmissions = filteredSubmissions.filter(sub => !sub.isExported);
    }

    if (options.dateRange) {
      filteredSubmissions = filteredSubmissions.filter(sub => {
        const submittedDate = new Date(sub.submittedAt);
        return submittedDate >= options.dateRange!.from && submittedDate <= options.dateRange!.to;
      });
    }

    if (filteredSubmissions.length === 0) {
      throw new Error('No submissions to export');
    }

    // Prepare all download URLs first
    const downloadData: Array<{
      fileName: string;
      downloadURL: string;
      submission: Student;
    }> = [];
    
    for (let i = 0; i < filteredSubmissions.length; i++) {
      const submission = filteredSubmissions[i];
      try {
        if (!submission.id) {
          continue;
        }
        
        // Get signed download URL from Firebase Storage
        const storageFileName = `${submission.id}.zip`;
        const fileRef = ref(storage, `submissions/${storageFileName}`);
        const downloadURL = await getDownloadURL(fileRef);
        
        // Use submission ID as filename
        const fileName = `${submission.id}.zip`;
        
        downloadData.push({ fileName, downloadURL, submission });
        
      } catch (error) {
        // Silently skip failed preparations
      }
    }

    if (downloadData.length === 0) {
      throw new Error('No files could be prepared for download. Please check your connection.');
    }

    // Show confirmation if callback provided, otherwise proceed
    if (showConfirmation) {
      const fileNames = downloadData.map(d => d.fileName);
      const userConfirmed = await showConfirmation(
        `Ready to download ${downloadData.length} files:\n\nFiles will download automatically with smart delays to prevent browser blocking.`,
        fileNames
      );
      
      if (!userConfirmed) {
        throw new Error('Download cancelled by user');
      }
    }

    // Execute downloads immediately after confirmation
    let successCount = 0;
    for (let i = 0; i < downloadData.length; i++) {
      const { fileName, downloadURL } = downloadData[i];
      
      try {
        // Update progress
        if (onProgress) {
          onProgress(i + 1, downloadData.length, fileName);
        }
        
        // Create and trigger download
        const link = document.createElement('a');
        link.href = downloadURL;
        link.download = fileName;
        link.target = '_blank';
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Clean up after delay
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 1000);
        
        successCount++;
        
        // Staggered delays to prevent browser blocking
        if (i < downloadData.length - 1) {
          const delay = i === 0 ? 1000 : 2000; // Longer delay after first download
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        // Silently skip failed downloads
      }
    }
    
    return { downloadedCount: successCount, totalCount: downloadData.length };
    
  } catch (error) {
    throw error;
  }
}

