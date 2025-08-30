"use client";

import { Student } from '@/types';
import { storage } from '@/lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

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

    // Get signed download URL from Firebase Storage using new filename format
    const sanitizedName = submission.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const storageFileName = `${sanitizedName}_${submission.id}.zip`;
    console.log('Looking for file:', storageFileName);
    
    const fileRef = ref(storage, `submissions/${storageFileName}`);
    
    // Verify file exists in storage before attempting download
    try {
      const downloadURL = await getDownloadURL(fileRef);
      console.log('Got download URL:', downloadURL);
      
      // Use student name + submission ID as filename for better identification
      const customFileName = `${sanitizedName}_${submission.id}.zip`;
      console.log('Custom filename:', customFileName);
      
      // Create temporary download link and trigger native browser download
      const link = document.createElement('a');
      link.href = downloadURL;
      link.download = customFileName;
      link.style.display = 'none';
      link.target = '_blank'; // Add target blank for better compatibility
      
      document.body.appendChild(link);
      console.log('Triggering download...');
      
      // Try multiple methods for better browser compatibility
      try {
        // Method 1: Standard click
        link.click();
        console.log('Standard click executed');
      } catch (clickError) {
        console.warn('Standard click failed:', clickError);
        
        try {
          // Method 2: MouseEvent dispatch
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: false
          });
          link.dispatchEvent(clickEvent);
          console.log('MouseEvent dispatch executed');
        } catch (dispatchError) {
          console.warn('MouseEvent dispatch failed:', dispatchError);
          
          // Method 3: Fallback to window.open
          console.log('Falling back to window.open');
          window.open(downloadURL, '_blank');
        }
      }
      
      // Clean up
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 100);
      
      console.log('Download initiated successfully');

      // Note: This only initiates the download, doesn't guarantee completion
      // The caller should handle storage cleanup with user confirmation
    } catch (storageError) {
      console.error('Storage error:', storageError);
      throw new Error(`File not found in storage: ${storageError}`);
    }
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



