'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ActivitiesLayout } from './components/ActivitiesLayout';
import { Flashcards } from './components/Flashcards';
import { Comprehension } from './components/Comprehension';
import { TrueFalse } from './components/TrueFalse';
import { Matching } from './components/Matching';
import { Writing } from './components/Writing';
import { 
  ActivityType, 
  Activity, 
  ActivitySession, 
  ActivitiesResponse,
  ActivityProgress 
} from '../../../../../../lib/activityTypes';

export default function ActivitiesPage() {
  const [session, setSession] = useState<ActivitySession | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [userProgress, setUserProgress] = useState<ActivityProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chapterId, setChapterId] = useState('');

  const router = useRouter();
  const params = useParams();
  const bookId = params.bookId as string;
  const chapterIndex = parseInt(params.chapterIndex as string);

  useEffect(() => {
    if (bookId && chapterIndex) {
      loadActivities();
    }
  }, [bookId, chapterIndex]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `/api/chapters/${bookId}/activities/${chapterIndex}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load activities');
      }

      const data: ActivitiesResponse = await response.json();
      
      // Flatten activities from all types into a single array and ensure correct structure
      const allActivities: Activity[] = [
        ...data.activitiesByType.vocabulary.map(act => ({
          ...act,
          type: 'vocabulary' as const,
          cards: act.cards || (act.data ? [act.data] : [{ 
            id: '1', 
            spanish: act.data?.spanish || 'Hola', 
            english: act.data?.english || 'Hello' 
          }])
        })),
        ...data.activitiesByType.comprehension.map(act => ({
          ...act,
          type: 'comprehension' as const,
          questions: act.questions || (act.data ? [act.data] : [{
            id: '1',
            question: act.data?.question || '¿Cuál es el tema principal?',
            type: 'short' as const,
            correctAnswers: act.data?.correctAnswers || ['tema'],
            hints: act.data?.hints || []
          }])
        })),
        ...data.activitiesByType.trueFalse.map(act => ({
          ...act,
          type: 'trueFalse' as const,
          questions: act.questions || (act.data ? [act.data] : [{
            id: '1',
            statement: act.data?.statement || 'Esta es una declaración.',
            correct: act.data?.correct || true,
            explanation: act.data?.explanation || 'Explicación'
          }])
        })),
        ...data.activitiesByType.matching.map(act => ({
          ...act,
          type: 'matching' as const,
          pairs: act.pairs || act.data?.pairs || [{
            id: '1',
            spanish: 'hola',
            english: 'hello'
          }],
          shufflePairs: act.shufflePairs !== undefined ? act.shufflePairs : true
        })),
        ...data.activitiesByType.writing.map(act => ({
          ...act,
          type: 'writing' as const,
          prompts: act.prompts || (act.data ? [act.data] : [{
            id: '1',
            prompt: act.data?.prompt || 'Escribe una oración.',
            type: 'sentence' as const,
            minWords: act.data?.minWords || 5
          }])
        }))
      ];

      setActivities(allActivities);
      setUserProgress(data.userProgress);
      setChapterId(data.chapterId);

      // Create activity session
      const newSession: ActivitySession = {
        currentActivityIndex: 0,
        startTime: new Date(),
        activities: allActivities,
        progress: new Map(data.userProgress.map(p => [`${p.activityType}_${p.activityId}`, p])),
        totalActivities: allActivities.length,
        completedActivities: data.userProgress.filter(p => p.completed).length,
      };

      setSession(newSession);
    } catch (err) {
      setError('Failed to load activities');
      console.error('Load activities error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async (
    activityType: ActivityType,
    activityId: string,
    completed: boolean,
    score?: number,
    timeSpent?: number,
    answers?: Record<string, any>
  ) => {
    try {
      await fetch(
        `/api/chapters/${bookId}/activities/${chapterIndex}/progress`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            activityType,
            activityId,
            completed,
            score,
            timeSpent: timeSpent || 0,
            answers: answers || {},
          }),
        }
      );

      // Update local progress
      if (session) {
        const progressKey = `${activityType}_${activityId}`;
        const updatedProgress = new Map(session.progress);
        
        const existingProgress = updatedProgress.get(progressKey);
        const newProgress: ActivityProgress = {
          id: existingProgress?.id || '',
          userId: existingProgress?.userId || 0,
          bookId,
          chapterId,
          chapterIndex,
          activityType,
          activityId,
          completed,
          score,
          timeSpent: timeSpent || 0,
          answers: answers || {},
          attempts: (existingProgress?.attempts || 0) + 1,
          lastAttemptAt: new Date(),
          completedAt: completed ? new Date() : undefined,
          createdAt: existingProgress?.createdAt || new Date(),
          updatedAt: new Date(),
        };

        updatedProgress.set(progressKey, newProgress);

        setSession(prev => prev ? {
          ...prev,
          progress: updatedProgress,
          completedActivities: Array.from(updatedProgress.values()).filter(p => p.completed).length,
        } : null);
      }
    } catch (error) {
      console.error('Save progress error:', error);
    }
  };

  const navigateToActivity = (index: number) => {
    if (index >= 0 && index < activities.length) {
      setCurrentActivityIndex(index);
      if (session) {
        setSession(prev => prev ? { ...prev, currentActivityIndex: index } : null);
      }
    }
  };

  const nextActivity = () => {
    if (currentActivityIndex < activities.length - 1) {
      navigateToActivity(currentActivityIndex + 1);
    }
  };

  const previousActivity = () => {
    if (currentActivityIndex > 0) {
      navigateToActivity(currentActivityIndex - 1);
    }
  };

  const finishActivities = () => {
    router.push(`/read/${bookId}/chapter/${chapterIndex}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fef7f0', background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 mb-6" style={{ borderColor: '#ff6b35' }}></div>
          <p className="text-xl font-medium" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>Loading activities...</p>
        </div>
      </div>
    );
  }

  if (error || !session || activities.length === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#fef7f0', background: 'linear-gradient(135deg, #fef7f0 0%, #fff1e6 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="text-8xl mb-6">🎯</div>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>No Activities Available</h2>
            <p className="text-lg mb-8" style={{ color: '#64748b' }}>
              {error || 'No learning activities are available for this chapter yet.'}
            </p>
            <button
              onClick={() => router.push(`/read/${bookId}/chapter/${chapterIndex}`)}
              className="px-8 py-4 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              style={{ backgroundColor: '#3b82f6', boxShadow: '0 6px 20px rgba(59, 130, 246, 0.3)', fontFamily: 'Inter, sans-serif' }}
            >
              Back to Chapter
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentActivity = activities[currentActivityIndex];

  const renderCurrentActivity = () => {
    if (!currentActivity) return null;

    const progressKey = `${currentActivity.type}_${currentActivity.id}`;
    const activityProgress = session.progress.get(progressKey);

    const commonProps = {
      activity: currentActivity,
      progress: activityProgress,
      onComplete: (score?: number, answers?: Record<string, any>, timeSpent?: number) =>
        saveProgress(currentActivity.type, currentActivity.id, true, score, timeSpent, answers),
      onProgress: (answers: Record<string, any>, timeSpent?: number) =>
        saveProgress(currentActivity.type, currentActivity.id, false, undefined, timeSpent, answers),
      onNext: nextActivity,
      onPrevious: previousActivity,
      canNavigateNext: currentActivityIndex < activities.length - 1,
      canNavigatePrevious: currentActivityIndex > 0,
    };

    switch (currentActivity.type) {
      case 'vocabulary':
        return <Flashcards {...commonProps} bookId={bookId} />;
      case 'comprehension':
        return <Comprehension {...commonProps} />;
      case 'trueFalse':
        return <TrueFalse {...commonProps} />;
      case 'matching':
        return <Matching {...commonProps} />;
      case 'writing':
        return <Writing {...commonProps} />;
      default:
        return <div>Unknown activity type</div>;
    }
  };

  return (
    <ActivitiesLayout
      session={session}
      currentActivityIndex={currentActivityIndex}
      onNavigateToActivity={navigateToActivity}
      onFinish={finishActivities}
      bookId={bookId}
      chapterIndex={chapterIndex}
    >
      {renderCurrentActivity()}
    </ActivitiesLayout>
  );
}