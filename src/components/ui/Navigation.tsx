"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'firebase/auth';

interface NavigationProps {
  currentPage?: 'home' | 'track' | 'admin';
  showAdminLink?: boolean;
  // Admin-specific props
  user?: User | null;
  onLogout?: () => void;
}

export function Navigation({ currentPage = 'home', showAdminLink = true, user, onLogout }: NavigationProps) {
  const getPageBadge = () => {
    switch (currentPage) {
      case 'home':
        return (
          <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded">
            New Submission
          </span>
        );
      case 'track':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
            Track Submission
          </span>
        );
      case 'admin':
        return (
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
            Admin Panel
          </span>
        );
      default:
        return null;
    }
  };

  const getNavigationLinks = () => {
    const links = [];
    
    if (currentPage !== 'home') {
      links.push(
        <Link
          key="home"
          href="/"
          className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          New Submission
        </Link>
      );
    }
    
    if (currentPage !== 'track') {
      links.push(
        <Link
          key="track"
          href="/track"
          className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          Track Submission
        </Link>
      );
    }
    
    if (showAdminLink && currentPage !== 'admin') {
      links.push(
        <Link
          key="admin"
          href="/admin"
          className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          Admin Login
        </Link>
      );
    }
    
    return links;
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center h-auto sm:h-16 py-3 sm:py-0">
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-3 sm:mb-0">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              {/* Primary logo attempt */}
              <Image
                src="/SPUP-final-logo.png"
                alt="St. Paul University Philippines"
                width={40}
                height={40}
                className="w-8 h-8 sm:w-10 sm:h-10"
                priority
                unoptimized
                onError={(e) => {
                  console.log('Logo failed to load, showing fallback');
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              {/* Fallback logo */}
              <div 
                className="logo-fallback w-8 h-8 sm:w-10 sm:h-10 bg-primary-600 rounded-full items-center justify-center text-white font-bold text-xs sm:text-sm"
                style={{ display: 'none' }}
              >
                SPUP
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 text-center sm:text-left">
                  Student Clearance System
                </h1>
                {/* {getPageBadge()} */}
              </div>
            </div>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {getNavigationLinks()}

            {currentPage === 'admin' && user && (
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-12">
              <div className="text-sm ">
                Welcome, <span className="font-medium">{user.email}</span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-md text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
      )}
          </div>
        </div>
      </div>

      
    </header>
  );
} 