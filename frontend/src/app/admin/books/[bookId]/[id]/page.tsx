'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ObjectUploader } from '@/components/ObjectUploader';

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
  kdpCode: string;
  createdAt: string;
}

interface UploadResult<TMeta extends Record<string, unknown>, TFile extends Record<string, unknown>> {
  successful: Array<TFile & { uploadURL?: unknown }>;
  failed: Array<{ error: string }>;
}

export default function EditBookPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string>('');

  useEffect(() => {
    loadBook();
  }, [bookId]);

  const loadBook = async () => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (response.status === 404) {
          setError('Book not found');
          return;
        }
        throw new Error('Failed to load book');
      }

      const data = await response.json();
      setBook(data.book);
      if (data.book.coverImageUrl) {
        setUploadedCoverUrl(data.book.coverImageUrl);
      }
    } catch (err) {
      setError('Failed to load book');
      console.error('Load book error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!book) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData(e.currentTarget);
      const updateData = {
        title: formData.get('title') as string,
        author: formData.get('author') as string,
        description: formData.get('description') as string,
        language: formData.get('language') as string,
        difficultyLevel: formData.get('difficultyLevel') as string,
        estimatedReadingTimeMinutes: parseInt(formData.get('estimatedReadingTimeMinutes') as string),
        kdpCode: formData.get('kdpCode') as string,
        coverImageUrl: uploadedCoverUrl || book.coverImageUrl || '',
      };

      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to update book');
      }

      setSuccess('Book updated successfully!');
      // Reload book data to show updated information
      await loadBook();
    } catch (err) {
      setError('Failed to update book');
      console.error('Update book error:', err);
    } finally {
      setSaving(false);
    }
  };

  const getUploadParameters = async (file: File) => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get upload parameters');
      }

      const data = await response.json();
      return {
        url: data.uploadURL,
      };
    } catch (error) {
      console.error('Error getting upload parameters:', error);
      throw new Error('Failed to prepare upload');
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      const uploadedFile = result.successful?.[0];
      if (uploadedFile?.uploadURL && typeof uploadedFile.uploadURL === 'string') {
        setUploadedCoverUrl(uploadedFile.uploadURL);
        setSuccess('Cover image uploaded! Click "Save Changes" to apply.');
      }
    } catch (error) {
      console.error('Error handling upload completion:', error);
      setError('Failed to process uploaded image');
    }
  };

  const handleRemoveCover = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          coverImageUrl: '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove cover');
      }

      setUploadedCoverUrl('');
      await loadBook();
      setSuccess('Cover image removed successfully!');
    } catch (err) {
      setError('Failed to remove cover image');
      console.error('Remove cover error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading book...</div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Book Not Found</h1>
            <Link
              href="/admin/books"
              className="text-indigo-600 hover:text-indigo-500"
            >
              ← Back to Books
            </Link>
          </div>
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
              <Link
                href="/admin/books"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                ← Back to Books
              </Link>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Edit Book</h2>
          <p className="text-gray-600 mt-2">Update book details and upload cover image</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Cover Image Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Book Cover Image
              </label>
              
              {/* Current Cover Preview */}
              {(uploadedCoverUrl || book.coverImageUrl) && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Current cover:</p>
                  <div className="relative inline-block">
                    <img 
                      src={uploadedCoverUrl || book.coverImageUrl} 
                      alt="Book cover preview"
                      className="w-32 h-48 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      disabled={saving}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Upload New Cover */}
              <ObjectUploader
                onGetUploadParameters={getUploadParameters}
                onUploadComplete={handleUploadComplete}
                acceptedFileTypes={['image/png', 'image/jpeg', 'image/webp']}
                maxFileSize={5 * 1024 * 1024} // 5MB
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 transition-colors"
              />
            </div>

            {/* Book Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  defaultValue={book.title}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
                  Author *
                </label>
                <input
                  type="text"
                  id="author"
                  name="author"
                  defaultValue={book.author}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                  Language *
                </label>
                <select
                  id="language"
                  name="language"
                  defaultValue={book.language}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Spanish">Spanish</option>
                  <option value="English">English</option>
                </select>
              </div>

              <div>
                <label htmlFor="difficultyLevel" className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty Level *
                </label>
                <select
                  id="difficultyLevel"
                  name="difficultyLevel"
                  defaultValue={book.difficultyLevel}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label htmlFor="estimatedReadingTimeMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Reading Time (minutes) *
                </label>
                <input
                  type="number"
                  id="estimatedReadingTimeMinutes"
                  name="estimatedReadingTimeMinutes"
                  defaultValue={book.estimatedReadingTimeMinutes}
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="kdpCode" className="block text-sm font-medium text-gray-700 mb-1">
                  KDP Code *
                </label>
                <input
                  type="text"
                  id="kdpCode"
                  name="kdpCode"
                  defaultValue={book.kdpCode}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={book.description}
                rows={4}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <Link
                href="/admin/books"
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}