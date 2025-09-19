'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDate, formatDateTime } from '@/lib/dateUtils';
import { api } from '@/lib/api';

interface Book {
  id: string;
  title: string;
  author: string;
}

interface AccessCode {
  id: number;
  code: string;
  bookId: string;
  status: string;
  expirationDate?: string;
  redeemedBy?: string;
  redeemedAt?: string;
  createdAt: string;
}

export default function AccessCodesPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generateForm, setGenerateForm] = useState({
    count: 10,
    expirationDays: 30,
  });
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    if (selectedBookId) {
      loadAccessCodes();
    } else {
      setAccessCodes([]);
    }
  }, [selectedBookId]);

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
      if (data.books && data.books.length > 0) {
        setSelectedBookId(data.books[0].id);
      }
    } catch (err) {
      setError('Failed to load books');
      console.error('Books error:', err);
    }
  };

  const loadAccessCodes = async () => {
    if (!selectedBookId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/books/${selectedBookId}/access-codes`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to load access codes');
      }

      const data = await response.json();
      setAccessCodes(data);
    } catch (err) {
      setError('Failed to load access codes');
      console.error('Access codes error:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateAccessCodes = async () => {
    if (!selectedBookId) return;
    
    setGenerating(true);
    setError('');
    
    try {
      const payload = {
        count: generateForm.count,
        expirationDate: generateForm.expirationDays > 0 
          ? new Date(Date.now() + generateForm.expirationDays * 24 * 60 * 60 * 1000).toISOString()
          : null,
      };

      const response = await fetch(`/api/admin/books/${selectedBookId}/access-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate access codes');
      }

      const result = await response.json();
      // Extract just the code strings from the AccessCode objects
      const codeStrings = (result.codes || []).map((accessCode: any) => 
        typeof accessCode === 'string' ? accessCode : accessCode.code
      );
      setNewCodes(codeStrings);
      setShowGenerateModal(false);
      loadAccessCodes(); // Reload the codes list
    } catch (err: any) {
      setError(err.message || 'Failed to generate access codes');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const selectedBook = books.find(book => book.id === selectedBookId);

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
                onClick={async () => {
                  try {
                    await api.logout();
                    router.push('/admin/login');
                  } catch { router.push('/admin/login'); }
                }}
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
              className="text-indigo-200 hover:text-white font-medium"
            >
              Books
            </Link>
            <Link
              href="/admin/access-codes"
              className="text-white font-semibold border-b-2 border-white pb-1"
            >
              Access Codes
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Access Code Management</h2>
            <p className="text-gray-600 mt-2">Generate and manage access codes for your books</p>
          </div>
          {selectedBookId && (
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
              </svg>
              Generate Codes
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Book Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Book</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bookSelect" className="block text-sm font-medium text-gray-700 mb-2">
                Choose a book to manage its access codes
              </label>
              <select
                id="bookSelect"
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select a book...</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title} by {book.author}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* New Generated Codes */}
        {newCodes.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-green-900 mb-4">
              🎉 Generated {newCodes.length} New Access Codes
            </h3>
            <p className="text-green-700 mb-4">
              Save these codes securely! They will not be shown again.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
              {newCodes.map((code, index) => (
                <div
                  key={index}
                  className="bg-white p-2 rounded border text-center font-mono text-sm cursor-pointer hover:bg-gray-50"
                  onClick={() => copyToClipboard(code)}
                  title="Click to copy"
                >
                  {String(code)}
                </div>
              ))}
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => copyToClipboard(newCodes.join('\n'))}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                Copy All Codes
              </button>
              <button
                onClick={() => setNewCodes([])}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Access Codes Table */}
        {selectedBook && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Access Codes for "{selectedBook.title}"
              </h3>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading access codes...</div>
                </div>
              ) : accessCodes.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Redeemed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {accessCodes.map((accessCode) => (
                      <tr key={accessCode.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          <span 
                            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                            onClick={() => copyToClipboard(accessCode.code)}
                            title="Click to copy"
                          >
                            {accessCode.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                            accessCode.status === 'unused' 
                              ? 'bg-green-100 text-green-800'
                              : accessCode.status === 'redeemed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {accessCode.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {accessCode.expirationDate 
                            ? formatDate(accessCode.expirationDate)
                            : 'Never'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {accessCode.redeemedAt 
                            ? formatDateTime(accessCode.redeemedAt)
                            : '-'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(accessCode.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🔑</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No access codes yet</h3>
                  <p className="text-gray-600 mb-4">Generate access codes for this book to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedBook && books.length > 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a book</h3>
            <p className="text-gray-600">Choose a book above to view and manage its access codes.</p>
          </div>
        )}

        {books.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No books available</h3>
            <p className="text-gray-600 mb-4">You need to create books before generating access codes.</p>
            <Link
              href="/admin/books/new"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
            >
              Create Your First Book
            </Link>
          </div>
        )}
      </div>

      {/* Generate Codes Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Access Codes</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of codes to generate
                </label>
                <input
                  id="count"
                  type="number"
                  min="1"
                  max="100"
                  value={generateForm.count}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="expirationDays" className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration (days from now, 0 = never expires)
                </label>
                <input
                  id="expirationDays"
                  type="number"
                  min="0"
                  max="365"
                  value={generateForm.expirationDays}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, expirationDays: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={generating}
              >
                Cancel
              </button>
              <button
                onClick={generateAccessCodes}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}