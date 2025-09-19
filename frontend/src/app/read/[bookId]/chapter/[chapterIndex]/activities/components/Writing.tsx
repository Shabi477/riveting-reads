'use client';

import { useState, useEffect } from 'react';
import { WritingActivity, ActivityProgress } from '../../../../../../../lib/activityTypes';

interface WritingProps {
  activity: WritingActivity;
  progress?: ActivityProgress;
  onComplete: (score?: number, answers?: Record<string, any>, timeSpent?: number) => void;
  onProgress: (answers: Record<string, any>, timeSpent?: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
}

export function Writing({
  activity,
  progress,
  onComplete,
  onProgress,
  onNext,
  onPrevious,
  canNavigateNext,
  canNavigatePrevious,
}: WritingProps) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);
  const [startTime] = useState(Date.now());
  const [sessionStarted, setSessionStarted] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);

  const spanishCharacters = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ñ'];

  useEffect(() => {
    // Load progress if available
    if (progress?.answers) {
      setResponses(progress.answers.userResponses || {});
      setCompleted(progress.completed || false);
    }
    setSessionStarted(true);
  }, [progress]);

  useEffect(() => {
    // Auto-save progress every 30 seconds
    if (sessionStarted && Object.keys(responses).length > 0) {
      const interval = setInterval(() => {
        saveProgress();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [sessionStarted, responses]);

  const saveProgress = () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    onProgress({
      userResponses: responses,
      promptsCompleted: Object.keys(responses).filter(id => responses[id]?.trim()).length,
      totalPrompts: activity.prompts.length,
      wordCounts: getWordCounts(),
    }, timeSpent);
  };

  const handleResponseChange = (promptId: string, response: string) => {
    setResponses(prev => ({
      ...prev,
      [promptId]: response,
    }));
  };

  const insertCharacter = (char: string) => {
    if (activePromptId) {
      const textarea = document.getElementById(`prompt-${activePromptId}`) as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = responses[activePromptId] || '';
        const newText = text.substring(0, start) + char + text.substring(end);
        
        handleResponseChange(activePromptId, newText);
        
        // Restore cursor position
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
    }
  };

  const getWordCount = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getWordCounts = (): Record<string, number> => {
    const wordCounts: Record<string, number> = {};
    activity.prompts.forEach(prompt => {
      const response = responses[prompt.id] || '';
      wordCounts[prompt.id] = getWordCount(response);
    });
    return wordCounts;
  };

  const validateResponse = (promptId: string): { isValid: boolean; message?: string } => {
    const prompt = activity.prompts.find(p => p.id === promptId);
    const response = responses[promptId] || '';
    const wordCount = getWordCount(response);

    if (!prompt) return { isValid: false, message: 'Prompt not found' };
    if (!response.trim()) return { isValid: false, message: 'Response is required' };
    
    if (prompt.minWords && wordCount < prompt.minWords) {
      return { isValid: false, message: `Minimum ${prompt.minWords} words required (you have ${wordCount})` };
    }
    
    if (prompt.maxWords && wordCount > prompt.maxWords) {
      return { isValid: false, message: `Maximum ${prompt.maxWords} words allowed (you have ${wordCount})` };
    }

    // Check for key words if specified
    if (prompt.keyWords && prompt.keyWords.length > 0) {
      const responseLower = response.toLowerCase();
      const missingKeyWords = prompt.keyWords.filter(word => 
        !responseLower.includes(word.toLowerCase())
      );
      
      if (missingKeyWords.length > 0) {
        return { 
          isValid: false, 
          message: `Try to include these words: ${missingKeyWords.join(', ')}` 
        };
      }
    }

    return { isValid: true };
  };

  const handleComplete = () => {
    let totalScore = 0;
    let validResponses = 0;
    const validations: Record<string, any> = {};

    activity.prompts.forEach(prompt => {
      const validation = validateResponse(prompt.id);
      validations[prompt.id] = validation;
      
      if (validation.isValid) {
        validResponses++;
        totalScore += 100; // Full points for valid responses
      } else if (responses[prompt.id]?.trim()) {
        totalScore += 50; // Partial points for attempted responses
      }
    });

    const finalScore = Math.round(totalScore / activity.prompts.length);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    setCompleted(true);

    onComplete(finalScore, {
      userResponses: responses,
      validations,
      validResponses,
      totalPrompts: activity.prompts.length,
      wordCounts: getWordCounts(),
      score: finalScore,
    }, timeSpent);
  };

  const completedPrompts = Object.keys(responses).filter(id => {
    const validation = validateResponse(id);
    return validation.isValid;
  }).length;

  const attemptedPrompts = Object.keys(responses).filter(id => responses[id]?.trim()).length;
  const canComplete = attemptedPrompts === activity.prompts.length;
  const completionPercentage = Math.round((completedPrompts / activity.prompts.length) * 100);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Activity Header */}
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>{activity.title}</h2>
        <p className="text-xl mb-8" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>{activity.instructions}</p>
        <div className="flex justify-center items-center space-x-4 flex-wrap gap-2">
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#ef4444', color: 'white', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>
            ✍️ {activity.prompts.length} Prompts
          </div>
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#3b82f6', color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            ✅ {completedPrompts}/{activity.prompts.length} Completed ({completionPercentage}%)
          </div>
          {completed && (
            <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#22c55e', color: 'white', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
              🎯 Score: {Math.round((completedPrompts / activity.prompts.length) * 100)}%
            </div>
          )}
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#ff6b35', color: 'white', boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)' }}>
            ⏱️ ~{activity.estimatedTime} min
          </div>
        </div>
      </div>

      {/* Spanish Character Helper */}
      <div className="bg-white rounded-3xl shadow-lg p-6 mb-10" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)', border: '2px solid #fbbf24' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold" style={{ color: '#d97706', fontFamily: 'Inter, sans-serif' }}>🇪🇸 Spanish Characters Helper</h3>
          <button
            onClick={() => setShowKeyboard(!showKeyboard)}
            className="text-white px-4 py-2 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
            style={{ backgroundColor: '#f59e0b', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)', fontFamily: 'Inter, sans-serif' }}
          >
            {showKeyboard ? 'Hide' : 'Show'} Keyboard
          </button>
        </div>
        {showKeyboard && (
          <div className="grid grid-cols-8 gap-2">
            {spanishCharacters.map(char => (
              <button
                key={char}
                onClick={() => insertCharacter(char)}
                disabled={!activePromptId}
                className="bg-white border border-yellow-300 rounded p-2 text-lg font-semibold hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {char}
              </button>
            ))}
          </div>
        )}
        <div className="text-yellow-700 text-sm mt-2">
          💡 Click on a text area below, then use these buttons to add Spanish characters to your writing.
        </div>
      </div>

      {/* Writing Prompts */}
      <div className="space-y-8 mb-8">
        {activity.prompts.map((prompt, index) => {
          const response = responses[prompt.id] || '';
          const wordCount = getWordCount(response);
          const validation = validateResponse(prompt.id);
          const isCompleted = validation.isValid;
          const hasAttempt = response.trim() !== '';

          return (
            <div 
              key={prompt.id}
              className={`
                bg-white rounded-lg shadow-md p-6 border-l-4 transition-all
                ${isCompleted 
                  ? 'border-green-500' 
                  : hasAttempt
                    ? 'border-blue-500'
                    : 'border-gray-300'
                }
              `}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    {index + 1}. {prompt.prompt}
                  </h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      {prompt.type === 'word' ? '📝 Word' : prompt.type === 'sentence' ? '📄 Sentence' : '📖 Paragraph'}
                    </span>
                    {prompt.minWords && (
                      <span>Min: {prompt.minWords} words</span>
                    )}
                    {prompt.maxWords && (
                      <span>Max: {prompt.maxWords} words</span>
                    )}
                  </div>
                </div>
                {isCompleted && (
                  <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 flex-shrink-0">
                    ✅ Complete
                  </div>
                )}
              </div>

              <textarea
                id={`prompt-${prompt.id}`}
                value={response}
                onChange={(e) => handleResponseChange(prompt.id, e.target.value)}
                onFocus={() => setActivePromptId(prompt.id)}
                onBlur={() => setActivePromptId(null)}
                disabled={completed}
                placeholder="Escribe tu respuesta en español..."
                rows={prompt.type === 'paragraph' ? 6 : prompt.type === 'sentence' ? 3 : 2}
                maxLength={prompt.maxWords ? prompt.maxWords * 10 : undefined}
                className={`
                  w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none
                  ${completed 
                    ? isCompleted 
                      ? 'border-green-500 bg-green-50 cursor-not-allowed' 
                      : 'border-gray-300 bg-gray-50 cursor-not-allowed'
                    : isCompleted
                      ? 'border-green-500'
                      : hasAttempt
                        ? 'border-blue-500'
                        : 'border-gray-300'
                  }
                `}
              />

              <div className="flex justify-between items-center mt-3">
                <div className="text-sm text-gray-600">
                  Word count: {wordCount}
                  {prompt.minWords && ` (min: ${prompt.minWords})`}
                  {prompt.maxWords && ` (max: ${prompt.maxWords})`}
                </div>
                
                {!validation.isValid && hasAttempt && (
                  <div className="text-sm text-red-600">
                    ⚠️ {validation.message}
                  </div>
                )}
              </div>

              {prompt.keyWords && prompt.keyWords.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 mb-1">
                    💡 Try to include these words:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {prompt.keyWords.map(word => {
                      const isUsed = response.toLowerCase().includes(word.toLowerCase());
                      return (
                        <span 
                          key={word} 
                          className={`
                            text-xs px-2 py-1 rounded
                            ${isUsed 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                            }
                          `}
                        >
                          {isUsed ? '✅' : '📝'} {word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {prompt.suggestions && prompt.suggestions.length > 0 && !isCompleted && (
                <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm font-medium text-purple-800 mb-1">
                    💬 Helpful phrases:
                  </div>
                  <div className="text-sm text-purple-700">
                    {prompt.suggestions.join(' • ')}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mb-10">
        <div className="flex justify-between text-lg font-semibold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
          <span>Progress: {completedPrompts}/{activity.prompts.length} prompts completed</span>
          {completed && (
            <span>Final Score: {Math.round((completedPrompts / activity.prompts.length) * 100)}%</span>
          )}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
          <div 
            className="h-4 rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: `${completionPercentage}%`,
              background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
            }}
          />
        </div>
      </div>

      {/* Submit Button */}
      {!completed && (
        <div className="text-center mb-10">
          <button
            onClick={handleComplete}
            disabled={!canComplete}
            className="text-white px-10 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ backgroundColor: '#22c55e', boxShadow: '0 6px 20px rgba(34, 197, 94, 0.3)', fontFamily: 'Inter, sans-serif' }}
          >
            Submit Writing ({attemptedPrompts}/{activity.prompts.length})
          </button>
        </div>
      )}

      {/* Completion Message */}
      {completed && (
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-10 text-center" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)', border: '2px solid #22c55e' }}>
          <div className="text-8xl mb-6">🎉</div>
          <h3 className="text-3xl font-bold mb-4" style={{ color: '#16a34a', fontFamily: 'Inter, sans-serif' }}>
            ¡Excelente trabajo! Writing completed!
          </h3>
          <p className="text-xl" style={{ color: '#15803d', fontFamily: 'Inter, sans-serif' }}>
            You completed {completedPrompts} out of {activity.prompts.length} prompts successfully.
            Your writing demonstrates great effort in Spanish!
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