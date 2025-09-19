'use client';

import { useState, useEffect } from 'react';
import { FlashcardActivity, ActivityProgress } from '../../../../../../../lib/activityTypes';

interface FlashcardsProps {
  activity: FlashcardActivity;
  progress?: ActivityProgress;
  onComplete: (score?: number, answers?: Record<string, any>, timeSpent?: number) => void;
  onProgress: (answers: Record<string, any>, timeSpent?: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
  bookId: string;
}

export function Flashcards({
  activity,
  progress,
  onComplete,
  onProgress,
  onNext,
  onPrevious,
  canNavigateNext,
  canNavigatePrevious,
  bookId,
}: FlashcardsProps) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [startTime] = useState(Date.now());
  const [sessionStarted, setSessionStarted] = useState(false);
  const [savingWord, setSavingWord] = useState(false);
  const [wordSaved, setWordSaved] = useState<string | null>(null);

  const currentCard = activity.cards[currentCardIndex];
  
  useEffect(() => {
    // Load progress if available
    if (progress?.answers) {
      const savedKnownCards = progress.answers.knownCards || [];
      setKnownCards(new Set(savedKnownCards));
      setCurrentCardIndex(progress.answers.currentCardIndex || 0);
    }
    setSessionStarted(true);
  }, [progress]);

  useEffect(() => {
    // Auto-save progress every 30 seconds
    if (sessionStarted) {
      const interval = setInterval(() => {
        saveProgress();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [sessionStarted, knownCards, currentCardIndex]);

  const saveProgress = () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    onProgress({
      knownCards: Array.from(knownCards),
      currentCardIndex,
      totalCards: activity.cards.length,
    }, timeSpent);
  };

  const markAsKnown = async (cardId: string, known: boolean) => {
    const newKnownCards = new Set(knownCards);
    if (known) {
      newKnownCards.add(cardId);
      setWordSaved(null); // Clear any previous "saved" message
    } else {
      newKnownCards.delete(cardId);
      
      // If student doesn't know the word, add it to their personal word bank
      if (currentCard) {
        setSavingWord(true);
        try {
          await fetch('/api/words/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              spanishWord: currentCard.spanish,
              englishTranslation: currentCard.english,
              bookId: bookId, // Use the passed bookId
            }),
          });
          console.log('✅ Word added to word bank:', currentCard.spanish, '→', currentCard.english);
          
          // Show success feedback
          setWordSaved(currentCard.spanish);
          setTimeout(() => setWordSaved(null), 3000); // Hide after 3 seconds
        } catch (error) {
          console.error('Failed to save word to word bank:', error);
        } finally {
          setSavingWord(false);
        }
      }
    }
    setKnownCards(newKnownCards);
  };

  const nextCard = () => {
    if (currentCardIndex < activity.cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setWordSaved(null); // Clear word saved message when moving to next card
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
      setWordSaved(null); // Clear word saved message when moving to previous card
    }
  };

  const handleComplete = () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const score = Math.round((knownCards.size / activity.cards.length) * 100);
    
