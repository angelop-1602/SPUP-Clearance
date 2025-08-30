"use client";

import React, { useState } from 'react';
import { Student, FilterOptions } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EllipsisVertical, Eye, Download, CheckCircle, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadWithConfirmation } from '@/services/exportService';
import { markSubmissionAsExported, updateSubmissionStatus } from '@/services/firebase';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EditSubmissionDialog } from '@/components/admin/EditSubmissionDialog';
import { toast } from 'sonner';

// Exported Flag Component
function ExportedFlag({ isExported, exportedAt }: { isExported?: boolean; exportedAt?: Date }) {
  if (!isExported) return null;
  
  const formatExportDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div 
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2"
      title={`Exported on ${exportedAt ? formatExportDate(exportedAt) : 'Unknown date'}`}
    >
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

interface AdminTableProps {
  submissions: Student[];
  onViewSubmission: (submission: Student) => void;
  onFiltersChange: (filters: FilterOptions) => void;
  isLoading?: boolean;
  onSubmissionUpdate?: () => void;
}

export function AdminTable({ 
  submissions, 
  onViewSubmission, 
  onFiltersChange, 
  isLoading = false,
  onSubmissionUpdate
}: AdminTableProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    level: 'all',
    status: 'all',
    course: '',
    searchTerm: '',
  });

  // Dialog states
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Student | null>(null);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const uniqueCourses = Array.from(
    new Set(submissions.map(s => s.course).filter(Boolean))
  ).sort();

  // Dialog handlers
  const handleDownloadClick = async (submission: Student) => {
    if (submission.isExported) {
      toast.info('This submission was already downloaded and removed from storage.');
      return;
    }

    try {
      // Step 1: Download the file immediately
      await downloadWithConfirmation(submission);
      toast.success(`Download started for ${submission.name}'s submission. Check your Downloads folder.`);
      
      // Step 2: Show confirmation dialog for storage deletion
      setSelectedSubmission(submission);
      setDownloadDialogOpen(true);
      
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file. Please try again.');
    }
  };

  const handleDownloadConfirm = async () => {
    if (!selectedSubmission) return;
    
    try {
      // Only delete from storage - download already happened
      await markSubmissionAsExported(selectedSubmission.id, true);
      toast.success(`File removed from storage to save costs.`);
      if (onSubmissionUpdate) onSubmissionUpdate();
      
    } catch (error) {
      console.error('Storage deletion error:', error);
      toast.error('Failed to remove file from storage. Please try again later.');
    }
  };

  const handleClearClick = (submission: Student) => {
    if (submission.status === 'Cleared') {
      toast.info('This submission is already marked as cleared.');
      return;
    }
    setSelectedSubmission(submission);
    setClearDialogOpen(true);
  };

  const handleClearConfirm = async () => {
    if (!selectedSubmission) return;
    
    try {
      await updateSubmissionStatus(selectedSubmission.id, 'Cleared');
      toast.success(`Marked ${selectedSubmission.name}'s submission as cleared.`);
      if (onSubmissionUpdate) onSubmissionUpdate();
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Failed to mark submission as cleared.');
    }
  };

  const handleEditClick = (submission: Student) => {
    setSelectedSubmission(submission);
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading submissions...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          All Submissions 
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Name, ID, or title..."
              value={filters.searchTerm || ''}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Level
            </label>
            <select
              value={filters.level || 'all'}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="undergrad">Undergraduate</option>
              <option value="grad">Graduate</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Cleared">Cleared</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course
            </label>
            <select
              value={filters.course || ''}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Courses</option>
              {uniqueCourses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table - Mobile Card View for Small Screens */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Research Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Level/Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No submissions found
                </td>
              </tr>
            ) : (
              submissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-gray-50">

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {submission.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {submission.studentId} • {submission.course}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {submission.researchTitle}
                    </div>
                    <div className="text-sm text-gray-500">
                      Adviser: {submission.adviser}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize">
                      {submission.level}
                    </div>
                    <div className="text-sm text-gray-500">
                      {submission.researchType}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <StatusBadge status={submission.status} />
                      <ExportedFlag isExported={submission.isExported} exportedAt={submission.exportedAt} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(submission.submittedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                            <EllipsisVertical className="h-4 w-4 text-gray-600" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewSubmission(submission)}>
                          <Eye className="h-4 w-4 mr-2" />
                          <span>View</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditClick(submission)}>
                          <Edit className="h-4 w-4 mr-2" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        {submission.status !== 'Cleared' && (
                          <DropdownMenuItem onClick={() => handleClearClick(submission)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>Mark as Cleared</span>
                          </DropdownMenuItem>
                        )}
                        {submission.isExported && submission.exportLink ? (
                          <DropdownMenuItem asChild>
                            <a href={submission.exportLink} target="_blank" rel="noopener noreferrer" className="flex items-center">
                              <Download className="h-4 w-4 mr-2" />
                              <span>Open Export Link</span>
                            </a>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleDownloadClick(submission)}
                            disabled={submission.isExported}
                            className={submission.isExported ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            <span className={submission.isExported ? "text-gray-400" : ""}>
                              {submission.isExported ? "Already Downloaded" : "Download"}
                            </span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-200">
        {submissions.map((submission: Student) => (
          <div key={submission.id} className="p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium text-gray-900 text-sm">{submission.name}</h3>
                <p className="text-xs text-gray-500">{submission.studentId}</p>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <StatusBadge status={submission.status} />
                <ExportedFlag isExported={submission.isExported} exportedAt={submission.exportedAt} />
              </div>
            </div>
            
            <div className="space-y-1 text-xs text-gray-600 mb-3">
              <p><span className="font-medium">Course:</span> {submission.course}</p>
              <p><span className="font-medium">Research:</span> {submission.researchTitle}</p>
              <p><span className="font-medium">Level:</span> {submission.level}</p>
              <p><span className="font-medium">Submitted:</span> {submission.submittedAt.toLocaleDateString()}</p>
            </div>
            
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => onViewSubmission(submission)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-md transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleEditClick(submission)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-sm py-2 px-3 rounded-md transition-colors"
                >
                  Edit
                </button>
              </div>
              <div className="flex space-x-2">
                {submission.status !== 'Cleared' && (
                  <button
                    onClick={() => handleClearClick(submission)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded-md transition-colors"
                  >
                    Mark as Cleared
                  </button>
                )}
                <button
                  onClick={() => handleDownloadClick(submission)}
                  disabled={submission.isExported}
                  className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
                    submission.isExported 
                      ? "bg-gray-400 cursor-not-allowed text-white" 
                      : "bg-orange-600 hover:bg-orange-700 text-white"
                  }`}
                >
                  {submission.isExported ? "Already Downloaded" : "Download"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        title="Confirm Storage Deletion"
        description={`The file for ${selectedSubmission?.name}'s submission has been downloaded to your computer.\n\nDo you want to remove it from Firebase Storage to save costs?\n\n✅ File downloaded to your computer\n🗑️ Remove from cloud storage (saves money)\n\nWARNING: Once deleted from storage, the file cannot be downloaded again from the admin panel.`}
        confirmText="Remove from Storage"
        cancelText="Keep in Storage"
        onConfirm={handleDownloadConfirm}
        variant="destructive"
        countdown={5}
      />

      <ConfirmationDialog
        isOpen={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Mark as Cleared"
        description={`Are you sure you want to mark ${selectedSubmission?.name}'s submission as cleared?\n\nThis action will change the status from "Submitted" to "Cleared".`}
        confirmText="Mark as Cleared"
        cancelText="Cancel"
        onConfirm={handleClearConfirm}
      />

      {/* Edit Dialog */}
      <EditSubmissionDialog
        isOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        submission={selectedSubmission}
        onUpdate={() => {
          if (onSubmissionUpdate) onSubmissionUpdate();
        }}
      />
    </div>
  );
} 