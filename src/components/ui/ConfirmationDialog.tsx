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

interface ConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
  countdown?: number; // Countdown in seconds before confirm button is enabled
}

export function ConfirmationDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  variant = 'default',
  countdown = 0
}: ConfirmationDialogProps) {
  const [timeLeft, setTimeLeft] = useState(countdown);
  const [isCountdownActive, setIsCountdownActive] = useState(false);

  useEffect(() => {
    if (isOpen && countdown > 0) {
      setTimeLeft(countdown);
      setIsCountdownActive(true);
    } else {
      setIsCountdownActive(false);
    }
  }, [isOpen, countdown]);

  useEffect(() => {
    if (isCountdownActive && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isCountdownActive && timeLeft === 0) {
      setIsCountdownActive(false);
    }
  }, [isCountdownActive, timeLeft]);

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const isConfirmDisabled = isCountdownActive && timeLeft > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`${variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''} ${
              isConfirmDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isConfirmDisabled ? `${confirmText} (${timeLeft}s)` : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
