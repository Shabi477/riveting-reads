'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ActivitySession, getActivityTypeIcon, getActivityTypeColor } from '../../../../../../../lib/activityTypes';

interface ActivitiesLayoutProps {
  session: ActivitySession;
  currentActivityIndex: number;
  onNavigateToActivity: (index: number) => void;
  onFinish: () => void;
  bookId: string;
  chapterIndex: number;
  children: ReactNode;
}

export function ActivitiesLayout({
  session,
  currentActivityIndex,
  onNavigateToActivity,
  onFinish,
  bookId,
  chapterIndex,
  children,
}: ActivitiesLayoutProps) {
  const progressPercentage = session.totalActivities > 0 
    ? Math.round((session.completedActivities / session.totalActivities) * 100)
    : 0;

  const currentActivity = session.activities[currentActivityIndex];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fef7f0', background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
      {/* Header */}
      <header className="shadow-lg border-b" style={{ backgroundColor: 'white', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <Link
                href={`/read/${bookId}/chapter/${chapterIndex}`}
                className="text-gray-600 hover:text-gray-900 flex items-center transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" />
                </svg>
                Back to Reading
              </Link>
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🎯</span>
                <h1 className="text-2xl font-bold" style={{ color: '#ff6b35', fontFamily: 'Inter, sans-serif' }}>
                  Chapter {chapterIndex} Activities
                </h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-base font-semibold" style={{ color: '#1e293b' }}>
                Progress: {session.completedActivities}/{session.totalActivities} ({progressPercentage}%)
              </div>
              <button
                onClick={onFinish}
                className="px-6 py-3 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                style={{ backgroundColor: '#22c55e', boxShadow: '0 6px 20px rgba(34, 197, 94, 0.3)', fontFamily: 'Inter, sans-serif' }}
              >
                Finish Activities
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b shadow-sm" style={{ borderColor: '#e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="w-full bg-gray-100 rounded-full h-3 mb-4 overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-500 ease-out"
              style={{ 
                width: `${progressPercentage}%`,
                background: 'linear-gradient(90deg, #ff6b35 0%, #f97316 100%)',
                boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)'
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <div className="text-base font-medium" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
              {currentActivity && (
                <>
                  {getActivityTypeIcon(currentActivity.type)} {currentActivity.title}
                </>
              )}
            </div>
            <div className="text-base font-semibold" style={{ color: '#64748b' }}>
              Activity {currentActivityIndex + 1} of {session.totalActivities}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Navigation */}
      <div className="bg-white border-b shadow-sm" style={{ borderColor: '#e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex space-x-3 overflow-x-auto pb-2">
            {session.activities.map((activity, index) => {
              const isCompleted = session.progress.has(`${activity.type}_${activity.id}`);
              const isCurrent = index === currentActivityIndex;
              
              // BeeLinguApp-style activity navigation
              const getActivityStyles = (current: boolean, completed: boolean) => {
                if (current) {
                  return {
                    backgroundColor: '#ff6b35',
                    color: 'white',
                    boxShadow: '0 6px 20px rgba(255, 107, 53, 0.4)',
                    transform: 'translateY(-2px)',
                  };
                } else if (completed) {
                  return {
                    backgroundColor: '#22c55e',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                  };
                } else {
                  return {
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    border: '2px solid #e2e8f0',
                  };
                }
              };
              
              const buttonStyles = getActivityStyles(isCurrent, isCompleted);
              
              return (
                <button
                  key={`${activity.type}_${activity.id}`}
                  onClick={() => onNavigateToActivity(index)}
                  className="flex-shrink-0 flex items-center space-x-3 px-4 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105"
                  style={{ ...buttonStyles, fontFamily: 'Inter, sans-serif' }}
                >
                  <span className="text-lg">{getActivityTypeIcon(activity.type)}</span>
                  <span className="hidden sm:inline text-sm">{activity.title}</span>
                  {isCompleted && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)', border: '2px solid #f1f5f9' }}>
          <div className="p-8" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}