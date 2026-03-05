"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Student, FilterOptions } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EllipsisVertical, Eye, Download, CheckCircle, Edit, ChevronLeft, ChevronRight, Link2, FileDown, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadWithConfirmation, downloadSubmissionAsFolder } from '@/services/exportService';
import {
  deleteSubmission,
  markSubmissionAsExported,
  setUndergradAllClear,
  updateSubmissionStatus,
} from '@/services/firebase';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { DownloadConfirmationDialog } from '@/components/ui/DownloadConfirmationDialog';
import { EditSubmissionDialog } from '@/components/admin/EditSubmissionDialog';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getResearchTypeLabel,
  isNotApplicableResearchType,
  matchesResearchTypeFilter,
} from '@/utils/researchType';

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

type TabType = 'all' | 'pending' | 'cleared';

const ITEMS_PER_PAGE = 10;
const SHOW_FOLDER_DOWNLOAD = false;

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
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Student | null>(null);
  
  // Local state for optimistic updates
  const [localSubmissions, setLocalSubmissions] = useState<Student[]>(submissions);
  const [isDeleting, setIsDeleting] = useState<Set<string>>(new Set());

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
    if (downloadDialogOpen || editDialogOpen || deleteDialogOpen) return;

    const timer = window.setTimeout(() => {
      releaseInteractionLock();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [downloadDialogOpen, editDialogOpen, deleteDialogOpen, releaseInteractionLock]);
  
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
  
  // Truncate name function
  const truncateName = (name: string, maxLength: number = 25) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  // Dialog handlers
  const handleDownloadClick = async (submission: Student) => {
    if (submission.isExported) {
      toast.info('This submission was already downloaded and removed from storage.');
      return;
    }

    // Show loading toast
    toast.loading(`Preparing download for ${submission.name}'s submission...`, { id: `download-${submission.id}` });

    try {
      // Step 1: Download the file in background
      await downloadWithConfirmation(submission);
      
      // Step 2: Show success and ask for export link
      toast.success(`Download completed! Check your Downloads folder.`, { id: `download-${submission.id}` });
      
      // Step 3: Show dialog for storage deletion with export link
      setSelectedSubmission(submission);
      setDownloadDialogOpen(true);
      
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file. Please try again.', { id: `download-${submission.id}` });
    }
  };

  const handleDownloadFolderClick = async (submission: Student) => {
    if (submission.isExported) {
      toast.info('This submission was already downloaded and removed from storage.');
      return;
    }

    toast.loading(`Preparing folder for ${submission.name}...`, { id: `download-folder-${submission.id}` });
    try {
      await downloadSubmissionAsFolder(submission);
      toast.success('Files extracted to your chosen folder.', { id: `download-folder-${submission.id}` });
    } catch (error: unknown) {
      console.error('Folder download error:', error);
      const message = error instanceof Error
        ? error.message
        : 'Failed to download as folder. Use standard Download instead.';
      toast.error(message, { id: `download-folder-${submission.id}` });
    }
  };

  const handleDownloadConfirm = async (exportLink: string) => {
    if (!selectedSubmission) return;
    
    // Close dialog immediately for better UX
    setDownloadDialogOpen(false);
    
    // Show processing toast
    toast.loading(`Removing ${selectedSubmission.name}'s file from storage...`, { id: `storage-${selectedSubmission.id}` });
    
    try {
      // Delete from storage and optionally save export link
      await markSubmissionAsExported(selectedSubmission.id, true);
      
      // If export link is provided, save it to the submission
      if (exportLink.trim()) {
        const { setSubmissionExportLink } = await import('@/services/firebase');
        await setSubmissionExportLink(selectedSubmission.id, exportLink.trim());
      }
      
      // Update local state only after server operations complete successfully
      setLocalSubmissions(prevSubmissions => 
        prevSubmissions.map(s => 
          s.id === selectedSubmission.id 
            ? { ...s, isExported: true, exportedAt: new Date(), exportLink: exportLink.trim() || undefined }
            : s
        )
      );
      
      toast.success(`File removed from storage. Export link saved.`, { id: `storage-${selectedSubmission.id}` });
      
    } catch (error) {
      console.error('Storage deletion error:', error);
      toast.error('Failed to remove file from storage. Please try again later.', { id: `storage-${selectedSubmission.id}` });
    } finally {
      setSelectedSubmission(null);
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

            if (existingSubmission.level === 'undergrad') {
              return {
                ...existingSubmission,
                status: 'Cleared' as const,
                leaderCleared: true,
                groupMembers: (existingSubmission.groupMembers ?? []).map((member) => ({
                  ...member,
                  isCleared: true,
                })),
              };
            }

            return {
              ...existingSubmission,
              status: 'Cleared' as const,
            };
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
    
    // Match DownloadConfirmationDialog pattern - close dialog first, then process
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {activeTab === 'all' && 'All Submissions'}
          {activeTab === 'pending' && 'Pending Submissions'}
          {activeTab === 'cleared' && 'Cleared Submissions'}
        </h2>
        
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
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                File
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Link
              </th>

              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedSubmissions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
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
                  
                  {/* File Indicator */}
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    {submission.isExported ? (
                      <div className="flex items-center justify-center" title="File downloaded">
                        <FileDown className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center" title="File available">
                        <FileDown className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                  </td>
                  
                  {/* Link Indicator */}
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    {submission.exportLink ? (
                      <div className="flex items-center justify-center" title="Export link attached">
                        <Link2 className="h-4 w-4 text-blue-600" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span className="text-gray-400">—</span>
                      </div>
                    )}
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
                        {SHOW_FOLDER_DOWNLOAD && !submission.isExported && (
                          <DropdownMenuItem 
                            onClick={() => handleDownloadFolderClick(submission)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            <span>Download as Folder</span>
                          </DropdownMenuItem>
                        )}
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
                <ExportedFlag isExported={submission.isExported} exportedAt={submission.exportedAt} />
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
              <div className="flex items-center space-x-4 pt-1">
                <div className="flex items-center space-x-1">
                  <FileDown className={`h-3 w-3 ${submission.isExported ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-xs text-gray-600">
                    {submission.isExported ? 'Downloaded' : 'Available'}
                  </span>
                </div>
                {submission.exportLink && (
                  <div className="flex items-center space-x-1">
                    <Link2 className="h-3 w-3 text-blue-600" />
                    <span className="text-xs text-gray-600">Link attached</span>
                  </div>
                )}
              </div>
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
                  disabled={submission.isExported}
                  className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
                    submission.isExported 
                      ? "bg-gray-400 cursor-not-allowed text-white" 
                      : "bg-orange-600 hover:bg-orange-700 text-white"
                  }`}
                >
                  {submission.isExported ? "Already Downloaded" : "Download"}
                </button>
              {SHOW_FOLDER_DOWNLOAD && !submission.isExported && (
                <button
                  onClick={() => handleDownloadFolderClick(submission)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-3 rounded-md transition-colors"
                >
                  Download as Folder
                </button>
              )}
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

      {/* Confirmation Dialogs */}
      <DownloadConfirmationDialog
        isOpen={downloadDialogOpen}
        onOpenChange={(open) => {
          setDownloadDialogOpen(open);
          if (!open) {
            setSelectedSubmission(null); // Reset selected submission when dialog closes
            releaseInteractionLock();
          }
        }}
        title="Confirm Storage Deletion"
        description={`The file for ${selectedSubmission?.name}'s submission has been downloaded to your computer.\n\nDo you want to remove it from Firebase Storage to save costs?\n\n✅ File downloaded to your computer\n🗑️ Remove from cloud storage (saves money)\n\nWARNING: Once deleted from storage, the file cannot be downloaded again from the admin panel.`}
        confirmText="Remove from Storage"
        cancelText="Keep in Storage"
        onConfirm={handleDownloadConfirm}
        studentName={selectedSubmission?.name}
      />

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
