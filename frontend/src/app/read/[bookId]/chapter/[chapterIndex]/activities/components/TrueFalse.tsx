'use client';

import { useState, useEffect } from 'react';
import { TrueFalseActivity, ActivityProgress } from '../../../../../../../lib/activityTypes';

interface TrueFalseProps {
  activity: TrueFalseActivity;
  progress?: ActivityProgress;
  onComplete: (score?: number, answers?: Record<string, any>, timeSpent?: number) => void;
  onProgress: (answers: Record<string, any>, timeSpent?: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
}

export function TrueFalse({
  activity,
  progress,
  onComplete,
  onProgress,
  onNext,
  onPrevious,
  canNavigateNext,
  canNavigatePrevious,
}: TrueFalseProps) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [showFeedback, setShowFeedback] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const [startTime] = useState(Date.now());
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    // Load progress if available
    if (progress?.answers) {
      setAnswers(progress.answers.userAnswers || {});
      setShowFeedback(progress.answers.showFeedback || {});
      setCompleted(progress.completed || false);
    }
    setSessionStarted(true);
  }, [progress]);

  useEffect(() => {
    // Auto-save progress every 30 seconds
    if (sessionStarted && Object.keys(answers).length > 0) {
      const interval = setInterval(() => {
        saveProgress();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [sessionStarted, answers, showFeedback]);

  const saveProgress = () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    onProgress({
      userAnswers: answers,
      showFeedback,
      questionsAnswered: Object.keys(answers).length,
      totalQuestions: activity.questions.length,
    }, timeSpent);
  };

  const handleAnswer = (questionId: string, answer: boolean) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));

    // Show immediate feedback
    setShowFeedback(prev => ({
      ...prev,
      [questionId]: true,
    }));

    // Auto-save on each answer
    setTimeout(saveProgress, 100);
  };

  const handleComplete = () => {
    const correctAnswers = activity.questions.filter(q => 
      answers[q.id] === q.correct
    ).length;
    
    const score = Math.round((correctAnswers / activity.questions.length) * 100);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    setCompleted(true);

    onComplete(score, {
      userAnswers: answers,
      showFeedback,
      correctAnswers,
      totalQuestions: activity.questions.length,
      score,
    }, timeSpent);
  };

  const answeredQuestions = Object.keys(answers).length;
  const correctAnswers = activity.questions.filter(q => answers[q.id] === q.correct).length;
  const canComplete = answeredQuestions === activity.questions.length;
  const completionPercentage = Math.round((answeredQuestions / activity.questions.length) * 100);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Activity Header */}
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>{activity.title}</h2>
        <p className="text-xl mb-8" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>{activity.instructions}</p>
        <div className="flex justify-center items-center space-x-4 flex-wrap gap-2">
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#8b5cf6', color: 'white', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}>
            ❓ {activity.questions.length} Statements
          </div>
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#3b82f6', color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            ✅ {answeredQuestions}/{activity.questions.length} Answered ({completionPercentage}%)
          </div>
          {completed && (
            <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#22c55e', color: 'white', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
              🎯 Score: {Math.round((correctAnswers / activity.questions.length) * 100)}%
            </div>
          )}
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#ff6b35', color: 'white', boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)' }}>
            ⏱️ ~{activity.estimatedTime} min
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-8 mb-10">
        {activity.questions.map((question, index) => {
          const userAnswer = answers[question.id];
          const hasAnswered = userAnswer !== undefined;
          const showQuestionFeedback = showFeedback[question.id] && hasAnswered;
          const isCorrect = userAnswer === question.correct;

          return (
            <div 
              key={question.id}
              className="bg-white rounded-3xl shadow-lg p-8 border-l-4 transition-all transform hover:scale-[1.01]"
              style={{
                borderColor: showQuestionFeedback 
                  ? isCorrect 
                    ? '#22c55e' 
                    : '#ef4444'
                  : hasAnswered
                    ? '#3b82f6'
                    : '#d1d5db',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="mb-6">
                <div className="flex items-start justify-between">
                  <h4 className="text-xl font-bold flex-1 mr-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
                    {index + 1}. {question.statement}
                  </h4>
                  {showQuestionFeedback && (
                    <div className="flex items-center space-x-2 px-4 py-2 rounded-2xl font-bold shadow-lg flex-shrink-0" style={{
                      backgroundColor: isCorrect ? '#22c55e' : '#ef4444',
                      color: 'white',
                      boxShadow: isCorrect ? '0 4px 12px rgba(34, 197, 94, 0.3)' : '0 4px 12px rgba(239, 68, 68, 0.3)'
                    }}>
                      {isCorrect ? '✅ Correct' : '❌ Incorrect'}
                    </div>
                  )}
                </div>
              </div>

              {/* True/False Buttons */}
              <div className="flex space-x-6 mb-6">
                <button
                  onClick={() => handleAnswer(question.id, true)}
                  disabled={completed}
                  className="flex-1 py-4 px-6 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:scale-100"
                  style={{
                    backgroundColor: userAnswer === true
                      ? showQuestionFeedback
                        ? question.correct
                          ? '#22c55e'
                          : '#ef4444'
                        : '#3b82f6'
                      : '#f8fafc',
                    color: userAnswer === true ? 'white' : '#64748b',
                    border: userAnswer !== true ? '2px solid #e2e8f0' : 'none',
                    boxShadow: userAnswer === true 
                      ? showQuestionFeedback
                        ? question.correct
                          ? '0 6px 20px rgba(34, 197, 94, 0.3)'
                          : '0 6px 20px rgba(239, 68, 68, 0.3)'
                        : '0 6px 20px rgba(59, 130, 246, 0.3)'
                      : '0 4px 12px rgba(0, 0, 0, 0.1)',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  ✅ True / Verdadero
                </button>
                <button
                  onClick={() => handleAnswer(question.id, false)}
                  disabled={completed}
                  className="flex-1 py-4 px-6 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:scale-100"
                  style={{
                    backgroundColor: userAnswer === false
                      ? showQuestionFeedback
                        ? !question.correct
                          ? '#22c55e'
                          : '#ef4444'
                        : '#3b82f6'
                      : '#f8fafc',
                    color: userAnswer === false ? 'white' : '#64748b',
                    border: userAnswer !== false ? '2px solid #e2e8f0' : 'none',
                    boxShadow: userAnswer === false 
                      ? showQuestionFeedback
                        ? !question.correct
                          ? '0 6px 20px rgba(34, 197, 94, 0.3)'
                          : '0 6px 20px rgba(239, 68, 68, 0.3)'
                        : '0 6px 20px rgba(59, 130, 246, 0.3)'
                      : '0 4px 12px rgba(0, 0, 0, 0.1)',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  ❌ False / Falso
                </button>
              </div>

              {/* Feedback */}
              {showQuestionFeedback && (
                <div className={`
                  p-4 rounded-lg
                  ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}
                `}>
                  <div className={`
                    text-sm font-medium mb-2
                    ${isCorrect ? 'text-green-800' : 'text-amber-800'}
                  `}>
                    {isCorrect ? '🎉 Excellent!' : '🤔 Let\'s learn:'}
                  </div>
                  <div className={`
                    text-sm
                    ${isCorrect ? 'text-green-700' : 'text-amber-700'}
                  `}>
                    {question.explanation}
                  </div>
                  {question.relatedVocabulary && question.relatedVocabulary.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-600 mb-1">Related vocabulary:</div>
                      <div className="flex flex-wrap gap-1">
                        {question.relatedVocabulary.map((word, i) => (
                          <span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mb-10">
        <div className="flex justify-between text-lg font-semibold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
          <span>Progress: {answeredQuestions}/{activity.questions.length} questions answered</span>
          {completed && (
            <span>Final Score: {Math.round((correctAnswers / activity.questions.length) * 100)}%</span>
          )}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
          <div 
            className="h-4 rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: `${completionPercentage}%`,
              background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
            }}
          />
        </div>
      </div>

      {/* Complete Button */}
      {!completed && canComplete && (
        <div className="text-center mb-10">
          <button
            onClick={handleComplete}
            className="text-white px-10 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
            style={{ backgroundColor: '#22c55e', boxShadow: '0 6px 20px rgba(34, 197, 94, 0.3)', fontFamily: 'Inter, sans-serif' }}
          >
            Complete Activity - See Final Score
          </button>
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