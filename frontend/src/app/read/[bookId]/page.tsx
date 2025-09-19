'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Chapter {
  id: string;
  title: string;
  indexInBook: number;
  audioUrl: string;
  jsonUrl: string;
  createdAt: string;
}

interface Book {
  id: string;
  title: string;
}

interface ReadingProgress {
  chapterIndex: number;
  audioPosition: number;
  lastReadAt: string;
  isCompleted: boolean;
}

export default function BookReaderPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [book, setBook] = useState<Book | null>(null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const params = useParams();
  const bookId = params.bookId as string;

  useEffect(() => {
    setIsClient(true);
    console.log('🎯 BookReaderPage mounted, bookId:', bookId);
    if (bookId) {
      loadChapters();
      loadProgress();
    }
  }, [bookId]);

  const loadProgress = async () => {
    try {
      const response = await fetch(`/api/progress?bookId=${bookId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress);
      }
    } catch (err) {
      console.error('Load progress error:', err);
    }
  };

  const loadChapters = async () => {
    try {
      console.log('📚 Loading chapters for bookId:', bookId);
      const response = await fetch(`/api/chapters/${bookId}`, {
        credentials: 'include',
      });
      
      console.log('📡 Chapters response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login');
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          console.log('🚫 Access denied');
          setError('You do not have access to this book. Please check your library or redeem an access code.');
          return;
        }
        throw new Error('Failed to load chapters');
      }

      const data = await response.json();
      console.log('📖 Chapters data received:', data);
      setChapters(data.chapters || []);
      
      // Extract book info from first chapter or set a default
      if (data.chapters && data.chapters.length > 0) {
        setBook({ id: bookId, title: data.chapters[0].title || 'Spanish Storybook' });
        console.log('✅ Successfully loaded', data.chapters.length, 'chapters');
      } else {
        console.log('⚠️ No chapters found in response');
      }
    } catch (err) {
      setError('Failed to load book chapters');
      console.error('❌ Load chapters error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fef7f0] to-[#fff1e6] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-3 border-orange-500 mb-6"></div>
          <p className="text-gray-700 text-lg font-medium">Loading chapters...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fef7f0] to-[#fff1e6]">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center">
            <div className="text-8xl mb-6">😔</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6 font-['Inter']" style={{fontFamily: 'Inter, sans-serif'}}>Unable to Load Book</h2>
            <p className="text-gray-700 mb-10 text-lg">{error}</p>
            <div className="space-x-6">
              <Link
                href="/library"
                className="bee-btn bee-btn-primary inline-flex items-center px-8 py-4 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                Back to Library
              </Link>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                className="bg-gray-600 text-white px-8 py-4 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:bg-gray-700 transform hover:-translate-y-1 transition-all duration-200"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fef7f0] to-[#fff1e6]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-6">
              <Link
                href="/library"
                className="text-orange-600 hover:text-orange-700 flex items-center font-medium text-lg transition-colors duration-200"
              >
                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" />
                </svg>
                Back to Library
              </Link>
              <h1 className="text-3xl font-bold flex items-center" style={{fontFamily: 'Inter, sans-serif', color: '#374151'}}>
                <img src="/rr-logo.png" alt="Riveting Reads" className="w-8 h-8 mr-3" />
                {book?.title || 'Spanish Storybook'}
              </h1>
            </div>
            <nav className="flex items-center space-x-6">
              <Link 
                href="/word-bank" 
                className="text-gray-700 hover:text-orange-600 font-medium text-lg transition-colors duration-200"
              >
                Word Bank
              </Link>
              <Link
                href="/library"
                className="text-gray-700 hover:text-orange-600 font-medium text-lg transition-colors duration-200"
              >
                Library
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-10 py-12">
        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-6" style={{color: '#374151', fontFamily: 'Inter, sans-serif'}}>Table of Contents</h2>
          <p className="text-gray-700 text-xl leading-relaxed">Choose a chapter to begin your Spanish learning journey</p>
        </div>

        {chapters.length > 0 ? (
          <div className="space-y-6">
            {chapters.map((chapter) => {
              const isCurrentChapter = progress && progress.chapterIndex === chapter.indexInBook;
              const isCompleted = progress && progress.chapterIndex > chapter.indexInBook;
              const hasProgress = isCurrentChapter && progress.audioPosition > 0;

              return (
                <div
                  key={chapter.id}
                  className={`bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 ${
                    isCompleted ? 'border-green-400' : isCurrentChapter ? 'border-orange-400' : 'border-gray-300'
                  }`}
                >
                  <div className="p-8">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-3">
                          <span className={`text-sm px-4 py-2 rounded-full font-semibold ${
                            isCompleted ? 'bg-green-100 text-green-800' : 
                            isCurrentChapter ? 'bg-orange-100 text-orange-800' : 
                            'bg-gray-100 text-gray-700'
                          }`}>
                            Chapter {chapter.indexInBook}
                          </span>
                          {isCompleted && (
                            <span className="text-green-600">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                              </svg>
                            </span>
                          )}
                          <h3 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Inter, sans-serif'}}>{chapter.title}</h3>
                        </div>
                        
                        {hasProgress && (
                          <div className="mb-4">
                            <div className="flex items-center space-x-3 text-base text-orange-600 bg-orange-50 px-4 py-2 rounded-full">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
                              </svg>
                              <span className="font-medium">Resume from {Math.floor(progress!.audioPosition / 60)}:{String(progress!.audioPosition % 60).padStart(2, '0')}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center space-x-6 text-base text-gray-600">
                          {chapter.audioUrl && (
                            <span className="flex items-center">
                              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.813L4.832 14H3a1 1 0 01-1-1V7a1 1 0 011-1h1.832l3.551-2.813A1 1 0 019.383 3.076zM14.657 2.343a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.414A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.829 1 1 0 010-1.414z" />
                              </svg>
                              Audio available
                            </span>
                          )}
                          <span>Interactive reading</span>
                          <span>Tap-to-learn vocabulary</span>
                          {isCompleted && <span className="text-green-600 font-medium">Completed</span>}
                        </div>
                      </div>
                      <div className="ml-8">
                        <Link
                          href={`/read/${bookId}/chapter/${chapter.indexInBook}`}
                          className={`inline-flex items-center px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 ${
                            isCurrentChapter 
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : isCompleted
                              ? 'bg-gray-600 text-white hover:bg-gray-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          style={{
                            backgroundColor: isCompleted ? '#6b7280' : '#3b82f6'
                          }}
                        >
                          <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                          </svg>
                          {isCurrentChapter && hasProgress ? 'Resume Reading' : isCompleted ? 'Read Again' : 'Start Reading'}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-8xl mb-6">📖</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4" style={{fontFamily: 'Inter, sans-serif'}}>No chapters available</h3>
            <p className="text-gray-700 mb-8 text-lg">This book doesn't have any chapters yet.</p>
            <Link
              href="/library"
              className="bee-btn bee-btn-primary inline-flex items-center px-8 py-4 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Back to Library
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}