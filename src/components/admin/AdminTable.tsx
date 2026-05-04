"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Student, FilterOptions } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EllipsisVertical, Eye, Download, CheckCircle, Edit, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  bulkDownloadSubmissionsAsZipFiles,
  downloadSubmissionAsZipFile,
} from '@/services/exportService';
import type { BulkExportProgress } from '@/services/exportService';
import {
  deleteSubmission,
  markSubmissionAsExported,
  setUndergradAllClear,
  updateSubmissionStatus,
} from '@/services/submissions';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EditSubmissionDialog } from '@/components/admin/EditSubmissionDialog';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getResearchTypeLabel,
  isNotApplicableResearchType,
  matchesResearchTypeFilter,
} from '@/utils/researchType';
import {
  getExportProgressDetail,
  getExportProgressPercent,
} from '@/utils/exportProgress';

interface AdminTableProps {
  submissions: Student[];
  onViewSubmission: (submission: Student) => void;
  onFiltersChange: (filters: FilterOptions) => void;
  isLoading?: boolean;
  onSubmissionUpdate?: () => void;
}

type TabType = 'all' | 'pending' | 'cleared';

const ITEMS_PER_PAGE = 10;

function hasStoredFile(submission: Student): boolean {
  return Boolean(submission.zipFile || submission.zipPath);
}

function canExportSubmission(submission: Student): boolean {
  return submission.status === 'Cleared' && !submission.isExported && hasStoredFile(submission);
}

function markSubmissionClearedLocally(submission: Student): Student {
  if (submission.level === 'undergrad') {
    return {
      ...submission,
      status: 'Cleared' as const,
      leaderCleared: true,
      groupMembers: (submission.groupMembers ?? []).map((member) => ({
        ...member,
        isCleared: true,
      })),
    };
  }

  return {
    ...submission,
    status: 'Cleared' as const,
  };
}

