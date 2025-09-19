'use client';

import { useState, useEffect } from 'react';
import { ComprehensionActivity, ActivityProgress } from '../../../../../../../lib/activityTypes';

interface ComprehensionProps {
  activity: ComprehensionActivity;
  progress?: ActivityProgress;
  onComplete: (score?: number, answers?: Record<string, any>, timeSpent?: number) => void;
  onProgress: (answers: Record<string, any>, timeSpent?: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
}

export function Comprehension({
  activity,
  progress,
  onComplete,
  onProgress,
  onNext,
  onPrevious,
  canNavigateNext,
  canNavigatePrevious,
}: ComprehensionProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});
  const [startTime] = useState(Date.now());
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    // Load progress if available
    if (progress?.answers) {
      setAnswers(progress.answers.userAnswers || {});
      setSubmitted(progress.completed || false);
      if (progress.answers.feedback) {
        setFeedback(progress.answers.feedback);
      }
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
  }, [sessionStarted, answers]);

  const saveProgress = () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    onProgress({
      userAnswers: answers,
      feedback,
      questionsAnswered: Object.keys(answers).length,
      totalQuestions: activity.questions.length,
    }, timeSpent);
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const checkAnswer = (questionId: string, userAnswer: string): boolean => {
    const question = activity.questions.find(q => q.id === questionId);
    if (!question) return false;

    // For multiple choice questions, check if the selected option matches the correct answer
    if (question.type === 'multiple_choice') {
      return userAnswer === question.correctAnswer;
    }

    // Legacy support for short/paragraph questions (if any exist)
    const normalizedAnswer = userAnswer.toLowerCase().trim();
    return question.correctAnswers?.some(correct => 
      normalizedAnswer.includes(correct.toLowerCase()) ||
      correct.toLowerCase().includes(normalizedAnswer)
    ) || false;
  };

  const handleSubmit = () => {
    const newFeedback: Record<string, boolean> = {};
    let correctAnswers = 0;

    activity.questions.forEach(question => {
      const userAnswer = answers[question.id] || '';
      const isCorrect = checkAnswer(question.id, userAnswer);
      newFeedback[question.id] = isCorrect;
      if (isCorrect) correctAnswers++;
    });

    setFeedback(newFeedback);
    setSubmitted(true);

    const score = Math.round((correctAnswers / activity.questions.length) * 100);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    onComplete(score, {
      userAnswers: answers,
      feedback: newFeedback,
      correctAnswers,
      totalQuestions: activity.questions.length,
      score,
    }, timeSpent);
  };

  const canSubmit = activity.questions.every(q => answers[q.id]?.trim());
  const answeredQuestions = Object.keys(answers).filter(id => answers[id]?.trim()).length;
  const completionPercentage = Math.round((answeredQuestions / activity.questions.length) * 100);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Activity Header */}
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>{activity.title}</h2>
        <p className="text-xl mb-8" style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>{activity.instructions}</p>
        <div className="flex justify-center items-center space-x-4 flex-wrap gap-2">
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#22c55e', color: 'white', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
            📝 {activity.questions.length} Questions
          </div>
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#3b82f6', color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            ✅ {answeredQuestions}/{activity.questions.length} Answered ({completionPercentage}%)
          </div>
          <div className="px-4 py-2 rounded-2xl font-semibold text-base shadow-lg" style={{ backgroundColor: '#ff6b35', color: 'white', boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)' }}>
            ⏱️ ~{activity.estimatedTime} min
          </div>
        </div>
      </div>

      {/* Reading Passage (if provided) */}
      {activity.passage && (
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-10" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)', border: '2px solid #f1f5f9' }}>
          <h3 className="text-2xl font-bold mb-6" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>Reading Passage</h3>
          <div className="text-xl leading-relaxed" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>
            {activity.passage}
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-8 mb-10">
        {activity.questions.map((question, index) => {
          const userAnswer = answers[question.id] || '';
          const isAnswered = userAnswer.trim() !== '';
          const showFeedback = submitted && feedback.hasOwnProperty(question.id);
          const isCorrect = feedback[question.id];

          return (
            <div 
              key={question.id}
              className="bg-white rounded-3xl shadow-lg p-8 border-l-4 transition-all transform hover:scale-[1.01]"
              style={{
                borderColor: showFeedback 
                  ? isCorrect 
                    ? '#22c55e' 
                    : '#ef4444'
                  : isAnswered
                    ? '#3b82f6'
                    : '#d1d5db',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex items-start justify-between mb-6">
                <h4 className="text-xl font-bold flex-1" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
                  {index + 1}. {question.question}
                </h4>
                {showFeedback && (
                  <div className="flex items-center space-x-2 px-4 py-2 rounded-2xl font-bold shadow-lg" style={{
                    backgroundColor: isCorrect ? '#22c55e' : '#ef4444',
                    color: 'white',
                    boxShadow: isCorrect ? '0 4px 12px rgba(34, 197, 94, 0.3)' : '0 4px 12px rgba(239, 68, 68, 0.3)'
                  }}>
                    {isCorrect ? '✅ Correct' : '❌ Incorrect'}
                  </div>
                )}
              </div>

              {question.type === 'multiple_choice' ? (
                <div className="space-y-3">
                  {Object.entries(question.options).map(([optionKey, optionValue]) => {
                    const isSelected = userAnswer === optionKey;
                    const isCorrectOption = question.correctAnswer === optionKey;
                    const showCorrectAnswer = submitted && isCorrectOption;
                    const showIncorrectSelection = submitted && isSelected && !isCorrectOption;
                    
                    return (
                      <label
                        key={optionKey}
                        className={`
                          flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all
                          ${submitted
                            ? showCorrectAnswer
                              ? 'border-green-500 bg-green-50'
                              : showIncorrectSelection
                                ? 'border-red-500 bg-red-50'
                                : 'border-gray-200 bg-gray-50'
                            : isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }
                          ${submitted ? 'cursor-default' : 'hover:bg-gray-50'}
                        `}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={optionKey}
                          checked={isSelected}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          disabled={submitted}
                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{optionKey}.</span>
                            <span className="text-gray-800">{optionValue}</span>
                            {showCorrectAnswer && (
                              <span className="text-green-600 font-medium">✅ Correct</span>
                            )}
                            {showIncorrectSelection && (
                              <span className="text-red-600 font-medium">❌ Selected</span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : question.type === 'short' ? (
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  disabled={submitted}
                  placeholder="Type your answer in Spanish..."
                  className={`
                    w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                    ${submitted 
                      ? isCorrect 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-red-500 bg-red-50'
                      : isAnswered
                        ? 'border-blue-500'
                        : 'border-gray-300'
                    }
                    ${submitted ? 'cursor-not-allowed' : ''}
                  `}
                />
              ) : (
                <textarea
                  value={userAnswer}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  disabled={submitted}
                  placeholder="Write your answer in Spanish..."
                  rows={4}
                  className={`
                    w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none
                    ${submitted 
                      ? isCorrect 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-red-500 bg-red-50'
                      : isAnswered
                        ? 'border-blue-500'
                        : 'border-gray-300'
                    }
                    ${submitted ? 'cursor-not-allowed' : ''}
                  `}
                />
              )}

              {question.type !== 'multiple_choice' && question.maxWords && (
                <div className="text-sm text-gray-500 mt-2">
                  Word limit: {question.maxWords} words
                  {userAnswer && (
                    <span className="ml-2">
                      ({userAnswer.trim().split(' ').filter(word => word.length > 0).length} words)
                    </span>
                  )}
                </div>
              )}

              {question.hints && question.hints.length > 0 && !submitted && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 mb-1">💡 Hint:</div>
                  <div className="text-sm text-blue-700">
                    {question.hints[0]}
                  </div>
                </div>
              )}

              {showFeedback && question.type === 'multiple_choice' && question.explanation && (
                <div className={`mt-3 p-3 rounded-lg ${
                  isCorrect ? 'bg-green-50' : 'bg-amber-50'
                }`}>
                  <div className={`text-sm font-medium mb-1 ${
                    isCorrect ? 'text-green-800' : 'text-amber-800'
                  }`}>
                    {isCorrect ? '✅ Explanation:' : '💡 Explanation:'}
                  </div>
                  <div className={`text-sm ${
                    isCorrect ? 'text-green-700' : 'text-amber-700'
                  }`}>
                    {question.explanation}
                  </div>
                  {!isCorrect && (
                    <div className="text-sm text-amber-700 mt-2">
                      <strong>Correct answer:</strong> {question.correctAnswer}. {question.options[question.correctAnswer]}
                    </div>
                  )}
                </div>
              )}
              
              {showFeedback && question.type !== 'multiple_choice' && !isCorrect && question.correctAnswers && (
                <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                  <div className="text-sm font-medium text-amber-800 mb-1">Expected answers include:</div>
                  <div className="text-sm text-amber-700">
                    {question.correctAnswers.join(', ')}
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
          <span>Progress: {answeredQuestions}/{activity.questions.length} questions answered</span>
          {submitted && (
            <span>
              Score: {Math.round((Object.values(feedback).filter(Boolean).length / activity.questions.length) * 100)}%
            </span>
          )}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
          <div 
            className="h-4 rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: `${completionPercentage}%`,
              background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
            }}
          />
        </div>
      </div>

      {/* Submit Button */}
      {!submitted && (
        <div className="text-center mb-10">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="text-white px-10 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ backgroundColor: '#22c55e', boxShadow: '0 6px 20px rgba(34, 197, 94, 0.3)', fontFamily: 'Inter, sans-serif' }}
          >
            Submit Answers ({answeredQuestions}/{activity.questions.length})
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