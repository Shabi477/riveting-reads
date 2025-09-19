'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Activity, 
  ActivityType, 
  FlashcardActivity, 
  ComprehensionActivity, 
  TrueFalseActivity, 
  MatchingActivity, 
  getActivityTypeIcon,
  getActivityTypeColor
} from '@/lib/activityTypes';

export default function ChapterActivitiesPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;
  const chapterId = params.chapterId as string;
  
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<ActivityType>('vocabulary');
  const [activities, setActivities] = useState<{
    vocabulary: FlashcardActivity[];
    comprehension: ComprehensionActivity[];
    trueFalse: TrueFalseActivity[];
    matching: MatchingActivity[];
  }>({
    vocabulary: [],
    comprehension: [],
    trueFalse: [],
    matching: []
  });

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/admin/books/${bookId}/chapters/${chapterId}/activities`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // If activities exist in database, use them
        if (data.activitiesByType) {
          setActivities(data.activitiesByType);
        } else {
          // Otherwise create default activities
          const defaultActivities = {
            vocabulary: [createDefaultVocabularyActivity()],
            comprehension: [createDefaultComprehensionActivity()],
            trueFalse: [createDefaultTrueFalseActivity()],
            matching: [createDefaultMatchingActivity()]
          };
          setActivities(defaultActivities);
        }
      } else {
        // If loading fails, create default activities
        console.warn('Failed to load existing activities, creating defaults');
        const defaultActivities = {
          vocabulary: [createDefaultVocabularyActivity()],
          comprehension: [createDefaultComprehensionActivity()],
          trueFalse: [createDefaultTrueFalseActivity()],
          matching: [createDefaultMatchingActivity()]
        };
        setActivities(defaultActivities);
      }
    } catch (error) {
      console.error('Failed to load activities:', error);
      setMessage('❌ Failed to load activities');
      // Fallback to default activities
      const defaultActivities = {
        vocabulary: [createDefaultVocabularyActivity()],
        comprehension: [createDefaultComprehensionActivity()],
        trueFalse: [createDefaultTrueFalseActivity()],
        matching: [createDefaultMatchingActivity()]
      };
      setActivities(defaultActivities);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/books/${bookId}/chapters/${chapterId}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activitiesByType: activities
        })
      });

      if (response.status === 401) {
        setMessage('❌ Authentication required');
        router.push('/admin/login');
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setMessage(`✅ ${data.activityCount} activities saved successfully!`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save activities');
      }
    } catch (error: any) {
      console.error('Failed to save activities:', error);
      setMessage(`❌ Failed to save activities: ${error.message}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const activityTypes: { type: ActivityType; label: string }[] = [
    { type: 'vocabulary', label: 'Vocabulary' },
    { type: 'comprehension', label: 'Comprehension' },
    { type: 'trueFalse', label: 'True/False' },
    { type: 'matching', label: 'Matching' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading activities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/admin/books/${bookId}/chapters`)}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Chapters
              </button>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Chapter Activities Editor
            </h1>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
              >
                {previewMode ? '✏️ Edit Mode' : '👁️ Preview Mode'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center"
              >
                {saving ? 'Saving...' : '💾 Save All'}
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.includes('❌') 
              ? 'bg-red-50 text-red-800 border-red-200' 
              : 'bg-green-50 text-green-800 border-green-200'
          }`}>
            {message}
          </div>
        )}
        
        {/* Activity Type Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Activity types">
              {activityTypes.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === type
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{getActivityTypeIcon(type)}</span>
                  <span>{label}</span>
                  <span className="ml-2 bg-gray-200 text-gray-700 py-1 px-2 rounded-full text-xs">
                    {activities[type].length}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Activity Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {previewMode ? (
            <ActivityPreview 
              activityType={activeTab} 
              activities={activities[activeTab]}
            />
          ) : (
            <ActivityEditor 
              activityType={activeTab}
              activities={activities[activeTab]}
              onActivitiesChange={(updatedActivities) => 
                setActivities(prev => ({ ...prev, [activeTab]: updatedActivities }))
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}

// Helper functions to create default activities
function createDefaultVocabularyActivity(): FlashcardActivity {
  return {
    id: 'vocab_1',
    type: 'vocabulary',
    title: 'Chapter Vocabulary',
    instructions: 'Review and learn the key vocabulary from this chapter.',
    difficulty: 'easy',
    estimatedTime: 5,
    cards: [
      {
        id: 'card_1',
        spanish: 'hola',
        english: 'hello',
        context: 'A common greeting'
      },
      {
        id: 'card_2', 
        spanish: 'gracias',
        english: 'thank you',
        context: 'Expression of gratitude'
      }
    ]
  };
}

function createDefaultComprehensionActivity(): ComprehensionActivity {
  return {
    id: 'comp_1',
    type: 'comprehension',
    title: 'Reading Comprehension',
    instructions: 'Answer questions about the chapter content.',
    difficulty: 'medium',
    estimatedTime: 7,
    questions: [
      {
        id: 'q_1',
        question: 'What is the main theme of this chapter?',
        type: 'short',
        correctAnswers: ['learning', 'education', 'story'],
        hints: ['Think about what the chapter teaches']
      }
    ]
  };
}

function createDefaultTrueFalseActivity(): TrueFalseActivity {
  return {
    id: 'tf_1',
    type: 'trueFalse',
    title: 'True or False Questions',
    instructions: 'Read each statement and decide if it is true or false.',
    difficulty: 'easy',
    estimatedTime: 3,
    questions: [
      {
        id: 'tf_q_1',
        statement: 'This chapter is written in Spanish.',
        correct: true,
        explanation: 'Yes, this is a Spanish learning text.'
      }
    ]
  };
}

function createDefaultMatchingActivity(): MatchingActivity {
  return {
    id: 'match_1',
    type: 'matching',
    title: 'Match Spanish and English',
    instructions: 'Match the Spanish words with their English translations.',
    difficulty: 'medium',
    estimatedTime: 4,
    shufflePairs: true,
    pairs: [
      {
        id: 'pair_1',
        spanish: 'casa',
        english: 'house'
      },
      {
        id: 'pair_2',
        spanish: 'agua',
        english: 'water'
      }
    ]
  };
}


// Activity Editor Component
function ActivityEditor({ 
  activityType, 
  activities, 
  onActivitiesChange 
}: {
  activityType: ActivityType;
  activities: Activity[];
  onActivitiesChange: (activities: Activity[]) => void;
}) {
  const addActivity = () => {
    let newActivity: Activity;
    
    switch (activityType) {
      case 'vocabulary':
        newActivity = createDefaultVocabularyActivity();
        break;
      case 'comprehension':
        newActivity = createDefaultComprehensionActivity();
        break;
      case 'trueFalse':
        newActivity = createDefaultTrueFalseActivity();
        break;
      case 'matching':
        newActivity = createDefaultMatchingActivity();
        break;
      default:
        return;
    }
    
    newActivity.id = `${activityType}_${Date.now()}`;
    onActivitiesChange([...activities, newActivity]);
  };

  const removeActivity = (activityId: string) => {
    onActivitiesChange(activities.filter(a => a.id !== activityId));
  };

  const updateActivity = (activityId: string, updates: Partial<Activity>) => {
    onActivitiesChange(
      activities.map(a => a.id === activityId ? { ...a, ...updates } : a)
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
          <span className="text-2xl">{getActivityTypeIcon(activityType)}</span>
          <span>{activityType.charAt(0).toUpperCase() + activityType.slice(1)} Activities</span>
        </h2>
        <button
          onClick={addActivity}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <span>+</span>
          <span>Add Activity</span>
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <span className="text-4xl mb-4 block">{getActivityTypeIcon(activityType)}</span>
          <p className="text-lg mb-4">No {activityType} activities yet</p>
          <button
            onClick={addActivity}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create Your First Activity
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Activity {index + 1}: {activity.title}
                </h3>
                <button
                  onClick={() => removeActivity(activity.id)}
                  className="text-red-600 hover:text-red-800 transition-colors"
                >
                  🗑️ Remove
                </button>
              </div>
              
              {/* Basic activity properties */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={activity.title}
                    onChange={(e) => updateActivity(activity.id, { title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    value={activity.difficulty}
                    onChange={(e) => updateActivity(activity.id, { difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time (minutes)</label>
                  <input
                    type="number"
                    value={activity.estimatedTime}
                    onChange={(e) => updateActivity(activity.id, { estimatedTime: parseInt(e.target.value) || 5 })}
                    min="1"
                    max="30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea
                  value={activity.instructions}
                  onChange={(e) => updateActivity(activity.id, { instructions: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Instructions for students..."
                />
              </div>
              
              {/* Activity-specific content editors */}
              <ActivityTypeEditor
                activity={activity}
                onUpdate={(updates) => updateActivity(activity.id, updates)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Activity Type Editor Component
function ActivityTypeEditor({
  activity,
  onUpdate
}: {
  activity: Activity;
  onUpdate: (updates: Partial<Activity>) => void;
}) {
  switch (activity.type) {
    case 'vocabulary':
      return <VocabularyEditor activity={activity as FlashcardActivity} onUpdate={onUpdate} />;
    case 'comprehension':
      return <ComprehensionEditor activity={activity as ComprehensionActivity} onUpdate={onUpdate} />;
    case 'trueFalse':
      return <TrueFalseEditor activity={activity as TrueFalseActivity} onUpdate={onUpdate} />;
    case 'matching':
      return <MatchingEditor activity={activity as MatchingActivity} onUpdate={onUpdate} />;
    default:
      return null;
  }
}

// Vocabulary Editor
function VocabularyEditor({
  activity,
  onUpdate
}: {
  activity: FlashcardActivity;
  onUpdate: (updates: Partial<Activity>) => void;
}) {
  const [bulkText, setBulkText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  const addCard = () => {
    const newCard = {
      id: `card_${Date.now()}`,
      spanish: '',
      english: '',
      context: ''
    };
    onUpdate({ cards: [...activity.cards, newCard] });
  };

  const removeCard = (cardId: string) => {
    onUpdate({ cards: activity.cards.filter(c => c.id !== cardId) });
  };

  const updateCard = (cardId: string, updates: Partial<typeof activity.cards[0]>) => {
    onUpdate({
      cards: activity.cards.map(c => c.id === cardId ? { ...c, ...updates } : c)
    });
  };

  const parseBulkVocabulary = () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    const newCards = lines.map((line, index) => {
      const parts = line.split(/[\t|,-]/); // Support tab, pipe, comma, or dash separators
      const spanish = parts[0]?.trim() || '';
      const english = parts[1]?.trim() || '';
      const context = parts[2]?.trim() || '';
      
      return {
        id: `card_${Date.now()}_${index}`,
        spanish,
        english,
        context
      };
    }).filter(card => card.spanish && card.english); // Only keep cards with both Spanish and English

    onUpdate({ cards: [...activity.cards, ...newCards] });
    setBulkText('');
    setShowBulkImport(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">Vocabulary Cards</h4>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            📋 Bulk Import
          </button>
          <button
            onClick={addCard}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
          >
            + Add Card
          </button>
        </div>
      </div>
      
      {showBulkImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 mb-2">Bulk Import Vocabulary</h5>
          <p className="text-sm text-blue-700 mb-3">
            Paste your vocabulary list. Each line should contain: <strong>Spanish | English | Context (optional)</strong>
            <br />Supports separators: | (pipe), tab, comma, or dash
          </p>
          <div className="mb-3">
            <label className="block text-sm font-medium text-blue-700 mb-1">Example format:</label>
            <div className="bg-blue-100 p-2 rounded text-sm font-mono text-blue-800">
              hola | hello | A common greeting<br />
              gracias | thank you | Expression of gratitude<br />
              casa | house
            </div>
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="hola | hello | A common greeting&#10;gracias | thank you | Expression of gratitude&#10;casa | house&#10;agua | water"
          />
          <div className="flex space-x-2 mt-3">
            <button
              onClick={parseBulkVocabulary}
              disabled={!bulkText.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Import {bulkText.split('\n').filter(line => line.trim()).length} Cards
            </button>
            <button
              onClick={() => { setBulkText(''); setShowBulkImport(false); }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {activity.cards.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No vocabulary cards yet. Add your first card above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.cards.map((card, index) => (
            <div key={card.id} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-gray-900">Card {index + 1}</h5>
                <button
                  onClick={() => removeCard(card.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spanish Word</label>
                  <input
                    type="text"
                    value={card.spanish}
                    onChange={(e) => updateCard(card.id, { spanish: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="palabra"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">English Translation</label>
                  <input
                    type="text"
                    value={card.english}
                    onChange={(e) => updateCard(card.id, { english: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="word"
                  />
                </div>
              </div>
              
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Context (optional)</label>
                <input
                  type="text"
                  value={card.context || ''}
                  onChange={(e) => updateCard(card.id, { context: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Example usage or context"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Comprehension Editor
function ComprehensionEditor({
  activity,
  onUpdate
}: {
  activity: ComprehensionActivity;
  onUpdate: (updates: Partial<Activity>) => void;
}) {
  const params = useParams();
  const bookId = params.bookId as string;
  const chapterId = params.chapterId as string;
  
  const [bulkText, setBulkText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAIGeneration, setShowAIGeneration] = useState(false);
  const [aiMode, setAiMode] = useState<'auto' | 'custom'>('auto');
  const [numQuestions, setNumQuestions] = useState(5);
  const [customQuestions, setCustomQuestions] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPreviewQuestions, setAiPreviewQuestions] = useState<any[]>([]);
  const [aiMessage, setAiMessage] = useState('');

  const addQuestion = () => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      question: '',
      type: 'multiple_choice' as const,
      options: {
        A: '',
        B: '',
        C: '',
        D: ''
      },
      correctAnswer: 'A' as const,
      explanation: '',
      hints: ['']
    };
    onUpdate({ questions: [...activity.questions, newQuestion] });
  };

  const removeQuestion = (questionId: string) => {
    onUpdate({ questions: activity.questions.filter(q => q.id !== questionId) });
  };

  const updateQuestion = (questionId: string, updates: Partial<typeof activity.questions[0]>) => {
    onUpdate({
      questions: activity.questions.map(q => q.id === questionId ? { ...q, ...updates } : q)
    });
  };

  const updateOptions = (questionId: string, optionKey: 'A' | 'B' | 'C' | 'D', value: string) => {
    const question = activity.questions.find(q => q.id === questionId);
    if (question && question.type === 'multiple_choice') {
      updateQuestion(questionId, {
        options: {
          ...question.options,
          [optionKey]: value
        }
      });
    }
  };

  const updateHints = (questionId: string, hints: string[]) => {
    updateQuestion(questionId, { hints: hints.filter(h => h.trim()) });
  };

  const parseBulkComprehension = () => {
    const sections = bulkText.split(/\n\s*\n/).filter(section => section.trim());
    const newQuestions = sections.map((section, index) => {
      const lines = section.split('\n').filter(line => line.trim());
      const question = lines[0]?.replace(/^\d+\.?\s*/, '').trim() || ''; // Remove numbering
      
      // Look for answers after "Answer:" or "Answers:" or "A:"
      const answerIndex = lines.findIndex(line => /^(answers?|a):/i.test(line.trim()));
      let correctAnswers: string[] = [];
      let hints: string[] = [];
      
      if (answerIndex > 0) {
        const answerLine = lines[answerIndex].replace(/^(answers?|a):\s*/i, '').trim();
        correctAnswers = answerLine.split(/[,;|]/).map(a => a.trim()).filter(a => a);
        
        // Look for hints after answers
        const hintIndex = lines.findIndex(line => /^(hints?|h):/i.test(line.trim()));
        if (hintIndex > answerIndex) {
          const hintLine = lines[hintIndex].replace(/^(hints?|h):\s*/i, '').trim();
          hints = hintLine.split(/[,;|]/).map(h => h.trim()).filter(h => h);
        }
      } else {
        // If no "Answer:" found, assume remaining lines are answers
        correctAnswers = lines.slice(1).map(line => line.trim()).filter(line => line);
      }
      
      return {
        id: `q_${Date.now()}_${index}`,
        question,
        type: 'multiple_choice' as const,
        options: {
          A: correctAnswers[0] || 'Option A',
          B: correctAnswers[1] || 'Option B',
          C: correctAnswers[2] || 'Option C',
          D: correctAnswers[3] || 'Option D'
        },
        correctAnswer: 'A' as const,
        explanation: '',
        hints: hints.length > 0 ? hints : undefined
      };
    }).filter(q => q.question); // Only keep questions with actual content

    onUpdate({ questions: [...activity.questions, ...newQuestions] });
    setBulkText('');
    setShowBulkImport(false);
  };

  const generateWithAI = async () => {
    if (!bookId || !chapterId) {
      setAiMessage('❌ Missing book or chapter information');
      return;
    }

    if (aiMode === 'custom' && !customQuestions.trim()) {
      setAiMessage('❌ Please enter at least one custom question');
      return;
    }

    setIsGenerating(true);
    setAiMessage('');
    setAiPreviewQuestions([]);

    try {
      const requestBody = {
        bookId,
        chapterId,
        mode: aiMode,
        difficulty,
        ...(aiMode === 'auto' ? { numQuestions } : { questions: customQuestions.split('\n').filter(q => q.trim()) })
      };

      const response = await fetch('/api/admin/activities/generate-comprehension', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.success && data.questions) {
        setAiPreviewQuestions(data.questions);
        setAiMessage(`✅ Generated ${data.questions.length} questions successfully! Review and add them to your activity.`);
      } else {
        throw new Error('Invalid response format from AI generation');
      }
    } catch (error) {
      console.error('AI Generation error:', error);
      setAiMessage(`❌ Failed to generate questions: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const addAIQuestionsToActivity = () => {
    if (aiPreviewQuestions.length === 0) return;

    const newQuestions = aiPreviewQuestions.map(q => ({
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question: q.question,
      type: 'multiple_choice' as const,
      options: {
        A: q.options?.A || 'Option A',
        B: q.options?.B || 'Option B',
        C: q.options?.C || 'Option C',
        D: q.options?.D || 'Option D'
      },
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || '',
      hints: q.hints || []
    }));

    onUpdate({ questions: [...activity.questions, ...newQuestions] });
    setAiPreviewQuestions([]);
    setAiMessage(`✅ Added ${newQuestions.length} multiple choice questions to activity!`);
    setShowAIGeneration(false);
    
    // Clear message after 3 seconds
    setTimeout(() => setAiMessage(''), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">Comprehension Questions</h4>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowAIGeneration(!showAIGeneration)}
            className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 flex items-center space-x-1"
          >
            <span>🤖</span>
            <span>AI Generate</span>
          </button>
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            📋 Bulk Import
          </button>
          <button
            onClick={addQuestion}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
          >
            + Add Question
          </button>
        </div>
      </div>

      {aiMessage && (
        <div className={`p-3 rounded-lg border ${
          aiMessage.includes('❌') 
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-green-50 text-green-800 border-green-200'
        }`}>
          {aiMessage}
        </div>
      )}

      {showAIGeneration && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 mb-3 flex items-center space-x-2">
            <span>🤖</span>
            <span>AI Question Generation</span>
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">Generation Mode</label>
              <select
                value={aiMode}
                onChange={(e) => setAiMode(e.target.value as 'auto' | 'custom')}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="auto">Auto-Generate Questions</option>
                <option value="custom">Answer My Questions</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            {aiMode === 'auto' && (
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-1">Number of Questions</label>
                <input
                  type="number"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
          </div>

          {aiMode === 'auto' ? (
            <div className="mb-4">
              <p className="text-sm text-purple-700 mb-2">
                🤖 AI will read the chapter content and automatically generate {numQuestions} high-quality comprehension questions with answers and hints.
              </p>
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-purple-700 mb-1">
                Your Questions (one per line)
              </label>
              <textarea
                value={customQuestions}
                onChange={(e) => setCustomQuestions(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="What is the main theme of this chapter?&#10;Who is the protagonist?&#10;How does the character change throughout the story?&#10;What lesson does the chapter teach?"
              />
              <p className="text-sm text-purple-600 mt-1">
                AI will read the chapter content and generate quality answers for your questions.
              </p>
            </div>
          )}

          <div className="flex space-x-3 mb-4">
            <button
              onClick={generateWithAI}
              disabled={isGenerating || (aiMode === 'custom' && !customQuestions.trim())}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>Generate Questions</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowAIGeneration(false);
                setAiPreviewQuestions([]);
                setAiMessage('');
              }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>

          {aiPreviewQuestions.length > 0 && (
            <div className="border-t border-purple-200 pt-4">
              <h6 className="font-semibold text-purple-800 mb-3">Preview Generated Questions</h6>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {aiPreviewQuestions.map((question, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-purple-200">
                    <div className="font-medium text-gray-900 mb-2">
                      Q{index + 1}: {question.question}
                    </div>
                    <div className="text-sm text-purple-700 mb-2">
                      <strong>Type:</strong> Multiple Choice
                    </div>
                    {/* Multiple Choice Options */}
                    <div className="mb-2">
                      <div className="text-sm font-medium text-gray-700 mb-1">Options:</div>
                      <div className="grid grid-cols-1 gap-1 text-sm">
                        <div className={`p-2 rounded ${question.correctAnswer === 'A' ? 'bg-green-100 border border-green-400' : 'bg-gray-50'}`}>
                          <strong>A)</strong> {question.options?.A || 'Option A'}
                          {question.correctAnswer === 'A' && <span className="ml-2 text-green-600 font-bold">✓ Correct</span>}
                        </div>
                        <div className={`p-2 rounded ${question.correctAnswer === 'B' ? 'bg-green-100 border border-green-400' : 'bg-gray-50'}`}>
                          <strong>B)</strong> {question.options?.B || 'Option B'}
                          {question.correctAnswer === 'B' && <span className="ml-2 text-green-600 font-bold">✓ Correct</span>}
                        </div>
                        <div className={`p-2 rounded ${question.correctAnswer === 'C' ? 'bg-green-100 border border-green-400' : 'bg-gray-50'}`}>
                          <strong>C)</strong> {question.options?.C || 'Option C'}
                          {question.correctAnswer === 'C' && <span className="ml-2 text-green-600 font-bold">✓ Correct</span>}
                        </div>
                        <div className={`p-2 rounded ${question.correctAnswer === 'D' ? 'bg-green-100 border border-green-400' : 'bg-gray-50'}`}>
                          <strong>D)</strong> {question.options?.D || 'Option D'}
                          {question.correctAnswer === 'D' && <span className="ml-2 text-green-600 font-bold">✓ Correct</span>}
                        </div>
                      </div>
                    </div>
                    {question.explanation && (
                      <div className="text-sm text-gray-600 mb-1">
                        <strong>Explanation:</strong> {question.explanation}
                      </div>
                    )}
                    {question.hints && question.hints.length > 0 && (
                      <div className="text-sm text-gray-600">
                        <strong>Hints:</strong> {question.hints.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={addAIQuestionsToActivity}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 flex items-center space-x-2"
                >
                  <span>✅</span>
                  <span>Add {aiPreviewQuestions.length} Questions to Activity</span>
                </button>
                <button
                  onClick={() => setAiPreviewQuestions([])}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
                >
                  Clear Preview
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {showBulkImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 mb-2">Bulk Import Questions</h5>
          <p className="text-sm text-blue-700 mb-3">
            Paste your questions. Separate each question with a blank line. Format:
            <br /><strong>Question text</strong>
            <br /><strong>Answer:</strong> correct answer 1, correct answer 2
            <br /><strong>Hints:</strong> hint 1, hint 2 (optional)
          </p>
          <div className="mb-3">
            <label className="block text-sm font-medium text-blue-700 mb-1">Example format:</label>
            <div className="bg-blue-100 p-2 rounded text-sm font-mono text-blue-800">
              What is the main theme of this chapter?<br />
              Answer: learning, education, story<br />
              Hints: Think about what the chapter teaches<br />
              <br />
              Who is the main character?<br />
              Answer: Elena, teacher<br />
              Hints: Look at the beginning of the story
            </div>
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What is the main theme of this chapter?&#10;Answer: learning, education, story&#10;Hints: Think about what the chapter teaches&#10;&#10;Who is the main character?&#10;Answer: Elena, teacher"
          />
          <div className="flex space-x-2 mt-3">
            <button
              onClick={parseBulkComprehension}
              disabled={!bulkText.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Import {bulkText.split(/\n\s*\n/).filter(s => s.trim()).length} Questions
            </button>
            <button
              onClick={() => { setBulkText(''); setShowBulkImport(false); }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {activity.passage && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reading Passage (optional)</label>
          <textarea
            value={activity.passage}
            onChange={(e) => onUpdate({ passage: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional reading passage for questions..."
          />
        </div>
      )}
      
      {activity.questions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No questions yet. Add your first question above!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activity.questions.map((question, index) => (
            <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-gray-900">Question {index + 1}</h5>
                <button
                  onClick={() => removeQuestion(question.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                  <textarea
                    value={question.question}
                    onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="What is the main theme of this chapter?"
                  />
                </div>
                
                {question.type === 'multiple_choice' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>
                      <div className="space-y-3">
                        {Object.entries(question.options).map(([optionKey, optionValue]) => (
                          <div key={optionKey} className="flex items-center space-x-3">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`correct-${question.id}`}
                                checked={question.correctAnswer === optionKey}
                                onChange={() => updateQuestion(question.id, { correctAnswer: optionKey as 'A' | 'B' | 'C' | 'D' })}
                                className="mr-2 h-4 w-4 text-blue-600"
                              />
                              <span className="font-medium text-gray-700 w-8">{optionKey}.</span>
                            </label>
                            <input
                              type="text"
                              value={optionValue}
                              onChange={(e) => updateOptions(question.id, optionKey as 'A' | 'B' | 'C' | 'D', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`Enter option ${optionKey}...`}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Click the radio button to mark the correct answer</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (optional)</label>
                      <textarea
                        value={question.explanation || ''}
                        onChange={(e) => updateQuestion(question.id, { explanation: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Explain why this is the correct answer..."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                        <select
                          value={question.type}
                          onChange={(e) => updateQuestion(question.id, { type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answers (one per line)</label>
                      <textarea
                        value={(question as any).correctAnswers?.join('\n') || ''}
                        onChange={(e) => updateQuestion(question.id, { correctAnswers: e.target.value.split('\n') } as any)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="learning\neducation\nstory"
                      />
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hints (optional, one per line)</label>
                  <textarea
                    value={(question.hints || []).join('\n')}
                    onChange={(e) => updateHints(question.id, e.target.value.split('\n'))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Think about what the chapter teaches\nConsider the main character's journey"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// TrueFalse Editor
function TrueFalseEditor({
  activity,
  onUpdate
}: {
  activity: TrueFalseActivity;
  onUpdate: (updates: Partial<Activity>) => void;
}) {
  const params = useParams();
  const bookId = params.bookId as string;
  const chapterId = params.chapterId as string;
  
  const [bulkText, setBulkText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAIGeneration, setShowAIGeneration] = useState(false);
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPreviewQuestions, setAiPreviewQuestions] = useState<any[]>([]);
  const [aiMessage, setAiMessage] = useState('');

  const addQuestion = () => {
    const newQuestion = {
      id: `tf_${Date.now()}`,
      statement: '',
      correct: true,
      explanation: ''
    };
    onUpdate({ questions: [...activity.questions, newQuestion] });
  };

  const removeQuestion = (questionId: string) => {
    onUpdate({ questions: activity.questions.filter(q => q.id !== questionId) });
  };

  const updateQuestion = (questionId: string, updates: Partial<typeof activity.questions[0]>) => {
    onUpdate({
      questions: activity.questions.map(q => q.id === questionId ? { ...q, ...updates } : q)
    });
  };

  const parseBulkTrueFalse = () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    const newQuestions = lines.map((line, index) => {
      // Look for T/F indicators at start or end of line
      const tfMatch = line.match(/^(T|F|TRUE|FALSE)\s*[:|.]\s*(.*)|(.*)\s*[\s-]\s*(T|F|TRUE|FALSE)$/i);
      let statement = '';
      let correct = true;
      
      if (tfMatch) {
        const indicator = (tfMatch[1] || tfMatch[4]).toUpperCase();
        statement = (tfMatch[2] || tfMatch[3]).trim();
        correct = indicator.startsWith('T');
      } else {
        // If no T/F found, assume true and use whole line
        statement = line.trim();
        correct = true;
      }
      
      // Look for explanation after "Explanation:" or in parentheses
      let explanation = '';
      const explanationMatch = statement.match(/(.*)\s*\((.*)\)\s*$/) || statement.match(/(.*)\s*Explanation:\s*(.*)$/i);
      if (explanationMatch) {
        statement = explanationMatch[1].trim();
        explanation = explanationMatch[2].trim();
      }
      
      return {
        id: `tf_${Date.now()}_${index}`,
        statement,
        correct,
        explanation: explanation || `${correct ? 'True' : 'False'}, this statement is ${correct ? 'correct' : 'incorrect'}.`
      };
    }).filter(q => q.statement); // Only keep questions with statements

    onUpdate({ questions: [...activity.questions, ...newQuestions] });
    setBulkText('');
    setShowBulkImport(false);
  };

  const generateWithAI = async () => {
    if (!bookId || !chapterId) {
      setAiMessage('❌ Missing book or chapter information');
      return;
    }

    setIsGenerating(true);
    setAiMessage('');
    setAiPreviewQuestions([]);

    try {
      const requestBody = {
        bookId,
        chapterId,
        numQuestions,
        difficulty
      };

      const response = await fetch('/api/admin/activities/generate-truefalse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.success && data.questions) {
        setAiPreviewQuestions(data.questions);
        setAiMessage(`✅ Generated ${data.questions.length} true/false questions successfully! Review and add them to your activity.`);
      } else {
        throw new Error('Invalid response format from AI generation');
      }
    } catch (error: any) {
      console.error('AI Generation error:', error);
      setAiMessage(`❌ Failed to generate questions: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const addAIQuestionsToActivity = () => {
    if (aiPreviewQuestions.length === 0) return;

    const newQuestions = aiPreviewQuestions.map(q => ({
      id: `ai_tf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      statement: q.statement,
      correct: q.isTrue,
      explanation: q.explanation || ''
    }));

    onUpdate({ questions: [...activity.questions, ...newQuestions] });
    setAiPreviewQuestions([]);
    setAiMessage(`✅ Added ${newQuestions.length} true/false questions to activity!`);
    setShowAIGeneration(false);
    
    // Clear message after 3 seconds
    setTimeout(() => setAiMessage(''), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">True/False Questions</h4>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowAIGeneration(!showAIGeneration)}
            className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 flex items-center space-x-1"
          >
            <span>🤖</span>
            <span>AI Generate</span>
          </button>
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            📋 Bulk Import
          </button>
          <button
            onClick={addQuestion}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
          >
            + Add Question
          </button>
        </div>
      </div>

      {aiMessage && (
        <div className={`p-3 rounded-lg border ${
          aiMessage.includes('❌') 
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-green-50 text-green-800 border-green-200'
        }`}>
          {aiMessage}
        </div>
      )}

      {showAIGeneration && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 mb-3 flex items-center space-x-2">
            <span>🤖</span>
            <span>AI True/False Question Generation</span>
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">Number of Questions</label>
              <input
                type="number"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                min="1"
                max="10"
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-purple-700 mb-2">
              🤖 AI will read the chapter content and automatically generate {numQuestions} high-quality true/false questions with explanations.
            </p>
          </div>

          <div className="flex space-x-3 mb-4">
            <button
              onClick={generateWithAI}
              disabled={isGenerating}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>Generate Questions</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowAIGeneration(false);
                setAiPreviewQuestions([]);
                setAiMessage('');
              }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>

          {aiPreviewQuestions.length > 0 && (
            <div className="border-t border-purple-200 pt-4">
              <h6 className="font-semibold text-purple-800 mb-3">Preview Generated Questions</h6>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {aiPreviewQuestions.map((question, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-purple-200">
                    <div className="font-medium text-gray-900 mb-2">
                      Q{index + 1}: {question.statement}
                    </div>
                    <div className="text-sm mb-2">
                      <span className={`px-2 py-1 rounded text-white ${
                        question.isTrue ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {question.isTrue ? 'TRUE' : 'FALSE'}
                      </span>
                    </div>
                    {question.explanation && (
                      <div className="text-sm text-gray-600">
                        <strong>Explanation:</strong> {question.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={addAIQuestionsToActivity}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 flex items-center space-x-2"
                >
                  <span>✅</span>
                  <span>Add {aiPreviewQuestions.length} Questions to Activity</span>
                </button>
                <button
                  onClick={() => setAiPreviewQuestions([])}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
                >
                  Clear Preview
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {showBulkImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 mb-2">Bulk Import True/False</h5>
          <p className="text-sm text-blue-700 mb-3">
            Paste your statements. Each line should start with T/F or end with -T/-F. Optional explanations in parentheses.
            <br />Formats: <strong>T: Statement text</strong> or <strong>Statement text - F</strong> or <strong>Statement (explanation)</strong>
          </p>
          <div className="mb-3">
            <label className="block text-sm font-medium text-blue-700 mb-1">Example format:</label>
            <div className="bg-blue-100 p-2 rounded text-sm font-mono text-blue-800">
              T: This chapter is written in Spanish<br />
              F: The characters speak English in the story<br />
              Spanish is a difficult language to learn - F (It can be learned with practice)<br />
              Elena is a teacher (Yes, she teaches Spanish)
            </div>
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="T: This chapter is written in Spanish&#10;F: The characters speak English in the story&#10;Spanish is a difficult language to learn - F&#10;Elena is a teacher"
          />
          <div className="flex space-x-2 mt-3">
            <button
              onClick={parseBulkTrueFalse}
              disabled={!bulkText.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Import {bulkText.split('\n').filter(line => line.trim()).length} Statements
            </button>
            <button
              onClick={() => { setBulkText(''); setShowBulkImport(false); }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {activity.questions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No questions yet. Add your first question above!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activity.questions.map((question, index) => (
            <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-gray-900">Question {index + 1}</h5>
                <button
                  onClick={() => removeQuestion(question.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statement</label>
                  <textarea
                    value={question.statement}
                    onChange={(e) => updateQuestion(question.id, { statement: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="This chapter is written in Spanish."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`correct_${question.id}`}
                        checked={question.correct === true}
                        onChange={() => updateQuestion(question.id, { correct: true })}
                        className="mr-2"
                      />
                      <span className="text-green-600 font-medium">True</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`correct_${question.id}`}
                        checked={question.correct === false}
                        onChange={() => updateQuestion(question.id, { correct: false })}
                        className="mr-2"
                      />
                      <span className="text-red-600 font-medium">False</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
                  <textarea
                    value={question.explanation}
                    onChange={(e) => updateQuestion(question.id, { explanation: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Yes, this is a Spanish learning text."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Matching Editor
function MatchingEditor({
  activity,
  onUpdate
}: {
  activity: MatchingActivity;
  onUpdate: (updates: Partial<Activity>) => void;
}) {
  const params = useParams();
  const bookId = params.bookId as string;
  const chapterId = params.chapterId as string;
  
  const [bulkText, setBulkText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAIGeneration, setShowAIGeneration] = useState(false);
  const [numPairs, setNumPairs] = useState(8);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPreviewPairs, setAiPreviewPairs] = useState<any[]>([]);
  const [aiMessage, setAiMessage] = useState('');

  const addPair = () => {
    const newPair = {
      id: `pair_${Date.now()}`,
      spanish: '',
      english: ''
    };
    onUpdate({ pairs: [...activity.pairs, newPair] });
  };

  const removePair = (pairId: string) => {
    onUpdate({ pairs: activity.pairs.filter(p => p.id !== pairId) });
  };

  const updatePair = (pairId: string, updates: Partial<typeof activity.pairs[0]>) => {
    onUpdate({
      pairs: activity.pairs.map(p => p.id === pairId ? { ...p, ...updates } : p)
    });
  };

  const parseBulkMatching = () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    const newPairs = lines.map((line, index) => {
      // Support various separators: |, tab, =, arrow, comma, semicolon
      const separators = /\s*[|\t=\-><,;:]\s*/;
      const parts = line.split(separators);
      const spanish = parts[0]?.trim() || '';
      const english = parts[1]?.trim() || '';
      
      return {
        id: `pair_${Date.now()}_${index}`,
        spanish,
        english
      };
    }).filter(pair => pair.spanish && pair.english); // Only keep pairs with both parts

    onUpdate({ pairs: [...activity.pairs, ...newPairs] });
    setBulkText('');
    setShowBulkImport(false);
  };

  const generateWithAI = async () => {
    if (!bookId || !chapterId) {
      setAiMessage('❌ Missing book or chapter information');
      return;
    }

    setIsGenerating(true);
    setAiMessage('');
    setAiPreviewPairs([]);

    try {
      const requestBody = {
        bookId,
        chapterId,
        numPairs,
        difficulty
      };

      const response = await fetch('/api/admin/activities/generate-matching', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.success && data.pairs) {
        setAiPreviewPairs(data.pairs);
        setAiMessage(`✅ Generated ${data.pairs.length} matching pairs successfully! Review and add them to your activity.`);
      } else {
        throw new Error('Invalid response format from AI generation');
      }
    } catch (error: any) {
      console.error('AI Generation error:', error);
      setAiMessage(`❌ Failed to generate pairs: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const addAIMatchingToActivity = () => {
    if (aiPreviewPairs.length === 0) return;

    const newPairs = aiPreviewPairs.map(p => ({
      id: `ai_pair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      spanish: p.spanish,
      english: p.english
    }));

    onUpdate({ pairs: [...activity.pairs, ...newPairs] });
    setAiPreviewPairs([]);
    setAiMessage(`✅ Added ${newPairs.length} matching pairs to activity!`);
    setShowAIGeneration(false);
    
    // Clear message after 3 seconds
    setTimeout(() => setAiMessage(''), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">Matching Pairs</h4>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowAIGeneration(!showAIGeneration)}
            className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 flex items-center space-x-1"
          >
            <span>🤖</span>
            <span>AI Generate</span>
          </button>
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            📋 Bulk Import
          </button>
          <button
            onClick={addPair}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
          >
            + Add Pair
          </button>
        </div>
      </div>

      {aiMessage && (
        <div className={`p-3 rounded-lg border ${
          aiMessage.includes('❌') 
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-green-50 text-green-800 border-green-200'
        }`}>
          {aiMessage}
        </div>
      )}

      {showAIGeneration && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h5 className="font-semibold text-purple-900 mb-3 flex items-center space-x-2">
            <span>🤖</span>
            <span>AI Matching Pairs Generation</span>
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-700 mb-1">Number of Pairs</label>
              <input
                type="number"
                value={numPairs}
                onChange={(e) => setNumPairs(Math.max(1, Math.min(15, parseInt(e.target.value) || 8)))}
                min="1"
                max="15"
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-purple-700 mb-2">
              🤖 AI will read the chapter content and automatically generate {numPairs} high-quality Spanish-English matching pairs.
            </p>
          </div>

          <div className="flex space-x-3 mb-4">
            <button
              onClick={generateWithAI}
              disabled={isGenerating}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>Generate Pairs</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowAIGeneration(false);
                setAiPreviewPairs([]);
                setAiMessage('');
              }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>

          {aiPreviewPairs.length > 0 && (
            <div className="border-t border-purple-200 pt-4">
              <h6 className="font-semibold text-purple-800 mb-3">Preview Generated Pairs</h6>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {aiPreviewPairs.map((pair, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-purple-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">Spanish</div>
                        <div className="font-medium text-gray-900">{pair.spanish}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">English</div>
                        <div className="font-medium text-gray-900">{pair.english}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={addAIMatchingToActivity}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 flex items-center space-x-2"
                >
                  <span>✅</span>
                  <span>Add {aiPreviewPairs.length} Pairs to Activity</span>
                </button>
                <button
                  onClick={() => setAiPreviewPairs([])}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
                >
                  Clear Preview
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {showBulkImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h5 className="font-semibold text-blue-900 mb-2">Bulk Import Matching Pairs</h5>
          <p className="text-sm text-blue-700 mb-3">
            Paste your word pairs. Each line should contain: <strong>Spanish word | English word</strong>
            <br />Supports separators: | (pipe), tab, =, arrow, comma, semicolon, colon
          </p>
          <div className="mb-3">
            <label className="block text-sm font-medium text-blue-700 mb-1">Example format:</label>
            <div className="bg-blue-100 p-2 rounded text-sm font-mono text-blue-800">
              casa | house<br />
              agua = water<br />
              libro = book<br />
              gato, cat
            </div>
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="casa | house&#10;agua | water&#10;libro | book&#10;gato | cat"
          />
          <div className="flex space-x-2 mt-3">
            <button
              onClick={parseBulkMatching}
              disabled={!bulkText.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Import {bulkText.split('\n').filter(line => line.trim()).length} Pairs
            </button>
            <button
              onClick={() => { setBulkText(''); setShowBulkImport(false); }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={activity.shufflePairs}
            onChange={(e) => onUpdate({ shufflePairs: e.target.checked })}
            className="mr-2"
          />
          <span className="text-sm text-gray-700">Shuffle pairs for students</span>
        </label>
      </div>
      
      {activity.pairs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No matching pairs yet. Add your first pair above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.pairs.map((pair, index) => (
            <div key={pair.id} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-gray-900">Pair {index + 1}</h5>
                <button
                  onClick={() => removePair(pair.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spanish</label>
                  <input
                    type="text"
                    value={pair.spanish}
                    onChange={(e) => updatePair(pair.id, { spanish: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="casa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">English</label>
                  <input
                    type="text"
                    value={pair.english}
                    onChange={(e) => updatePair(pair.id, { english: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="house"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// Activity Preview Component - Using Real Student Components
function ActivityPreview({ 
  activityType, 
  activities 
}: {
  activityType: ActivityType;
  activities: Activity[];
}) {
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl mb-4 block">{getActivityTypeIcon(activityType)}</span>
        <p className="text-lg">No {activityType} activities to preview</p>
        <p className="text-sm">Switch to Edit Mode to create activities.</p>
      </div>
    );
  }

  const currentActivity = activities[currentActivityIndex];
  
  // Mock callbacks for preview
  const mockCallbacks = {
    onComplete: () => console.log('Activity completed'),
    onProgress: () => console.log('Progress saved'),
    onNext: () => setCurrentActivityIndex(Math.min(currentActivityIndex + 1, activities.length - 1)),
    onPrevious: () => setCurrentActivityIndex(Math.max(currentActivityIndex - 1, 0)),
    canNavigateNext: currentActivityIndex < activities.length - 1,
    canNavigatePrevious: currentActivityIndex > 0
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center space-x-2">
          <span className="text-2xl">{getActivityTypeIcon(activityType)}</span>
          <span>Student Preview: {currentActivity.title}</span>
        </h2>
        <p className="text-gray-600">This is exactly how students will see this activity</p>
        
        {activities.length > 1 && (
          <div className="mt-4 flex items-center justify-center space-x-4">
            <button
              onClick={mockCallbacks.onPrevious}
              disabled={!mockCallbacks.canNavigatePrevious}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-600">
              Activity {currentActivityIndex + 1} of {activities.length}
            </span>
            <button
              onClick={mockCallbacks.onNext}
              disabled={!mockCallbacks.canNavigateNext}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Render the actual student component based on activity type */}
      <div className="border border-gray-200 rounded-lg p-6 bg-white">
        <StudentActivityComponent 
          activity={currentActivity} 
          {...mockCallbacks}
        />
      </div>
    </div>
  );
}

// Interactive Flashcards Component for Preview
function InteractiveFlashcards({ activity }: { activity: FlashcardActivity }) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  
  const currentCard = activity.cards[currentCardIndex];
  const progress = Math.round((knownCards.size / activity.cards.length) * 100);
  
  const nextCard = () => {
    if (currentCardIndex < activity.cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    }
  };
  
  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };
  
  const toggleKnown = (cardId: string, known: boolean) => {
    const newKnownCards = new Set(knownCards);
    if (known) {
      newKnownCards.add(cardId);
    } else {
      newKnownCards.delete(cardId);
    }
    setKnownCards(newKnownCards);
  };
  
  if (!currentCard) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No vocabulary cards available</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">📚 {activity.title}</h3>
        <p className="text-gray-600 mb-4">{activity.instructions}</p>
        
        {/* Progress Bar */}
        <div className="max-w-md mx-auto mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{knownCards.size}/{activity.cards.length} mastered ({progress}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Interactive Flashcard */}
      <div className="max-w-md mx-auto">
        <div className="relative">
          {/* Card Counter */}
          <div className="text-center mb-4">
            <span className="text-sm text-gray-500">
              Card {currentCardIndex + 1} of {activity.cards.length}
            </span>
          </div>
          
          {/* Flashcard */}
          <div className="relative h-64 mx-auto" style={{ perspective: '1000px' }}>
            <div 
              className="absolute inset-0 w-full h-full cursor-pointer transform-gpu transition-transform duration-500"
              style={{ 
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front of card (Spanish) */}
              <div 
                className="absolute inset-0 w-full h-full bg-blue-500 text-white rounded-xl shadow-lg flex items-center justify-center"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="text-center p-6">
                  <div className="text-3xl font-bold mb-2">{currentCard.spanish}</div>
                  <div className="text-blue-200 text-sm">Click to reveal translation</div>
                </div>
              </div>
              
              {/* Back of card (English) */}
              <div 
                className="absolute inset-0 w-full h-full bg-green-500 text-white rounded-xl shadow-lg flex items-center justify-center"
                style={{ 
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                <div className="text-center p-6">
                  <div className="text-2xl font-bold mb-2">{currentCard.english}</div>
                  {currentCard.context && (
                    <div className="text-green-200 text-sm italic">{currentCard.context}</div>
                  )}
                  <div className="text-green-200 text-xs mt-2">Click to flip back</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Card Controls */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={previousCard}
            disabled={currentCardIndex === 0}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-400 transition-colors"
          >
            ← Previous
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={() => toggleKnown(currentCard.id, !knownCards.has(currentCard.id))}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                knownCards.has(currentCard.id)
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {knownCards.has(currentCard.id) ? '✓ Known' : 'Mark Known'}
            </button>
          </div>
          
          <button
            onClick={nextCard}
            disabled={currentCardIndex === activity.cards.length - 1}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-400 transition-colors"
          >
            Next →
          </button>
        </div>
        
        {/* Instructions */}
        <div className="text-center mt-4 text-sm text-gray-500">
          <p>Click the card to flip • Use Previous/Next to navigate • Mark cards you know</p>
        </div>
      </div>
    </div>
  );
}

// Student Activity Component Renderer
function StudentActivityComponent({ 
  activity, 
  onComplete, 
  onProgress, 
  onNext, 
  onPrevious, 
  canNavigateNext, 
  canNavigatePrevious 
}: {
  activity: Activity;
  onComplete: () => void;
  onProgress: () => void;
  onNext: () => void;
  onPrevious: () => void;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
}) {
  // For other activity types, show detailed preview
  // Vocabulary now uses the InteractiveFlashcards component above
  
  const renderActivityContent = () => {
    switch (activity.type) {
      case 'vocabulary':
        const vocabActivity = activity as FlashcardActivity;
        return (
          <InteractiveFlashcards activity={vocabActivity} />
        );
        
      case 'comprehension':
        const compActivity = activity as ComprehensionActivity;
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">📖 {compActivity.title}</h3>
            <p className="text-gray-600 mb-4">{compActivity.instructions}</p>
            {compActivity.passage && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold mb-2">Reading Passage:</h4>
                <p>{compActivity.passage}</p>
              </div>
            )}
            <div className="space-y-4">
              {compActivity.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium mb-2">Question {index + 1}: {question.question}</h5>
                  <textarea 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md" 
                    rows={question.type === 'paragraph' ? 4 : 2}
                    placeholder={`Type your ${question.type} answer here...`}
                  />
                  {question.hints && question.hints.length > 0 && (
                    <div className="mt-2 text-sm text-gray-500">
                      <strong>Hints:</strong> {question.hints.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'trueFalse':
        const tfActivity = activity as TrueFalseActivity;
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">✅ {tfActivity.title}</h3>
            <p className="text-gray-600 mb-4">{tfActivity.instructions}</p>
            <div className="space-y-4">
              {tfActivity.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium mb-3">{index + 1}. {question.statement}</h5>
                  <div className="flex space-x-4 mb-3">
                    <button className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200">
                      ✓ True
                    </button>
                    <button className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200">
                      ✗ False
                    </button>
                  </div>
                  <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                    <strong>Explanation:</strong> {question.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'matching':
        const matchActivity = activity as MatchingActivity;
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">🔗 {matchActivity.title}</h3>
            <p className="text-gray-600 mb-4">{matchActivity.instructions}</p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3 text-blue-700">Spanish</h4>
                <div className="space-y-2">
                  {matchActivity.pairs.map(pair => (
                    <button 
                      key={`spanish-${pair.id}`}
                      className="w-full p-3 text-left bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                    >
                      {pair.spanish}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-green-700">English</h4>
                <div className="space-y-2">
                  {matchActivity.pairs.map(pair => (
                    <button 
                      key={`english-${pair.id}`}
                      className="w-full p-3 text-left bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                    >
                      {pair.english}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return <div>Unknown activity type</div>;
    }
  };

  return (
    <div>
      {renderActivityContent()}
      
      {/* Activity Navigation */}
      <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          Difficulty: {activity.difficulty} | Estimated time: {activity.estimatedTime} min
        </div>
        
        <div className="flex space-x-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Submit Activity
          </button>
          <button className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}