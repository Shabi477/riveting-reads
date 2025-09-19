'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Book {
  id: string;
  title: string;
  author: string;
}

interface AccessCode {
  id: number;
  code: string;
  bookId: string;
  expiresAt: string | null;
  createdAt: string;
}

export default function AccessCodesPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;
  
  const [book, setBook] = useState<Book | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [isClient, setIsClient] = useState(false);
  
  // Form state
  const [count, setCount] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    setIsClient(true);
    loadBook();
  }, [bookId]);

  const loadBook = async () => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const bookData = await response.json();
        setBook(bookData);
      } else {
        setMessage('❌ Failed to load book details');
      }
    } catch (error) {
      console.error('Error loading book:', error);
      setMessage('❌ Failed to load book details');
    } finally {
      setLoading(false);
    }
  };

  const generateAccessCodes = async () => {
    if (generating) return;
    
    setGenerating(true);
    setMessage('');
    
    try {
      const requestBody: any = { count };
      if (expiresAt) {
        requestBody.expiresAt = expiresAt;
      }

      const response = await fetch(`/api/admin/books/${bookId}/access-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('API Response:', JSON.stringify(data, null, 2));
        const codes = Array.isArray(data.codes) ? data.codes : [];
        console.log('Codes array:', JSON.stringify(codes, null, 2));
        setGeneratedCodes(codes);
        setMessage(`✅ ${String(data.message || 'Codes generated successfully')}`);
        setCount(1);
        setExpiresAt('');
      } else {
        setMessage(`❌ ${String(data.message || 'Failed to generate access codes')}`);
      }
    } catch (error) {
      console.error('Error generating access codes:', error);
      setMessage('❌ Failed to generate access codes');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setMessage(`📋 Code "${code}" copied to clipboard!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setMessage('❌ Failed to copy code');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading book details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/admin/books/${bookId}/chapters`)}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Chapters
              </button>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Access Code Generator
            </h1>
            <div></div>
          </div>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Book Information */}
        {book && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Book Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Title</p>
                <p className="font-medium text-gray-900">{book.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Author</p>
                <p className="font-medium text-gray-900">{book.author}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Book ID</p>
                <p className="font-medium text-gray-900 font-mono text-sm">{book.id}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.includes('❌') 
              ? 'bg-red-50 text-red-800 border-red-200' 
              : message.includes('📋')
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-green-50 text-green-800 border-green-200'
          }`}>
            {message}
          </div>
        )}

        {/* Generate Access Codes Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate New Access Codes</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-2">
                Number of Codes
              </label>
              <input
                type="number"
                id="count"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Generate 1-100 codes at once</p>
            </div>
            
            <div>
              <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-700 mb-2">
                Expiration Date (Optional)
              </label>
              <input
                type="date"
                id="expiresAt"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={generateAccessCodes}
              disabled={generating || !book}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  🎫 Generate Access Codes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Codes Display */}
        {generatedCodes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generated Access Codes ({generatedCodes.length})
            </h2>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Important: Save These Codes Now
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>These access codes are only shown once for security reasons. Please copy and save them now. Students can use any of these codes to access the book &quot;{book?.title || 'this book'}&quot;.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {generatedCodes.map((accessCode, index) => {
                console.log(`Rendering accessCode ${index}:`, typeof accessCode, accessCode);
                
                // Ensure accessCode is an object with expected properties
                if (!accessCode || typeof accessCode !== 'object') {
                  console.log(`Skipping invalid accessCode at ${index}:`, accessCode);
                  return null;
                }
                
                // Extract and validate all properties as strings
                const codeId = String(accessCode.id || index);
                const codeValue = String(accessCode.code || 'ERROR');
                const createdAtValue = accessCode.createdAt ? String(accessCode.createdAt) : null;
                const expiresAtValue = accessCode.expiresAt ? String(accessCode.expiresAt) : null;
                
                return (
                  <div key={codeId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-600">Code #{index + 1}:</span>
                          <code className="bg-white px-3 py-1 rounded border font-mono text-lg font-bold text-blue-900 select-all">
                            {codeValue}
                          </code>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {isClient && createdAtValue ? `Created: ${new Date(createdAtValue).toLocaleString()}` : 'Created: Unknown'}
                          {isClient && expiresAtValue && (
                            <span className="ml-4">
                              Expires: {new Date(expiresAtValue).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(codeValue)}
                        className="ml-3 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm font-medium transition-colors"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-medium text-blue-900 mb-2">How to Use These Codes:</h3>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Give any of these codes to your students</li>
                <li>2. Students go to the redemption page in the student area</li>
                <li>3. They enter the code to unlock access to "{book?.title}"</li>
                <li>4. Multiple students can use the same code (until you generate individual codes)</li>
              </ol>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}