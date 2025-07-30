"use client";

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { LoginForm } from '@/components/admin/LoginForm';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminTable } from '@/components/admin/AdminTable';
import { SubmissionCard } from '@/components/admin/SubmissionCard';
import { onAuthStateChange, getAllSubmissions } from '@/services/firebase';
import { Student, FilterOptions } from '@/types';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Student[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Student[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Student | null>(null);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<FilterOptions>({});

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setIsLoading(false);
      
      if (user) {
        loadSubmissions();
      }
    });

    return () => unsubscribe();
  }, []);

  const loadSubmissions = async (filters?: FilterOptions) => {
    setIsLoadingSubmissions(true);
    try {
      const data = await getAllSubmissions(filters);
      setSubmissions(data);
      setFilteredSubmissions(data);
    } catch (error) {
      console.error('Error loading submissions:', error);
      alert('Failed to load submissions');
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const handleFiltersChange = (filters: FilterOptions) => {
    setCurrentFilters(filters);
    loadSubmissions(filters);
  };

  const handleViewSubmission = (submission: Student) => {
    setSelectedSubmission(submission);
  };

  const handleCloseSubmission = () => {
    setSelectedSubmission(null);
  };

  const handleSubmissionUpdate = () => {
    // Reload submissions to reflect changes
    loadSubmissions(currentFilters);
  };

  const handleLoginSuccess = (user: User) => {
    setUser(user);
  };

  const handleLogout = () => {
    setUser(null);
    setSubmissions([]);
    setFilteredSubmissions([]);
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
    <AdminLayout user={user} onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Student Clearance Dashboard
          </h1>
          <button
            onClick={() => loadSubmissions(currentFilters)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Refresh
          </button>
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
          submissions={filteredSubmissions}
          onViewSubmission={handleViewSubmission}
          onFiltersChange={handleFiltersChange}
          isLoading={isLoadingSubmissions}
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
