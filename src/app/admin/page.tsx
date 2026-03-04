"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { LoginForm } from '@/components/admin/LoginForm';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminTable } from '@/components/admin/AdminTable';
import { SubmissionCard } from '@/components/admin/SubmissionCard';

import { onAuthStateChange } from '@/services/firebase';
import { toast } from 'sonner';
import { Student } from '@/types';
import { db } from '@/lib/firebase';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Student[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Student | null>(null);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);


  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Realtime submissions listener
  useEffect(() => {
    if (!user) {
      setSubmissions([]);
      setSelectedSubmission(null);
      setIsLoadingSubmissions(false);
      return;
    }

    setIsLoadingSubmissions(true);

    const submissionsQuery = query(
      collection(db, 'submissions'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const realtimeSubmissions = snapshot.docs.map((submissionDoc) => {
          const data = submissionDoc.data();
          return {
            ...data,
            id: submissionDoc.id,
            submittedAt: data.submittedAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.(),
            exportedAt: data.exportedAt?.toDate?.(),
            exportLink: data.exportLink || undefined,
          } as Student;
        });

        setSubmissions(realtimeSubmissions);
        setSelectedSubmission((previous) =>
          previous
            ? realtimeSubmissions.find((submission) => submission.id === previous.id) || null
            : null
        );
        setIsLoadingSubmissions(false);
      },
      (error) => {
        console.error('Realtime submissions listener error:', error);
        toast.error('Failed to sync submissions in real time');
        setIsLoadingSubmissions(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleFiltersChange = useCallback(() => {
    // Filtering is fully handled client-side in AdminTable.
  }, []);

  const handleViewSubmission = (submission: Student) => {
    setSelectedSubmission(submission);
  };

  const handleCloseSubmission = () => {
    setSelectedSubmission(null);
  };

  const handleSubmissionUpdate = () => {
    // Realtime listener handles updates automatically.
  };

  const handleLoginSuccess = (user: User) => {
    setUser(user);
  };

  const handleLogout = () => {
    setUser(null);
    setSubmissions([]);
    setSelectedSubmission(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated admin interface
  return (
    <AdminLayout user={user} onLogout={handleLogout} currentPage="admin">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              CPRINT Student Clearance Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Manage student clearance submissions</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-gray-900">
              {submissions.length}
            </div>
            <div className="text-sm text-gray-600">Total Submissions</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {submissions.filter(s => s.status === 'Submitted').length}
            </div>
            <div className="text-sm text-gray-600">Pending Review</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">
              {submissions.filter(s => s.status === 'Cleared').length}
            </div>
            <div className="text-sm text-gray-600">Cleared</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">
              {submissions.filter(s => s.level === 'undergrad').length}
            </div>
            <div className="text-sm text-gray-600">Undergraduate</div>
          </div>
        </div>

        {/* Submissions Table */}
        <AdminTable
          submissions={submissions}
          onViewSubmission={handleViewSubmission}
          onFiltersChange={handleFiltersChange}
          isLoading={isLoadingSubmissions}
          onSubmissionUpdate={handleSubmissionUpdate}
        />

        {/* Submission Detail Modal */}
        {selectedSubmission && (
          <SubmissionCard
            submission={selectedSubmission}
            onClose={handleCloseSubmission}
            onUpdate={handleSubmissionUpdate}
          />
        )}


      </div>
    </AdminLayout>
  );
}
