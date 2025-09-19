// Shared types for interactive learning activities
export type ActivityType = 'vocabulary' | 'comprehension' | 'trueFalse' | 'matching';

// Base activity interface
export interface BaseActivity {
  id: string;
  type: ActivityType;
  title: string;
  instructions: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // in minutes
}

// Vocabulary/Flashcard activities
export interface FlashcardActivity extends BaseActivity {
  type: 'vocabulary';
  cards: {
    id: string;
    spanish: string;
    english: string;
    context?: string;
    audioUrl?: string;
    imageUrl?: string;
  }[];
}

// Comprehension questions with multiple choice format
export interface ComprehensionActivity extends BaseActivity {
  type: 'comprehension';
  passage?: string; // Optional reading passage
  questions: {
    id: string;
    question: string;
    type: 'multiple_choice';
    options: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
    hints?: string[];
  }[];
}

// True/False questions
export interface TrueFalseActivity extends BaseActivity {
  type: 'trueFalse';
  questions: {
    id: string;
    statement: string;
    correct: boolean;
    explanation: string;
    relatedVocabulary?: string[];
  }[];
}

// Matching activities (drag and drop or click)
export interface MatchingActivity extends BaseActivity {
  type: 'matching';
  pairs: {
    id: string;
    spanish: string;
    english: string;
    category?: string;
  }[];
  shufflePairs: boolean;
}


// Discriminated union of all activity types
export type Activity = 
  | FlashcardActivity 
  | ComprehensionActivity 
  | TrueFalseActivity 
  | MatchingActivity;

// Progress tracking for activities
export interface ActivityProgress {
  id: string;
  userId: number;
  bookId: string;
  chapterId: string;
  chapterIndex: number;
  activityType: ActivityType;
  activityId: string;
  completed: boolean;
  score?: number; // 0-100 percentage
  timeSpent: number; // in seconds
  answers: Record<string, any>; // Store user answers/responses
  attempts: number;
  lastAttemptAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Activity session state (frontend only)
export interface ActivitySession {
  currentActivityIndex: number;
  startTime: Date;
  activities: Activity[];
  progress: Map<string, ActivityProgress>;
  totalActivities: number;
  completedActivities: number;
}

// API response types
export interface ActivitiesResponse {
  bookId: string;
  chapterIndex: number;
  chapterId: string;
  activitiesByType: {
    vocabulary: FlashcardActivity[];
    comprehension: ComprehensionActivity[];
    trueFalse: TrueFalseActivity[];
    matching: MatchingActivity[];
  };
  userProgress: ActivityProgress[];
}

// Progress update request
export interface ActivityProgressUpdate {
  activityType: ActivityType;
  activityId: string;
  completed: boolean;
  score?: number;
  timeSpent: number;
  answers: Record<string, any>;
}

// Activity generation helpers (for mock data)
export const createMockActivities = (chapterContent: any[]): Activity[] => {
  const activities: Activity[] = [];
  
  // Create vocabulary flashcards from chapter words
  if (chapterContent.length > 0) {
    const vocabularyCards = chapterContent.slice(0, 10).map((word, index) => ({
      id: `vocab_${index}`,
      spanish: word.text || `palabra${index}`,
      english: word.translation || `word${index}`,
      context: word.context || undefined,
    }));

    activities.push({
      id: 'vocabulary_1',
      type: 'vocabulary' as const,
      title: 'Vocabulary Practice',
      instructions: 'Review the vocabulary from this chapter. Click cards to flip them.',
      difficulty: 'easy' as const,
      estimatedTime: 5,
      cards: vocabularyCards,
    });
  }

  // Create comprehension questions
  activities.push({
    id: 'comprehension_1',
    type: 'comprehension' as const,
    title: 'Reading Comprehension',
    instructions: 'Choose the best answer for each question about the chapter.',
    difficulty: 'medium' as const,
    estimatedTime: 7,
    questions: [
      {
        id: 'comp_1',
        question: '¿Cuál es el tema principal del capítulo?',
        type: 'multiple_choice' as const,
        options: {
          A: 'Una historia de aventuras',
          B: 'Un cuento sobre la familia',
          C: 'Una lección de gramática',
          D: 'Un poema romántico'
        },
        correctAnswer: 'A' as const,
        explanation: 'El capítulo presenta una historia de aventuras con personajes que exploran nuevos lugares.',
        hints: ['Think about what type of story this is'],
      },
      {
        id: 'comp_2',
        question: '¿Quién es el personaje principal?',
        type: 'multiple_choice' as const,
        options: {
          A: 'Un profesor',
          B: 'Un niño llamado Miguel',
          C: 'Una doctora',
          D: 'Un gato'
        },
        correctAnswer: 'B' as const,
        explanation: 'Miguel es el protagonista principal de esta historia.',
        hints: ['Look for the character mentioned most often'],
      },
    ],
  });

  // Create true/false questions
  activities.push({
    id: 'trueFalse_1',
    type: 'trueFalse' as const,
    title: 'True or False',
    instructions: 'Read each statement and decide if it is true or false.',
    difficulty: 'easy' as const,
    estimatedTime: 3,
    questions: [
      {
        id: 'tf_1',
        statement: 'Este capítulo está escrito en español.',
        correct: true,
        explanation: 'Sí, este es un libro de cuentos en español.',
      },
      {
        id: 'tf_2',
        statement: 'Los personajes hablan inglés en la historia.',
        correct: false,
        explanation: 'No, los personajes hablan español.',
      },
    ],
  });

  // Create matching activity
  if (chapterContent.length >= 4) {
    const matchingPairs = chapterContent.slice(0, 6).map((word, index) => ({
      id: `match_${index}`,
      spanish: word.text || `palabra${index}`,
      english: word.translation || `word${index}`,
    }));

    activities.push({
      id: 'matching_1',
      type: 'matching' as const,
      title: 'Match Spanish and English',
      instructions: 'Match the Spanish words with their English translations.',
      difficulty: 'medium' as const,
      estimatedTime: 4,
      pairs: matchingPairs,
      shufflePairs: true,
    });
  }


  return activities;
};

// Utility functions
export const getActivityDuration = (activities: Activity[]): number => {
  return activities.reduce((total, activity) => total + activity.estimatedTime, 0);
};

export const getActivityTypeIcon = (type: ActivityType): string => {
  const icons = {
    vocabulary: '📚',
    comprehension: '📖',
    trueFalse: '✅',
    matching: '🔗',
  };
  return icons[type];
};

export const getActivityTypeColor = (type: ActivityType): string => {
  const colors = {
    vocabulary: 'blue',
    comprehension: 'green',
    trueFalse: 'purple',
    matching: 'orange',
  };
  return colors[type];
};