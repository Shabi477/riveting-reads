'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SavedWord {
  id: number;
  spanishWord: string;
  englishTranslation: string;
  bookId: string;
  createdAt: string;
  ease: number;
}

export default function WordBankPage() {
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [flashcardMode, setFlashcardMode] = useState(false);

  useEffect(() => {
    fetchSavedWords();
  }, []);

  const fetchSavedWords = async () => {
    try {
      const response = await fetch('/api/words/saved', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSavedWords(data.words || []);
      } else {
        setError('Failed to load saved words');
      }
    } catch (error) {
      console.error('Error fetching saved words:', error);
      setError('Error loading saved words');
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    setCurrentCard((prev) => (prev + 1) % savedWords.length);
    setShowTranslation(false);
  };

  const prevCard = () => {
    setCurrentCard((prev) => (prev - 1 + savedWords.length) % savedWords.length);
    setShowTranslation(false);
  };

  const toggleTranslation = () => {
    setShowTranslation(!showTranslation);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading your word bank...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-red-600 mb-4">{error}</div>
            <button 
              onClick={fetchSavedWords}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fef7f0', background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
      {/* Header */}
      <div className="shadow-lg border-b" style={{ backgroundColor: 'white', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/library" className="flex items-center text-orange-600 hover:text-orange-700">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Library
              </Link>
              <h1 className="text-3xl font-bold" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>📚 Your Word Bank</h1>
            </div>
            {savedWords.length > 0 && (
              <div className="flex items-center space-x-4">
                <span className="text-base font-semibold" style={{ color: '#1e293b' }}>{savedWords.length} words saved</span>
                <button
                  onClick={() => setFlashcardMode(!flashcardMode)}
                  className="px-8 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
                  style={{
                    backgroundColor: flashcardMode ? '#22c55e' : '#3b82f6',
                    color: 'white',
                    boxShadow: flashcardMode ? '0 6px 20px rgba(34, 197, 94, 0.3)' : '0 6px 20px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  {flashcardMode ? '📋 List View' : '🎯 Flashcard Mode'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {savedWords.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <div className="text-6xl mb-6">📚</div>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#374151' }}>Your Word Bank is Empty</h2>
            <p className="text-lg mb-8" style={{ color: '#718096' }}>
              Start reading stories and click on words to add them to your personal vocabulary collection.
            </p>
            <Link
              href="/library"
              className="inline-flex items-center px-6 py-3 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
              style={{ backgroundColor: '#4a90e2', boxShadow: '0 4px 12px rgba(74, 144, 226, 0.3)' }}
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Start Reading Stories
            </Link>
          </div>
        ) : flashcardMode ? (
          /* Flashcard Mode */
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center min-h-[300px] flex flex-col justify-center">
              <div className="mb-6">
                <div className="text-sm text-gray-500 mb-2">
                  Card {currentCard + 1} of {savedWords.length}
                </div>
                <div className="text-4xl font-bold mb-4" style={{ color: '#374151' }}>
                  {savedWords[currentCard]?.spanishWord}
                </div>
                {showTranslation && (
                  <div className="text-2xl text-blue-600 font-medium">
                    {savedWords[currentCard]?.englishTranslation}
                  </div>
                )}
              </div>
              
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={prevCard}
                  className="p-3 bg-gray-200 hover:bg-gray-300 rounded-full"
                  disabled={savedWords.length <= 1}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={toggleTranslation}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {showTranslation ? 'Hide Translation' : 'Show Translation'}
                </button>
                <button
                  onClick={nextCard}
                  className="p-3 bg-gray-200 hover:bg-gray-300 rounded-full"
                  disabled={savedWords.length <= 1}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="text-xs text-gray-500">
                From: {savedWords[currentCard]?.bookId}
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#374151' }}>Your Saved Words</h2>
              <p className="text-gray-600">Click on any word to practice with flashcards</p>
            </div>
            
            <div className="grid gap-4">
              {savedWords.map((word, index) => (
                <div
                  key={word.id}
                  className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setCurrentCard(index);
                    setFlashcardMode(true);
                    setShowTranslation(false);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="text-lg font-semibold" style={{ color: '#374151' }}>
                          {word.spanishWord}
                        </div>
                        <div className="text-gray-500">→</div>
                        <div className="text-lg text-blue-600">
                          {word.englishTranslation}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                        <span>From: {word.bookId}</span>
                        <span>Added: {new Date(word.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}