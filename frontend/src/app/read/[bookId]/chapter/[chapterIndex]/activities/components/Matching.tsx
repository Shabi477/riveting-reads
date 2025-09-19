'use client';

import { useState, useEffect } from 'react';
import { MatchingActivity, ActivityProgress } from '../../../../../../../lib/activityTypes';

interface MatchingProps {
  activity: MatchingActivity;
  progress?: ActivityProgress;
  onComplete: (score?: number, answers?: Record<string, any>, timeSpent?: number) => void;
  onProgress: (answers: Record<string, any>, timeSpent?: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
}

interface MatchPair {
  id: string;
  spanish: string;
  english: string;
  matched: boolean;
}

export function Matching({
  activity,
  progress,
  onComplete,
  onProgress,
  onNext,
  onPrevious,
  canNavigateNext,
  canNavigatePrevious,
}: MatchingProps) {
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [spanishItems, setSpanishItems] = useState<string[]>([]);
  const [englishItems, setEnglishItems] = useState<string[]>([]);
  const [selectedSpanish, setSelectedSpanish] = useState<string | null>(null);
  const [selectedEnglish, setSelectedEnglish] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [wrongMatches, setWrongMatches] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);
  const [startTime] = useState(Date.now());
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    // Initialize pairs and shuffle if needed
    const initialPairs: MatchPair[] = activity.pairs.map(pair => ({
      ...pair,
      matched: false,
    }));

    setPairs(initialPairs);

    const spanish = initialPairs.map(p => p.spanish);
    const english = initialPairs.map(p => p.english);

    // Shuffle arrays if specified
    if (activity.shufflePairs) {
      setSpanishItems(shuffleArray([...spanish]));
      setEnglishItems(shuffleArray([...english]));
    } else {
      setSpanishItems(spanish);
      setEnglishItems(english);
    }