export function AdminTable({ 
  submissions, 
  onViewSubmission, 
  onFiltersChange, 
  isLoading = false,
  onSubmissionUpdate
}: AdminTableProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    researchType: 'all',
    searchTerm: '',
  });
  
  // State for search input (not debounced)
  const [searchInput, setSearchInput] = useState('');
  
  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchInput, 500);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Student | null>(null);
  
  // Local state for optimistic updates
  const [localSubmissions, setLocalSubmissions] = useState<Student[]>(submissions);
  const [isDeleting, setIsDeleting] = useState<Set<string>>(new Set());
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [isBulkClearing, setIsBulkClearing] = useState(false);
  const [bulkExportProgress, setBulkExportProgress] = useState<BulkExportProgress | null>(null);
  const [downloadingSubmissionIds, setDownloadingSubmissionIds] = useState<Set<string>>(new Set());

  const releaseInteractionLock = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = '';
    }
  }, []);
  
  // Sync local submissions with props when they change
  // But skip sync if we have pending deletions (to preserve optimistic updates)
  useEffect(() => {
    if (isDeleting.size === 0) {
      setLocalSubmissions(submissions);
    }
  }, [submissions, isDeleting.size]);

  useEffect(() => {
    if (editDialogOpen || deleteDialogOpen) return;

    const timer = window.setTimeout(() => {
      releaseInteractionLock();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [editDialogOpen, deleteDialogOpen, releaseInteractionLock]);

  useEffect(() => {
    if (!isBulkExporting && downloadingSubmissionIds.size === 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [downloadingSubmissionIds.size, isBulkExporting]);
  
  // Update filters when debounced search term changes
  useEffect(() => {
    const newFilters = { ...filters, searchTerm: debouncedSearchTerm };
    setFilters(newFilters);
    onFiltersChange(newFilters);
    setCurrentPage(1); // Reset to first page when search changes
  }, [debouncedSearchTerm]);
  
  // Update filters when tab changes (tabs still work but don't affect filter state)
  useEffect(() => {
    setCurrentPage(1); // Reset to first page when tab changes
  }, [activeTab]);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    if (key === 'searchTerm') {
      setSearchInput(value);
      return;
    }
    
    // Type-safe filter update for researchType
    if (key === 'researchType') {
      const newFilters: FilterOptions = {
        ...filters,
        researchType: value as FilterOptions['researchType']
      };
      setFilters(newFilters);
      onFiltersChange(newFilters);
      setCurrentPage(1); // Reset to first page when filters change
    }
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

  const uniqueResearchTypes = Array.from(
    new Set(
      submissions
        .map((submission) =>
          submission.researchType
            ? getResearchTypeLabel(submission.researchType)
            : ""
        )
        .filter(Boolean)
    )
  ).sort();
  
  // Apply all filters client-side for better UX
  const filteredSubmissions = useMemo(() => {
    let filtered = localSubmissions;
    
    // Apply tab filter
    switch (activeTab) {
      case 'pending':
        filtered = filtered.filter(s => s.status === 'Submitted');
        break;
      case 'cleared':
        filtered = filtered.filter(s => s.status === 'Cleared');
        break;
      default:
        // Show all
        break;
    }
    
    // Apply research type filter
    if (filters.researchType && filters.researchType !== 'all') {
      filtered = filtered.filter((submission) =>
        matchesResearchTypeFilter(submission.researchType, filters.researchType)
      );
    }
    
    // Apply search filter
    if (debouncedSearchTerm) {
      const searchTerm = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(submission =>
        submission.name.toLowerCase().includes(searchTerm) ||
        submission.studentId.toLowerCase().includes(searchTerm) ||
        submission.researchTitle.toLowerCase().includes(searchTerm) ||
        submission.email.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  }, [localSubmissions, activeTab, filters.researchType, debouncedSearchTerm]);
  
  // Pagination logic
  const totalPages = Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE);
  const paginatedSubmissions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredSubmissions.slice(startIndex, endIndex);
  }, [filteredSubmissions, currentPage]);
  
  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: localSubmissions.length,
      pending: localSubmissions.filter(s => s.status === 'Submitted').length,
      cleared: localSubmissions.filter(s => s.status === 'Cleared').length
    };
  }, [localSubmissions]);

  const bulkExportCandidates = useMemo(
    () => localSubmissions.filter(canExportSubmission),
    [localSubmissions]
  );
  const bulkClearCandidates = useMemo(
    () => filteredSubmissions.filter((submission) => submission.status !== 'Cleared'),
    [filteredSubmissions]
  );
  const bulkExportPercent = bulkExportProgress ? getExportProgressPercent(bulkExportProgress) : 0;
  const bulkExportDetail = bulkExportProgress ? getExportProgressDetail(bulkExportProgress) : '';
  
  // Truncate name function
  const truncateName = (name: string, maxLength: number = 25) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  // Dialog handlers
  const handleDownloadClick = async (submission: Student) => {
    if (submission.isExported) {
      toast.info('This submission was already downloaded.');
      return;
    }

    if (!hasStoredFile(submission)) {
      toast.info('No file is attached to this submission.');
      return;
    }

    const toastId = `download-${submission.id}`;
    setDownloadingSubmissionIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(submission.id);
      return nextIds;
    });
    setBulkExportProgress({
      stage: 'preparing',
      current: 0,
      total: 1,
      submission,
      message: `Preparing ${submission.name}'s ZIP file.`,
    });
    toast.loading(`Choose where to save ${submission.name}'s ZIP file...`, { id: toastId });

    try {
      await downloadSubmissionAsZipFile(submission, {
        onProgress: (progress) => {
          setBulkExportProgress(progress);
          toast.loading(progress.message, { id: toastId });
        },
      });

      const shouldDelete = window.confirm(
        `${submission.name}'s ZIP file was saved locally.\n\nChoose OK to delete the cloud copy now, or Cancel to keep the cloud copy. The submission will be marked downloaded either way.`
      );

      setBulkExportProgress({
        stage: 'marking',
        current: 1,
        total: 1,
        submission,
        message: shouldDelete
          ? `Deleting confirmed cloud files for ${submission.name}.`
          : `Marking ${submission.name}'s download while keeping cloud files.`,
      });
      await markSubmissionAsExported(submission.id, shouldDelete);

      setLocalSubmissions(prevSubmissions =>
        prevSubmissions.map(s =>
          s.id === submission.id
            ? { ...s, isExported: true, exportedAt: new Date() }
            : s
        )
      );

      toast.success(
        shouldDelete
          ? `Downloaded ${submission.name}'s submission and deleted its stored documents.`
          : `Downloaded ${submission.name}'s submission. Stored documents were kept.`,
        { id: toastId }
      );
      setBulkExportProgress({
        stage: 'completed',
        current: 1,
        total: 1,
        submission,
        message: `Finished downloading ${submission.name}.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Download cancelled. The submission was not marked downloaded.'
        : error instanceof Error
          ? error.message
          : 'Failed to download file. Please try again.';
      setBulkExportProgress({
        stage: 'failed',
        current: 0,
        total: 1,
        submission,
        message,
      });
      toast.error(message, { id: toastId });
    } finally {
      setDownloadingSubmissionIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(submission.id);
        return nextIds;
      });
      releaseInteractionLock();
    }
  };

  const handleBulkExportClick = async () => {
    if (bulkExportCandidates.length === 0) {
      toast.info('No cleared submissions are ready to download.');
      return;
    }

    setIsBulkExporting(true);
    setBulkExportProgress({
      stage: 'preparing',
      current: 0,
      total: bulkExportCandidates.length,
      message: `Preparing ${bulkExportCandidates.length} submissions for export.`,
    });
    const toastId = 'bulk-export';
    toast.loading(`Preparing ${bulkExportCandidates.length} submissions...`, { id: toastId });

    try {
      const result = await bulkDownloadSubmissionsAsZipFiles(bulkExportCandidates, {
        onProgress: (progress) => setBulkExportProgress(progress),
      });

      setBulkExportProgress({
        stage: 'completed',
        current: bulkExportCandidates.length,
        total: bulkExportCandidates.length,
        message: `Finished saving ${result.exported.length} ZIP files locally.`,
      });

      const shouldDelete = result.exported.length > 0 && window.confirm(
        `${result.exported.length} submission ZIP files were saved locally.\n\nDelete their documents from cloud storage now?`
      );

      if (result.exported.length > 0) {
        setBulkExportProgress({
          stage: 'marking',
          current: result.exported.length,
          total: result.exported.length,
          message: shouldDelete
            ? 'Deleting confirmed cloud files and marking downloads.'
            : 'Marking downloads while keeping cloud files.',
        });
      }

      const markResults = await Promise.allSettled(
        result.exported.map((submission) =>
          markSubmissionAsExported(submission.id, shouldDelete)
        )
      );
      const markedIds = new Set(
        result.exported
          .filter((_, index) => markResults[index].status === 'fulfilled')
          .map((submission) => submission.id)
      );
      const markFailedCount = markResults.filter((item) => item.status === 'rejected').length;

      if (markedIds.size > 0) {
        setLocalSubmissions(prevSubmissions =>
          prevSubmissions.map(s =>
            markedIds.has(s.id)
              ? { ...s, isExported: true, exportedAt: new Date() }
              : s
          )
        );
      }

      if (result.failed.length > 0 || markFailedCount > 0) {
        toast.warning(
          `Downloaded ${markedIds.size} submissions. ${result.failed.length + markFailedCount} were not marked downloaded.`,
          { id: toastId }
        );
        console.warn('Bulk export failures:', { exportFailures: result.failed, markResults });
      } else {
        toast.success(
          shouldDelete
            ? `Downloaded ${markedIds.size} submissions and deleted their stored documents.`
            : `Downloaded ${markedIds.size} submissions. Stored documents were kept.`,
          { id: toastId }
        );
      }

      setBulkExportProgress({
        stage: markFailedCount > 0 || result.failed.length > 0 ? 'failed' : 'completed',
        current: bulkExportCandidates.length,
        total: bulkExportCandidates.length,
        message: markFailedCount > 0 || result.failed.length > 0
          ? `Finished with ${result.failed.length + markFailedCount} issue(s).`
          : `Finished downloading ${markedIds.size} submissions.`,
      });
    } catch (error: unknown) {
      console.error('Bulk export error:', error);
      const message = error instanceof Error
        ? error.message
        : 'Failed to export submissions.';
      setBulkExportProgress({
        stage: 'failed',
        current: 0,
        total: bulkExportCandidates.length,
        message,
      });
      toast.error(message, { id: toastId });
    } finally {
      setIsBulkExporting(false);
      releaseInteractionLock();
    }
  };

  const handleBulkClearClick = async () => {
    if (bulkClearCandidates.length === 0) {
      toast.info('No submitted rows are ready to mark cleared.');
      return;
    }

    const confirmed = window.confirm(
      `Mark ${bulkClearCandidates.length} currently filtered submission(s) as cleared?\n\nFor undergraduate submissions, this will also mark the leader and all members as cleared.`
    );

    if (!confirmed) {
      releaseInteractionLock();
      return;
    }

    const toastId = 'bulk-clear';
    setIsBulkClearing(true);
    toast.loading(`Marking ${bulkClearCandidates.length} submissions as cleared...`, {
      id: toastId,
    });

    try {
      const clearResults = await Promise.allSettled(
        bulkClearCandidates.map((submission) =>
          submission.level === 'undergrad'
            ? setUndergradAllClear(submission.id, true)
            : updateSubmissionStatus(submission.id, 'Cleared')
        )
      );
      const clearedIds = new Set(
        bulkClearCandidates
          .filter((_, index) => clearResults[index].status === 'fulfilled')
          .map((submission) => submission.id)
      );
      const failedCount = clearResults.filter((result) => result.status === 'rejected').length;

      if (clearedIds.size > 0) {
        setLocalSubmissions((prevSubmissions) =>
          prevSubmissions.map((submission) =>
            clearedIds.has(submission.id)
              ? markSubmissionClearedLocally(submission)
              : submission
          )
        );
      }

      if (failedCount > 0) {
        toast.warning(
          `Marked ${clearedIds.size} submissions as cleared. ${failedCount} failed.`,
          { id: toastId }
        );
        console.warn('Bulk clear failures:', clearResults);
      } else {
        toast.success(`Marked ${clearedIds.size} submissions as cleared.`, {
          id: toastId,
        });
      }
    } catch (error) {
      console.error('Bulk clear error:', error);
      toast.error('Failed to bulk clear submissions.', { id: toastId });
    } finally {
      setIsBulkClearing(false);
      releaseInteractionLock();
    }
  };

  const handleClearClick = (submission: Student) => {
    if (submission.status === 'Cleared') {
      toast.info('This submission is already marked as cleared.');
      return;
    }
    
    const clearToastId = `clear-${submission.id}`;
    toast.loading(`Marking ${submission.name}'s submission as cleared...`, {
      id: clearToastId,
    });

    const clearPromise =
      submission.level === 'undergrad'
        ? setUndergradAllClear(submission.id, true)
        : updateSubmissionStatus(submission.id, 'Cleared');

    clearPromise
      .then(() => {
        setLocalSubmissions((prevSubmissions) =>
          prevSubmissions.map((existingSubmission) => {
            if (existingSubmission.id !== submission.id) {
              return existingSubmission;
            }

            return markSubmissionClearedLocally(existingSubmission);
          })
        );

        toast.success(`Marked ${submission.name}'s submission as cleared.`, {
          id: clearToastId,
        });
      })
      .catch((error) => {
        console.error('Clear error:', error);
        toast.error('Failed to mark submission as cleared.', { id: clearToastId });
      })
      .finally(() => {
        releaseInteractionLock();
      });
  };

  // Removed handleClearConfirm - now using direct optimistic updates

  const handleEditClick = (submission: Student) => {
    setSelectedSubmission(submission);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (submission: Student) => {
    setSelectedSubmission(submission);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSubmission) return;
    
    const submissionToDelete = selectedSubmission;
    const submissionId = submissionToDelete.id;
    const submissionName = submissionToDelete.name;
    
    // Close the dialog before the async deletion starts.
    setDeleteDialogOpen(false);
    
    // Mark as deleting to prevent state sync conflicts
    setIsDeleting(prev => new Set(prev).add(submissionId));
    
    // Show processing toast
    toast.loading(`Deleting ${submissionName}'s submission...`, { id: `delete-${submissionId}` });
    
    // Optimistically update local state immediately (like handleClearClick does)
    setLocalSubmissions(prevSubmissions => 
      prevSubmissions.filter(s => s.id !== submissionId)
    );
    
    // Perform deletion - no parent reload needed, just like handleClearClick
    deleteSubmission(submissionId)
      .then(() => {
        // Remove from deleting set
        setIsDeleting(prev => {
          const next = new Set(prev);
          next.delete(submissionId);
          return next;
        });
        
        // No onSubmissionUpdate call - local state is already updated
        // This matches the pattern used in handleClearClick
        toast.success(`${submissionName}'s submission has been deleted.`, { id: `delete-${submissionId}` });
      })
      .catch((error) => {
        console.error('Delete error:', error);
        
        // Remove from deleting set
        setIsDeleting(prev => {
          const next = new Set(prev);
          next.delete(submissionId);
          return next;
        });
        
        // On error, reload from parent to get correct state
        if (onSubmissionUpdate) {
          onSubmissionUpdate();
        }
        
        toast.error('Failed to delete submission. Please try again.', { id: `delete-${submissionId}` });
      })
      .finally(() => {
        setSelectedSubmission(null);
        releaseInteractionLock();
      });
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
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6 pt-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('all')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Submissions ({tabCounts.all})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending ({tabCounts.pending})
          </button>
          <button
            onClick={() => setActiveTab('cleared')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'cleared'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Cleared ({tabCounts.cleared})
          </button>
        </nav>
      </div>
      
      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeTab === 'all' && 'All Submissions'}
            {activeTab === 'pending' && 'Pending Submissions'}
            {activeTab === 'cleared' && 'Cleared Submissions'}
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleBulkClearClick}
              disabled={isBulkClearing || isBulkExporting || bulkClearCandidates.length === 0}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
                isBulkClearing || isBulkExporting || bulkClearCandidates.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              {isBulkClearing
                ? 'Clearing...'
                : `Bulk Clear (${bulkClearCandidates.length})`}
            </button>
            <button
              type="button"
              onClick={handleBulkExportClick}
              disabled={isBulkExporting || isBulkClearing || bulkExportCandidates.length === 0}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
                isBulkExporting || isBulkClearing || bulkExportCandidates.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              <Download className="h-4 w-4" />
              {isBulkExporting
                ? 'Exporting...'
                : `Bulk Download ZIPs (${bulkExportCandidates.length})`}
            </button>
          </div>
        </div>

        {bulkExportProgress && (
          <div
            className={`mb-4 rounded-md border p-3 ${
              bulkExportProgress.stage === 'failed'
                ? 'border-red-200 bg-red-50'
                : isBulkExporting
                  ? 'border-orange-200 bg-orange-50'
                  : 'border-green-200 bg-green-50'
            }`}
            aria-live="polite"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-gray-900">
                {bulkExportProgress.message}
              </p>
              <p className="text-xs font-medium text-gray-600">
                {bulkExportDetail} - {bulkExportPercent}%
              </p>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={bulkExportPercent}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  bulkExportProgress.stage === 'failed'
                    ? 'bg-red-600'
                    : isBulkExporting
                      ? 'bg-orange-600'
                      : 'bg-green-600'
                }`}
                style={{ width: `${bulkExportPercent}%` }}
              />
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Name, ID, or title..."
              value={searchInput}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="filter-research-type" className="block text-sm font-medium text-gray-700 mb-1">
              Research Type
            </label>
            <select
              id="filter-research-type"
              value={filters.researchType || 'all'}
              onChange={(e) => handleFilterChange('researchType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Research Types</option>
              {uniqueResearchTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table - Desktop View */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Course/Program
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Research Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedSubmissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {activeTab === 'all' && 'No submissions found'}
                  {activeTab === 'pending' && 'No pending submissions'}
                  {activeTab === 'cleared' && 'No cleared submissions'}
                </td>
              </tr>
            ) : (
              paginatedSubmissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-gray-50">
                  {/* Student */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <div 
                        className="text-sm font-medium text-gray-900 cursor-help" 
                        title={submission.name}
                      >
                        {truncateName(submission.name)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {submission.studentId}
                      </div>
                    </div>
                  </td>
                  
                  {/* Course/Program */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {submission.course}
                    </div>
                    <div className="text-sm text-gray-500 capitalize">
                      {submission.level}
                    </div>
                  </td>
                  
                  {/* Research Type */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getResearchTypeLabel(submission.researchType)}
                    </div>
                    {!isNotApplicableResearchType(submission.researchType) && submission.adviser && (
                      <div className="text-sm text-gray-500">
                        Adviser: {truncateName(submission.adviser, 20)}
                      </div>
                    )}
                  </td>
                  
                  {/* Status */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <StatusBadge status={submission.status} />
                    </div>
                  </td>
                  
                  
                  {/* Actions */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <DropdownMenu key={`dropdown-${submission.id}`} modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                          aria-label={`Actions for ${submission.name}`}
                        >
                            <EllipsisVertical className="h-4 w-4 text-gray-600" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" key={`content-${submission.id}`}>
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
                            <span>{submission.level === 'undergrad' ? 'All Clear' : 'Mark as Cleared'}</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDownloadClick(submission)}
                          disabled={submission.isExported || !hasStoredFile(submission) || downloadingSubmissionIds.has(submission.id)}
                          className={submission.isExported || !hasStoredFile(submission) || downloadingSubmissionIds.has(submission.id) ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          <span className={submission.isExported || !hasStoredFile(submission) || downloadingSubmissionIds.has(submission.id) ? "text-gray-400" : ""}>
                            {downloadingSubmissionIds.has(submission.id)
                              ? "Saving..."
                              : submission.isExported
                                ? "Already Downloaded"
                                : hasStoredFile(submission)
                                  ? "Save ZIP"
                                  : "No File Attached"}
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(submission)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden divide-y divide-gray-200">
        {paginatedSubmissions.map((submission: Student) => (
          <div key={submission.id} className="p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium text-gray-900 text-sm" title={submission.name}>
                  {truncateName(submission.name, 20)}
                </h3>
                <p className="text-xs text-gray-500">{submission.studentId}</p>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <StatusBadge status={submission.status} />
              </div>
            </div>
            
            <div className="space-y-1 text-xs text-gray-600 mb-3">
              <p><span className="font-medium">Course:</span> {submission.course}</p>
              <p><span className="font-medium">Research Type:</span> {getResearchTypeLabel(submission.researchType)}</p>
              {!isNotApplicableResearchType(submission.researchType) && submission.researchTitle && (
                <p><span className="font-medium">Research:</span> <span title={submission.researchTitle}>{truncateName(submission.researchTitle, 30)}</span></p>
              )}
              {!isNotApplicableResearchType(submission.researchType) && submission.adviser && (
                <p><span className="font-medium">Adviser:</span> {truncateName(submission.adviser, 25)}</p>
              )}
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
                    {submission.level === 'undergrad' ? 'All Clear' : 'Mark as Cleared'}
                  </button>
                )}
                <button
                  onClick={() => handleDownloadClick(submission)}
                  disabled={submission.isExported || !hasStoredFile(submission) || downloadingSubmissionIds.has(submission.id)}
                  className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
                    submission.isExported || !hasStoredFile(submission) || downloadingSubmissionIds.has(submission.id)
                      ? "bg-gray-400 cursor-not-allowed text-white" 
                      : "bg-orange-600 hover:bg-orange-700 text-white"
                  }`}
                >
                  {downloadingSubmissionIds.has(submission.id)
                    ? "Saving..."
                    : submission.isExported
                      ? "Already Downloaded"
                      : hasStoredFile(submission)
                        ? "Save ZIP"
                        : "No File"}
                </button>
              </div>
              <button
                onClick={() => handleDeleteClick(submission)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-md transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        
        {paginatedSubmissions.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            {activeTab === 'all' && 'No submissions found'}
            {activeTab === 'pending' && 'No pending submissions'}
            {activeTab === 'cleared' && 'No cleared submissions'}
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredSubmissions.length)} of{' '}
            {filteredSubmissions.length} results
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="flex space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                const showPage = page === 1 || page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1);
                
                if (!showPage) {
                  // Show ellipsis
                  if (page === 2 && currentPage > 4) {
                    return <span key={page} className="px-2 py-1 text-gray-500">...</span>;
                  }
                  if (page === totalPages - 1 && currentPage < totalPages - 3) {
                    return <span key={page} className="px-2 py-1 text-gray-500">...</span>;
                  }
                  return null;
                }
                
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 text-sm rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Clear confirmation dialog removed - now using direct processing */}

      {/* Edit Dialog */}
      <EditSubmissionDialog
        isOpen={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedSubmission(null); // Reset selected submission when dialog closes
            releaseInteractionLock();
          }
        }}
        submission={selectedSubmission}
        onUpdate={(updatedSubmission?: Student) => {
          // Update local state immediately (optimistic update) - no parent reload needed
          // This matches the pattern used in handleClearClick
          if (updatedSubmission && selectedSubmission) {
            setLocalSubmissions(prevSubmissions => 
              prevSubmissions.map(s => 
                s.id === selectedSubmission.id ? updatedSubmission : s
              )
            );
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setSelectedSubmission(null); // Reset selected submission when dialog closes
            releaseInteractionLock();
          }
        }}
        title="Delete Submission"
        description={`Are you sure you want to delete ${selectedSubmission?.name}'s submission?\n\nThis action cannot be undone. The submission and all associated files will be permanently removed from the system.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
} 
