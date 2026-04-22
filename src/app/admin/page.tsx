"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { LoginForm } from '@/components/admin/LoginForm';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminTable } from '@/components/admin/AdminTable';
import { SubmissionCard } from '@/components/admin/SubmissionCard';

import { onAuthStateChange, subscribeToSubmissions } from '@/services/submissions';
import { AdminUser, Student } from '@/types';

export default function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
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

  // Submissions listener
  useEffect(() => {
    if (!user) {
      setSubmissions([]);
      setSelectedSubmission(null);
      setIsLoadingSubmissions(false);
      return;
    }

    setIsLoadingSubmissions(true);

    const unsubscribe = subscribeToSubmissions((nextSubmissions) => {
      setSubmissions(nextSubmissions);
      setSelectedSubmission((previous) =>
        previous
          ? nextSubmissions.find((submission) => submission.id === previous.id) || null
          : null
      );
      setIsLoadingSubmissions(false);
    });

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
    // The local listener handles updates automatically.
  };

  const handleLoginSuccess = (user: AdminUser) => {
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