    onComplete(score, {
      knownCards: Array.from(knownCards),
      currentCardIndex,
      totalCards: activity.cards.length,
      completedAllCards: true,
    }, timeSpent);
  };

  const completionPercentage = Math.round((knownCards.size / activity.cards.length) * 100);
  const isCardKnown = knownCards.has(currentCard?.id || '');

  return (
    <div className="max-w-5xl mx-auto">
      {/* Activity Header */}
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>{activity.title}</h2>
        <p className="text-xl mb-8" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>{activity.instructions}</p>
        <div className="flex justify-center items-center space-x-4 flex-wrap gap-2">
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#3b82f6', color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            📚 {activity.cards.length} Cards
          </div>
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#22c55e', color: 'white', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
            ✅ {knownCards.size} Known ({completionPercentage}%)
          </div>
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#ff6b35', color: 'white', boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)' }}>
            ⏱️ ~{activity.estimatedTime} min
          </div>
        </div>
      </div>

      {/* Flashcard */}
      <div className="mb-10 flex justify-center">
        <div 
          className="relative w-[28rem] h-80 cursor-pointer perspective-1000 transform transition-all duration-300 hover:scale-105"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`
            relative w-full h-full transition-transform duration-700 transform-style-preserve-3d
            ${isFlipped ? 'rotate-y-180' : ''}
          `}>
            {/* Front of card (Spanish) */}
            <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-3xl shadow-lg flex items-center justify-center" style={{ border: '3px solid #ff6b35', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)' }}>
              <div className="text-center p-8">
                <div className="text-5xl font-bold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
                  {currentCard?.spanish}
                </div>
                <div className="text-lg font-medium" style={{ color: '#64748b' }}>
                  Click to reveal translation
                </div>
                {currentCard?.context && (
                  <div className="text-base mt-4 italic" style={{ color: '#94a3b8' }}>
                    "{currentCard.context}"
                  </div>
                )}
              </div>
            </div>

            {/* Back of card (English) */}
            <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-3xl shadow-lg flex items-center justify-center rotate-y-180" style={{ border: '3px solid #22c55e', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)' }}>
              <div className="text-center p-8">
                <div className="text-5xl font-bold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
                  {currentCard?.english}
                </div>
                <div className="text-lg font-medium" style={{ color: '#64748b' }}>
                  Spanish: {currentCard?.spanish}
                </div>
                <div className="text-base mt-4" style={{ color: '#94a3b8' }}>
                  Click to flip back
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Word Saved Success Notification */}
      {wordSaved && (
        <div className="fixed top-6 right-6 text-white px-8 py-4 rounded-2xl shadow-lg flex items-center space-x-3 z-50 animate-bounce font-bold" style={{ backgroundColor: '#22c55e', boxShadow: '0 8px 25px rgba(34, 197, 94, 0.4)', fontFamily: 'Inter, sans-serif' }}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>"{wordSaved}" saved to word bank!</span>
        </div>
      )}

      {/* Card Controls */}
      <div className="flex justify-center items-center space-x-6 mb-10">
        <button
          onClick={previousCard}
          disabled={currentCardIndex === 0}
          className="px-6 py-3 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ backgroundColor: '#64748b', boxShadow: '0 4px 12px rgba(100, 116, 139, 0.3)', fontFamily: 'Inter, sans-serif' }}
        >
          Previous
        </button>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => markAsKnown(currentCard?.id || '', false)}
            disabled={savingWord}
            className="px-6 py-3 font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-3 disabled:opacity-75 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              backgroundColor: !isCardKnown ? '#ef4444' : '#fee2e2',
              color: !isCardKnown ? 'white' : '#dc2626',
              boxShadow: !isCardKnown ? '0 4px 12px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(239, 68, 68, 0.15)',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            {savingWord ? (
              <>
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span className="text-xl">😐</span>
                <span>Don't Know</span>
              </>
            )}
          </button>
          <button
            onClick={() => markAsKnown(currentCard?.id || '', true)}
            className="px-6 py-3 font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-3"
            style={{
              backgroundColor: isCardKnown ? '#22c55e' : '#dcfce7',
              color: isCardKnown ? 'white' : '#16a34a',
              boxShadow: isCardKnown ? '0 4px 12px rgba(34, 197, 94, 0.3)' : '0 4px 12px rgba(34, 197, 94, 0.15)',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <span className="text-xl">😊</span>
            <span>Know This</span>
          </button>
        </div>

        <button
          onClick={nextCard}
          disabled={currentCardIndex === activity.cards.length - 1}
          className="px-6 py-3 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ backgroundColor: '#3b82f6', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', fontFamily: 'Inter, sans-serif' }}
        >
          Next
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="mb-10">
        <div className="flex justify-between text-lg font-semibold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
          <span>Card {currentCardIndex + 1} of {activity.cards.length}</span>
          <span>{knownCards.size} known cards</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
          <div 
            className="h-4 rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: `${((currentCardIndex + 1) / activity.cards.length) * 100}%`,
              background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={onPrevious}
          disabled={!canNavigatePrevious}
          className="flex items-center space-x-3 text-white px-8 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ backgroundColor: '#64748b', boxShadow: '0 6px 20px rgba(100, 116, 139, 0.3)', fontFamily: 'Inter, sans-serif' }}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" />
          </svg>
          <span>Previous Activity</span>
        </button>

        <div className="flex items-center space-x-6">
          <button
            onClick={handleComplete}
            className="text-white px-8 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
            style={{ backgroundColor: '#22c55e', boxShadow: '0 6px 20px rgba(34, 197, 94, 0.3)', fontFamily: 'Inter, sans-serif' }}
          >
            Complete Activity ({completionPercentage}%)
          </button>
          
          <button
            onClick={onNext}
            disabled={!canNavigateNext}
            className="flex items-center space-x-3 text-white px-8 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ backgroundColor: '#3b82f6', boxShadow: '0 6px 20px rgba(59, 130, 246, 0.3)', fontFamily: 'Inter, sans-serif' }}
          >
            <span>Next Activity</span>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}