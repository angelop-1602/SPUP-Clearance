"use client";

import React, { useState, useEffect } from 'react';
import { Student } from '@/types';
import { getSubmissionsForExport, bulkMarkAsExported } from '@/services/firebase';
import { bulkExportSubmissions, downloadSubmissionFile } from '@/services/exportService';
import { CustomAlert } from '@/components/ui/CustomAlert';

interface ExportPanelProps {
  onClose: () => void;
}

export function ExportPanel({ onClose }: ExportPanelProps) {
  const [submissions, setSubmissions] = useState<Student[]>([]);
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    showCancel?: boolean;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  useEffect(() => {
    loadSubmissionsForExport();
  }, []);

  const loadSubmissionsForExport = async () => {
    try {
      setIsLoading(true);
      const data = await getSubmissionsForExport();
      setSubmissions(data);
    } catch (error) {
      setAlertConfig({
        isOpen: true,
        title: 'Error Loading Submissions',
        message: 'Failed to load submissions for export. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedSubmissions.length === submissions.length) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(submissions.map(sub => sub.id));
    }
  };

  const handleSelectSubmission = (submissionId: string) => {
    setSelectedSubmissions(prev => 
      prev.includes(submissionId)
        ? prev.filter(id => id !== submissionId)
        : [...prev, submissionId]
    );
  };

  const handleBulkExport = async () => {
    if (selectedSubmissions.length === 0) {
      setAlertConfig({
        isOpen: true,
        title: 'No Selections',
        message: 'Please select submissions to export.',
        type: 'warning'
      });
      return;
    }

    try {
      setIsExporting(true);
      const selectedSubmissionData = submissions.filter(sub => 
        selectedSubmissions.includes(sub.id)
      );

      // Use the original working approach but with custom confirmation
      const showConfirmation = (message: string, fileList: string[]): Promise<boolean> => {
        return new Promise((resolve) => {
          const fileListText = fileList.join('\n• ');
          setAlertConfig({
            isOpen: true,
            title: 'Ready to Download',
            message: `${message}\n\n• ${fileListText}`,
            type: 'info',
            showCancel: true,
            onConfirm: () => {
              setAlertConfig(prev => ({ ...prev, isOpen: false }));
              resolve(true);
            }
          });
          
          // Handle cancel through the onClose
          const originalOnClose = () => {
            setAlertConfig(prev => ({ ...prev, isOpen: false }));
            resolve(false);
          };
          
          // Store the cancel handler
          setAlertConfig(prev => ({ ...prev, onCancel: originalOnClose }));
        });
      };

      // Execute the export with custom confirmation
      const result = await bulkExportSubmissions(
        selectedSubmissionData,
        {},
        (current, total, fileName) => {
          setDownloadProgress({ current, total, fileName });
        },
        showConfirmation
      );

      setDownloadProgress(null);
      setAlertConfig({
        isOpen: true,
        title: 'Export Complete',
        message: `Successfully exported ${result.downloadedCount}/${result.totalCount} files!\n\nCheck your downloads folder for ZIP files with format:\nSPUP_Clearance_YYYY_ABC123.zip`,
        type: 'success'
      });
    } catch (error) {
      setDownloadProgress(null);
      setAlertConfig({
        isOpen: true,
        title: 'Export Failed',
        message: 'Failed to export submissions. Please check your connection and try again.',
        type: 'error'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleMarkAsExported = async () => {
    if (selectedSubmissions.length === 0) {
      setAlertConfig({
        isOpen: true,
        title: 'No Selections',
        message: 'Please select submissions to mark as exported.',
        type: 'warning'
      });
      return;
    }

    setAlertConfig({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `This will mark ${selectedSubmissions.length} submissions as exported and DELETE their files from Firebase Storage.\n\nThis action cannot be undone. Continue?`,
      type: 'warning',
      showCancel: true,
      onConfirm: () => processMarkAsExported()
    });
  };

  const processMarkAsExported = async () => {

    try {
      setIsProcessing(true);
      const results = await bulkMarkAsExported(selectedSubmissions, true);
      
      if (results.success.length > 0) {
        setAlertConfig({
          isOpen: true,
          title: 'Processing Complete',
          message: `Successfully processed ${results.success.length} submissions. Files have been deleted from storage.`,
          type: 'success'
        });
        await loadSubmissionsForExport(); // Refresh the list
        setSelectedSubmissions([]);
      }
      
      if (results.failed.length > 0) {
        setAlertConfig({
          isOpen: true,
          title: 'Partial Processing Failure',
          message: `${results.failed.length} submissions failed to process:\n${results.failed.join(', ')}`,
          type: 'error'
        });
      }
    } catch (error) {
      setAlertConfig({
        isOpen: true,
        title: 'Processing Failed',
        message: 'Failed to process submissions. Please try again.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingle = async (submission: Student) => {
    try {
      await downloadSubmissionFile(submission);
    } catch (error) {
      setAlertConfig({
        isOpen: true,
        title: 'Download Failed',
        message: 'Failed to download submission. Please try again.',
        type: 'error'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading submissions for export...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Export & Archive Submissions</h2>
              <p className="text-sm">
                Export cleared submissions as a single ZIP file and manage storage costs
              </p>
            </div>
            <button
              onClick={onClose}
              className="hover:text-gray-500 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Info Box */}
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No cleared submissions available for export</p>
              <p className="text-gray-400 text-sm mt-2">All cleared submissions have already been exported</p>
            </div>
          ) : (
            <>
              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleSelectAll}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    {selectedSubmissions.length === submissions.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-gray-600">
                    {selectedSubmissions.length} of {submissions.length} selected
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleBulkExport}
                    disabled={selectedSubmissions.length === 0 || isExporting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isExporting ? (
                      downloadProgress ? 
                        `Downloading ${downloadProgress.current}/${downloadProgress.total}...` : 
                        'Preparing...'
                    ) : 'Export Selected'}
                  </button>
                  <button
                    onClick={handleMarkAsExported}
                    disabled={selectedSubmissions.length === 0 || isProcessing}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isProcessing ? 'Processing...' : 'Mark as Exported & Delete'}
                  </button>
                </div>
              </div>

              {/* Submissions Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedSubmissions.length === submissions.length}
                          onChange={handleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submission ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Course
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submitted Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {submissions.map((submission) => (
                      <tr key={submission.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedSubmissions.includes(submission.id)}
                            onChange={() => handleSelectSubmission(submission.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {submission.id}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {submission.name}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {submission.course}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleDownloadSingle(submission)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info Box */}
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Export Process:</h4>
                <ol className="text-sm text-yellow-700 space-y-1">
                  <li>1. <strong>Export Selected:</strong> Downloads files with naming format: SPUP_Clearance_2025_ABC123.zip</li>
                  <li>2. <strong>Mark as Exported & Delete:</strong> Updates records and removes files from Firebase Storage to save costs</li>
                  <li>3. <strong>Keep metadata:</strong> Form details remain in database for tracking and records</li>
                </ol>
              </div>
              
              {/* Progress Display */}
              {downloadProgress && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Downloading {downloadProgress.current} of {downloadProgress.total}
                      </p>
                      <p className="text-xs text-green-700 truncate max-w-md">
                        {downloadProgress.fileName}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Custom Alert */}
      <CustomAlert
        isOpen={alertConfig.isOpen}
        onClose={() => {
          setAlertConfig(prev => ({ ...prev, isOpen: false }));
          // If this is a cancellation of download confirmation, reset export state
          if (alertConfig.title === 'Ready to Download' && alertConfig.showCancel) {
            setIsExporting(false);
          }
        }}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
      />
    </div>
  );
}