'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import InteractiveReader from '@/components/InteractiveReader';

interface Chapter {
  id: string;
  title: string;
  indexInBook: number;
  audioUrl: string;
  jsonUrl: string;
}

export default function ChapterReaderPage() {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;
  const chapterIndex = parseInt(params.chapterIndex as string);

  useEffect(() => {
    loadChaptersAndContent();
  }, [bookId, chapterIndex]);

  const loadChaptersAndContent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load chapters
      const chaptersResponse = await fetch(`/api/chapters/${bookId}`, {
        credentials: 'include',
      });

      if (!chaptersResponse.ok) {
        if (chaptersResponse.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load chapters');
      }

      const chaptersData = await chaptersResponse.json();
      console.log('📖 Chapters data received:', chaptersData);
      
      if (!chaptersData.chapters || chaptersData.chapters.length === 0) {
        throw new Error('No chapters found');
      }

      setChapters(chaptersData.chapters);
      
      // Find the current chapter
      const currentChapter = chaptersData.chapters.find(
        (ch: Chapter) => ch.indexInBook === chapterIndex
      );
      
      if (!currentChapter) {
        throw new Error(`Chapter ${chapterIndex} not found`);
      }

      setChapter(currentChapter);
      console.log('✅ Successfully loaded chapter:', currentChapter.title);

    } catch (error) {
      console.error('❌ Error loading chapter:', error);
      setError(error instanceof Error ? error.message : 'Failed to load chapter');
    } finally {
      setLoading(false);
    }
  };

  const getNextChapter = () => {
    return chapters.find(ch => ch.indexInBook === chapterIndex + 1);
  };

  const getPreviousChapter = () => {
    return chapters.find(ch => ch.indexInBook === chapterIndex - 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading chapter...</p>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Chapter Not Found</h2>
            <p className="text-gray-600 mb-8">{error || 'Unable to load this chapter'}</p>
            <Link
              href={`/read/${bookId}`}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Back to Chapters
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
      {/* Header */}
      <header className="shadow-lg border-b" style={{ backgroundColor: 'white', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href={`/read/${bookId}`}
                className="text-blue-600 hover:text-blue-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" />
                </svg>
                Chapters
              </Link>
              <div className="flex items-center space-x-2">
                <span className="text-sm px-3 py-1 rounded-full font-semibold" style={{ backgroundColor: '#fff1e6', color: '#ff6b35' }}>
                  Chapter {chapter.indexInBook}
                </span>
                <h1 className="text-2xl font-bold" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>{chapter.title}</h1>
              </div>
            </div>
            <nav className="flex items-center space-x-4">
              <Link 
                href={`/read/${bookId}/chapter/${chapterIndex}/activities`}
                className="text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2"
                style={{ backgroundColor: '#22c55e', boxShadow: '0 6px 20px rgba(34, 197, 94, 0.3)' }}
              >
                <span>🎯</span>
                <span>Practice Activities</span>
              </Link>
              <Link href="/word-bank" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Word Bank
              </Link>
              <Link href="/library" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Library
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Interactive Reader with Pre-Generated Audio */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InteractiveReader chapter={chapter} bookId={bookId} />
      </div>

      {/* Practice Activities Call-to-Action */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="rounded-3xl p-8 mb-8" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '2px solid #bbf7d0', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)' }}>
          <div className="text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Ready to Practice?
            </h3>
            <p className="text-lg text-gray-600 mb-6">
              Test your understanding with interactive activities including flashcards, comprehension questions, matching exercises, and writing prompts.
            </p>
            <Link
              href={`/read/${bookId}/chapter/${chapterIndex}/activities`}
              className="inline-flex items-center px-10 py-5 text-white rounded-2xl text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
              style={{ backgroundColor: '#22c55e', boxShadow: '0 8px 25px rgba(34, 197, 94, 0.4)' }}
            >
              <span className="mr-2">🎯</span>
              Start Practice Activities
              <svg className="w-5 h-5 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div>
            {getPreviousChapter() && (
              <Link
                href={`/read/${bookId}/chapter/${chapterIndex - 1}`}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
                </svg>
                Previous Chapter
              </Link>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              href={`/read/${bookId}/chapter/${chapterIndex}/activities`}
              className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <span className="mr-2">🎯</span>
              Activities
            </Link>
            
            {getNextChapter() && (
              <Link
                href={`/read/${bookId}/chapter/${chapterIndex + 1}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Next Chapter
                <svg className="w-5 h-5 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}