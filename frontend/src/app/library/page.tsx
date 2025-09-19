'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/dateUtils';

interface Book {
  id: string;
  title: string;
  createdAt: string;
  unlockedAt: string;
  coverImageUrl?: string;
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [bookId, setBookId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const router = useRouter();

  const loadBooks = async () => {
    try {
      setIsLoading(true);
      setError(''); // Clear previous errors
      const result = await api.getBooks();
      
      if (result.books) {
        setBooks(result.books);
      } else {
        setError('Failed to load books');
      }
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        // Handle 401 - redirect to login
        router.push('/login');
        return;
      }
      setError(error instanceof ApiError ? error.message : 'An error occurred while loading books');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRedeeming(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await api.redeemBook({ code: redeemCode, bookId });
      
      // Success - the API call succeeded without throwing an error
      setSuccessMessage(`Book "${result.book?.title || 'Unknown'}" has been unlocked!`);
      setRedeemCode('');
      setBookId('');
      setShowRedeemForm(false);
      // Reload books to show the newly unlocked book
      await loadBooks();
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        // Handle 401 - redirect to login
        router.push('/login');
        return;
      }
      setError(error instanceof ApiError ? error.message : 'An error occurred while redeeming the code');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      router.push('/');
    } catch (error) {
      // Even if logout fails, redirect to home
      router.push('/');
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fef7f0', background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
      {/* Header */}
      <header className="shadow-lg border-b" style={{ backgroundColor: 'white', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold flex items-center" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>
                <img src="/rr-logo.png" alt="Riveting Reads" className="w-8 h-8 mr-3" />
                Riveting Reads
              </h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Link 
                href="/word-bank" 
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Word Bank
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Logout
              </button>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title and Actions */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-4xl font-bold mb-3" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              My Library
            </h2>
            <p className="text-lg" style={{ color: '#64748b' }}>Discover amazing Spanish stories</p>
          </div>
          <button
            onClick={() => setShowRedeemForm(!showRedeemForm)}
            className="px-8 py-4 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            style={{ backgroundColor: '#3b82f6', boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)' }}
          >
            {showRedeemForm ? 'Cancel' : 'Redeem Code'}
          </button>
        </div>

        {/* Global Error Banner */}
        {error && !showRedeemForm && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-8 flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={loadBooks}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Redeem Form */}
        {showRedeemForm && (
          <div className="bee-card mb-8">
            <h3 className="text-lg font-semibold bee-text-dark mb-4">Redeem Access Code</h3>
            <form onSubmit={handleRedeem} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Code
                  </label>
                  <input
                    type="text"
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    placeholder="Enter access code (e.g., BOOK1-ACCESS-2025)"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Book ID
                  </label>
                  <input
                    type="text"
                    value={bookId}
                    onChange={(e) => setBookId(e.target.value.toLowerCase())}
                    placeholder="Enter book ID (e.g., book1)"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {error && showRedeemForm && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isRedeeming}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedeeming ? 'Redeeming...' : 'Redeem Book'}
              </button>
            </form>
          </div>
        )}

        {/* Books Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Loading your books...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No books yet</h3>
            <p className="text-gray-600 mb-6">Redeem an access code to unlock your first Spanish storybook!</p>
            <button
              onClick={() => setShowRedeemForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Redeem Your First Book
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-5">
            {books.map((book) => (
              <div key={book.id} className="bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' }}>
                {/* Book Cover Image - Book-like aspect ratio */}
                {book.coverImageUrl ? (
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img 
                      src={book.coverImageUrl} 
                      alt={`${book.title} cover`}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: 'center top' }}
                      onError={(e) => {
                        // Fallback to default icon if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center bg-gray-50">
                      <div className="text-3xl">📖</div>
                    </div>
                    
                    {/* Unlocked badge - minimal */}
                    <div className="absolute top-1 right-1">
                      <span className="text-xs text-green-600 bg-white/90 px-1.5 py-0.5 rounded-full font-medium shadow-sm">
                        ✓
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[3/4] flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="text-3xl mb-1">📖</div>
                      <span className="text-xs text-green-600 bg-white px-1.5 py-0.5 rounded-full font-medium">
                        ✓
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Title and Button below image - Slightly larger */}
                <div className="p-3">
                  <h3 className="text-base font-semibold text-center mb-2 leading-tight line-clamp-2" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>{book.title}</h3>
                  <Link
                    href={`/read/${book.id}`}
                    className="block w-full text-white text-center py-2 rounded-lg font-medium text-sm transition-colors"
                    style={{ backgroundColor: '#22c55e' }}
                  >
                    Read
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}