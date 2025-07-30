"use client";

import React from 'react';
import { adminLogout } from '@/services/firebase';
import { User } from 'firebase/auth';
import { Navigation } from '@/components/ui/Navigation';

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
      <Navigation currentPage="admin" showAdminLink={false} />
      
      {/* Admin Header */}
      <div className="bg-primary-600 border-b border-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="text-sm text-white">
              Welcome, <span className="font-medium">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-md text-sm font-medium text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
} 