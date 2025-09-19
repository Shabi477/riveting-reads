'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LocalImageUploader } from '@/components/LocalImageUploader';

export default function NewBookPage() {
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    kdpCode: '',
    coverImageUrl: '',
  });
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const bookData = {
        id: formData.id.trim(),
        title: formData.title.trim(),
        kdpCode: formData.kdpCode.trim(),
        coverImageUrl: uploadedCoverUrl || formData.coverImageUrl.trim() || null,
      };

      const response = await fetch('/api/admin/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(bookData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create book');
      }

      const result = await response.json();
      router.push(`/admin/books/${result.book.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUploadComplete = async (imageUrl: string) => {
    try {
      setUploadedCoverUrl(imageUrl);
      // Update form data to use the uploaded image
      setFormData(prev => ({ ...prev, coverImageUrl: imageUrl }));
    } catch (error) {
      console.error('Error handling upload completion:', error);
      setError('Failed to process uploaded image');
    }
  };

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
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/admin/books"
              className="text-indigo-600 hover:text-indigo-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" />
              </svg>
              Back to Books
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Add New Book</h2>
          <p className="text-gray-600 mt-2">Create a new Spanish storybook for your library</p>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="id" className="block text-sm font-medium text-gray-700 mb-2">
                  Book ID *
                </label>
                <input
                  id="id"
                  name="id"
                  type="text"
                  value={formData.id}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter unique book ID (e.g., book1, book2)"
                />
              </div>

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter book title"
                />
              </div>
            </div>

            <div>
              <label htmlFor="kdpCode" className="block text-sm font-medium text-gray-700 mb-2">
                KDP Code <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <input
                id="kdpCode"
                name="kdpCode"
                type="text"
                value={formData.kdpCode}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter KDP code for printed book companion (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Book Cover Image
              </label>
              <div className="space-y-4">
                {uploadedCoverUrl && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-700 font-medium mb-2">✅ Cover image uploaded successfully!</p>
                    <img 
                      src={uploadedCoverUrl} 
                      alt="Book cover preview" 
                      className="w-32 h-40 object-cover rounded-lg border shadow-md"
                    />
                  </div>
                )}
                <LocalImageUploader
                  onUploadComplete={handleUploadComplete}
                  acceptedFileTypes={['image/png', 'image/jpeg', 'image/webp']}
                  maxFileSize={5 * 1024 * 1024} // 5MB
                  className="border-2 border-dashed border-gray-300 rounded-lg"
                />
                <p className="text-sm text-gray-500">
                  Upload a high-quality cover image (PNG, JPG, or WEBP, max 5MB)
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6">
              <Link
                href="/admin/books"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Book'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}