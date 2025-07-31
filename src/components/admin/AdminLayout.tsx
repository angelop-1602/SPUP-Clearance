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
      <Navigation 
        currentPage="admin" 
        showAdminLink={false} 
        user={user}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
} 