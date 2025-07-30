"use client";

import React from 'react';
import { adminLogout } from '@/services/firebase';
import { User } from 'firebase/auth';

interface AdminLayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

export function AdminLayout({ children, user, onLogout }: AdminLayoutProps) {
  const handleLogout = async () => {
    try {
      await adminLogout();
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Student Clearance System
              </h1>
              <span className="ml-4 px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded">
                Admin Panel
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                Welcome, <span className="font-medium">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium text-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
} 