"use client";

import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DownloadConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (exportLink: string) => void;
  studentName?: string;
}

export function DownloadConfirmationDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText = 'Remove from Storage',
  cancelText = 'Keep in Storage',
  onConfirm,
  studentName = ''
}: DownloadConfirmationDialogProps) {
  const [exportLink, setExportLink] = useState('');

  // Reset the input when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setExportLink('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm(exportLink.trim());
    onOpenChange(false);
  };

  const isConfirmDisabled = !exportLink.trim();

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4">
          <div>
            <label 
              htmlFor="exportLink" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Export Link (Required) *
            </label>
            <input
              id="exportLink"
              type="url"
              required
              value={exportLink}
              onChange={(e) => setExportLink(e.target.value)}
              placeholder="https://example.com/exported-file"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                !exportLink.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">
              Provide a link to the exported file for future reference (required to proceed with deletion)
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`bg-red-600 hover:bg-red-700 ${
              isConfirmDisabled ? 'opacity-50 cursor-not-allowed hover:bg-red-600' : ''
            }`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
