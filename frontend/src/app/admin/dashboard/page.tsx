'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface AnalyticsData {
  totalUsers: number;
  totalBooks: number;
  totalChapters: number;
  totalAccessCodes: number;
  activeAccessCodes: number;
  redeemedAccessCodes: number;
  wordsLearned: number;
  recentBooks: Array<{
    id: string;
    title: string;
    author: string;
    chapterCount: number;
  }>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
      router.push('/admin/login');
    } catch (error) {
      // Even if logout fails, redirect to login
      router.push('/admin/login');
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/analytics/overview', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/admin/login';
          }
          return;
        }
        throw new Error('Failed to load analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">📚 Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 py-4">
            <Link
              href="/admin/dashboard"
              className="text-white font-semibold border-b-2 border-white pb-1"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/books"
              className="text-indigo-200 hover:text-white font-medium"
            >
              Books
            </Link>
            <Link
              href="/admin/access-codes"
              className="text-indigo-200 hover:text-white font-medium"
            >
              Access Codes
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{analytics?.totalUsers || 0}</p>
              </div>
              <div className="text-blue-500">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Books</p>
                <p className="text-3xl font-bold text-gray-900">{analytics?.totalBooks || 0}</p>
              </div>
              <div className="text-green-500">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 2H4v8h12V6z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Chapters</p>
                <p className="text-3xl font-bold text-gray-900">{analytics?.totalChapters || 0}</p>
              </div>
              <div className="text-purple-500">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Codes</p>
                <p className="text-3xl font-bold text-gray-900">{analytics?.activeAccessCodes || 0}</p>
              </div>
              <div className="text-yellow-500">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Recent Books</h3>
            </div>
            <div className="px-6 py-4">
              {analytics?.recentBooks?.length ? (
                <div className="space-y-4">
                  {analytics.recentBooks.map((book) => (
                    <div key={book.id} className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-gray-900">{book.title}</h4>
                        <p className="text-sm text-gray-500">by {book.author}</p>
                      </div>
                      <span className="text-sm text-gray-500">
                        {book.chapterCount} chapters
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No books created yet</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Access Code Statistics</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Codes Generated</span>
                <span className="font-semibold">{analytics?.totalAccessCodes || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active/Unused</span>
                <span className="font-semibold text-green-600">{analytics?.activeAccessCodes || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Redeemed</span>
                <span className="font-semibold text-blue-600">{analytics?.redeemedAccessCodes || 0}</span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-semibold">
                    {analytics?.totalAccessCodes ? 
                      Math.round((analytics.redeemedAccessCodes / analytics.totalAccessCodes) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/admin/books/new"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
              </svg>
              Add New Book
            </Link>
            <Link
              href="/admin/books"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 2H4v8h12V6z" />
              </svg>
              Manage Books
            </Link>
            <Link
              href="/admin/access-codes"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" />
              </svg>
              Generate Access Codes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}