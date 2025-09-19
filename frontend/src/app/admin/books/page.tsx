'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  language: string;
  difficultyLevel: string;
  estimatedReadingTimeMinutes: number;
  coverImageUrl?: string;
  publicationDate?: string;
  createdAt: string;
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadBooks();
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

  const loadBooks = async () => {
    try {
      const response = await fetch('/api/admin/books', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error('Failed to load books');
      }

      const data = await response.json();
      setBooks(data.books || []);
    } catch (err) {
      setError('Failed to load books');
      console.error('Books error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete book');
      }

      setBooks(books.filter(book => book.id !== bookId));
      setDeleteBookId(null);
    } catch (err) {
      setError('Failed to delete book');
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading books...</div>
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
              className="text-indigo-200 hover:text-white font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/books"
              className="text-white font-semibold border-b-2 border-white pb-1"
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
        {/* Header with Add Button */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Manage Books</h2>
          <Link
            href="/admin/books/new"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Add New Book
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Books Grid */}
        {books.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <div key={book.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{book.title}</h3>
                      <p className="text-gray-600 text-sm">by {book.author}</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {book.difficultyLevel}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                    {book.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span>{book.language}</span>
                    <span>{book.estimatedReadingTimeMinutes} min read</span>
                  </div>

                  <div className="flex space-x-2">
                    <Link
                      href={`/admin/books/${book.id}`}
                      className="flex-1 text-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/admin/books/${book.id}/chapters`}
                      className="flex-1 text-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
                    >
                      Chapters
                    </Link>
                    <button
                      onClick={() => setDeleteBookId(book.id)}
                      className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No books yet</h3>
            <p className="text-gray-600 mb-4">Get started by adding your first Spanish storybook.</p>
            <Link
              href="/admin/books/new"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
            >
              Add New Book
            </Link>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteBookId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Book</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this book? This action cannot be undone and will also delete all associated chapters and access codes.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setDeleteBookId(null)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBookId && handleDeleteBook(deleteBookId)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}