    // Load progress if available
    if (progress?.answers) {
      setMatches(progress.answers.matches || {});
      setCompleted(progress.completed || false);
    }
    setSessionStarted(true);
  }, [activity, progress]);

  useEffect(() => {
    // Auto-save progress every 30 seconds
    if (sessionStarted && Object.keys(matches).length > 0) {
      const interval = setInterval(() => {
        saveProgress();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [sessionStarted, matches]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const saveProgress = () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    onProgress({
      matches,
      correctMatches: Object.keys(matches).filter(spanish => 
        pairs.find(p => p.spanish === spanish && p.english === matches[spanish])
      ).length,
      totalPairs: pairs.length,
    }, timeSpent);
  };

  const handleSpanishClick = (spanish: string) => {
    if (completed) return;
    
    setSelectedSpanish(spanish === selectedSpanish ? null : spanish);
    setSelectedEnglish(null);
    
    // Clear any wrong match indicators
    setWrongMatches(new Set());
  };

  const handleEnglishClick = (english: string) => {
    if (completed) return;
    
    if (selectedSpanish) {
      // Try to make a match
      const correctPair = pairs.find(p => p.spanish === selectedSpanish && p.english === english);
      
      if (correctPair) {
        // Correct match!
        setMatches(prev => ({
          ...prev,
          [selectedSpanish]: english,
        }));
        setSelectedSpanish(null);
        setSelectedEnglish(null);
        
        // Check if all pairs are matched
        const newMatches = { ...matches, [selectedSpanish]: english };
        if (Object.keys(newMatches).length === pairs.length) {
          handleComplete(newMatches);
        } else {
          saveProgress();
        }
      } else {
        // Wrong match - show feedback briefly
        setWrongMatches(new Set([selectedSpanish, english]));
        setTimeout(() => {
          setWrongMatches(new Set());
          setSelectedSpanish(null);
          setSelectedEnglish(null);
        }, 1000);
      }
    } else {
      setSelectedEnglish(english === selectedEnglish ? null : english);
      setSelectedSpanish(null);
    }
  };

  const handleComplete = (finalMatches = matches) => {
    const correctMatches = Object.keys(finalMatches).filter(spanish => 
      pairs.find(p => p.spanish === spanish && p.english === finalMatches[spanish])
    ).length;
    
    const score = Math.round((correctMatches / pairs.length) * 100);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    setCompleted(true);

    onComplete(score, {
      matches: finalMatches,
      correctMatches,
      totalPairs: pairs.length,
      score,
    }, timeSpent);
  };

  const resetActivity = () => {
    setMatches({});
    setSelectedSpanish(null);
    setSelectedEnglish(null);
    setWrongMatches(new Set());
    setCompleted(false);
  };

  const correctMatches = Object.keys(matches).filter(spanish => 
    pairs.find(p => p.spanish === spanish && p.english === matches[spanish])
  ).length;
  
  const completionPercentage = Math.round((correctMatches / pairs.length) * 100);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Activity Header */}
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>{activity.title}</h2>
        <p className="text-xl mb-8" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>{activity.instructions}</p>
        <div className="flex justify-center items-center space-x-4 flex-wrap gap-2">
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#ff6b35', color: 'white', boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)' }}>
            🔗 {activity.pairs.length} Pairs
          </div>
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#3b82f6', color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            ✅ {correctMatches}/{activity.pairs.length} Matched ({completionPercentage}%)
          </div>
          {completed && (
            <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#22c55e', color: 'white', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
              🎯 Score: {Math.round((correctMatches / pairs.length) * 100)}%
            </div>
          )}
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#8b5cf6', color: 'white', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}>
            ⏱️ ~{activity.estimatedTime} min
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-3xl shadow-lg p-6 mb-10" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)', border: '2px solid #dbeafe' }}>
        <div style={{ color: '#1e40af', fontSize: '1.125rem', fontFamily: 'Inter, sans-serif' }}>
          💡 <strong>How to play:</strong> Click a Spanish word, then click its English translation to make a match. 
          Correct matches will stay connected. Try to match all pairs!
        </div>
      </div>

      {/* Matching Interface */}
      <div className="grid grid-cols-2 gap-10 mb-10">
        {/* Spanish Column */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-center mb-6" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>🇪🇸 Español</h3>
          {spanishItems.map(spanish => {
            const isMatched = matches[spanish];
            const isSelected = selectedSpanish === spanish;
            const isWrong = wrongMatches.has(spanish);
            
            return (
              <button
                key={spanish}
                onClick={() => handleSpanishClick(spanish)}
                disabled={isMatched || completed}
                className={`
                  w-full p-4 rounded-lg text-left font-medium transition-all duration-200 transform
                  ${isMatched
                    ? 'bg-green-100 text-green-800 border-2 border-green-500 cursor-default'
                    : isSelected
                      ? 'bg-blue-600 text-white border-2 border-blue-600 scale-105 shadow-lg'
                      : isWrong
                        ? 'bg-red-100 text-red-800 border-2 border-red-500 shake'
                        : 'bg-white text-gray-900 border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:scale-102'
                  }
                  ${completed ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center justify-between">
                  <span>{spanish}</span>
                  {isMatched && <span>✅</span>}
                  {isSelected && !isMatched && <span>👈</span>}
                </div>
                {isMatched && (
                  <div className="text-sm mt-1 opacity-75">
                    ↔️ {matches[spanish]}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* English Column */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-center mb-6" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>🇺🇸 English</h3>
          {englishItems.map(english => {
            const isMatched = Object.values(matches).includes(english);
            const isSelected = selectedEnglish === english;
            const isWrong = wrongMatches.has(english);
            
            return (
              <button
                key={english}
                onClick={() => handleEnglishClick(english)}
                disabled={isMatched || completed}
                className={`
                  w-full p-4 rounded-lg text-left font-medium transition-all duration-200 transform
                  ${isMatched
                    ? 'bg-green-100 text-green-800 border-2 border-green-500 cursor-default'
                    : isSelected
                      ? 'bg-blue-600 text-white border-2 border-blue-600 scale-105 shadow-lg'
                      : isWrong
                        ? 'bg-red-100 text-red-800 border-2 border-red-500 shake'
                        : 'bg-white text-gray-900 border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:scale-102'
                  }
                  ${completed ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center justify-between">
                  <span>{english}</span>
                  {isMatched && <span>✅</span>}
                  {isSelected && !isMatched && <span>👈</span>}
                </div>
                {isMatched && (
                  <div className="text-sm mt-1 opacity-75">
                    ↔️ {Object.keys(matches).find(k => matches[k] === english)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-10">
        <div className="flex justify-between text-lg font-semibold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
          <span>Progress: {correctMatches}/{pairs.length} pairs matched</span>
          {completed && (
            <span>Final Score: {Math.round((correctMatches / pairs.length) * 100)}%</span>
          )}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
          <div 
            className="h-4 rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: `${completionPercentage}%`,
              background: 'linear-gradient(90deg, #ff6b35 0%, #f97316 100%)',
              boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
            }}
          />
        </div>
      </div>

      {/* Reset Button */}
      {!completed && Object.keys(matches).length > 0 && (
        <div className="text-center mb-10">
          <button
            onClick={resetActivity}
            className="text-white px-8 py-3 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
            style={{ backgroundColor: '#64748b', boxShadow: '0 6px 20px rgba(100, 116, 139, 0.3)', fontFamily: 'Inter, sans-serif' }}
          >
            🔄 Reset Matches
          </button>
        </div>
      )}

      {/* Completion Message */}
      {completed && (
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-10 text-center" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)', border: '2px solid #22c55e' }}>
          <div className="text-8xl mb-6">🎉</div>
          <h3 className="text-3xl font-bold mb-4" style={{ color: '#16a34a', fontFamily: 'Inter, sans-serif' }}>
            ¡Excelente! All pairs matched!
          </h3>
          <p className="text-xl" style={{ color: '#15803d', fontFamily: 'Inter, sans-serif' }}>
            You scored {Math.round((correctMatches / pairs.length) * 100)}% by matching {correctMatches} out of {pairs.length} pairs correctly.
          </p>
        </div>
      )}

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
  );
}