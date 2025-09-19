import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { 
  books, 
  chapters, 
  entitlements, 
  chapterActivities, 
  activityProgress 
} from '../db/schema';
import { authMiddleware, AuthRequest } from '../middleware/auth';
// Helper function to create mock activities based on chapter content
function createMockActivities(chapterContent: any[]) {
  const activities = [];
  
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
      type: 'vocabulary',
      title: 'Vocabulary Practice',
      instructions: 'Review the vocabulary from this chapter. Click cards to flip them.',
      difficulty: 'easy',
      estimatedTime: 5,
      cards: vocabularyCards,
    });
  }

  // Create comprehension questions
  activities.push({
    id: 'comprehension_1',
    type: 'comprehension',
    title: 'Reading Comprehension',
    instructions: 'Answer the questions about the chapter you just read.',
    difficulty: 'medium',
    estimatedTime: 7,
    questions: [
      {
        id: 'comp_1',
        question: '¿Cuál es el tema principal del capítulo?',
        type: 'short',
        correctAnswers: ['historia', 'cuento', 'narración'],
        hints: ['Think about what the story is about'],
        maxWords: 10,
      },
      {
        id: 'comp_2',
        question: 'Describe los personajes principales en español.',
        type: 'paragraph',
        correctAnswers: ['personajes', 'protagonistas'],
        maxWords: 50,
      },
    ],
  });

  // Create true/false questions
  activities.push({
    id: 'trueFalse_1',
    type: 'trueFalse',
    title: 'True or False',
    instructions: 'Read each statement and decide if it is true or false.',
    difficulty: 'easy',
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
      type: 'matching',
      title: 'Match Spanish and English',
      instructions: 'Match the Spanish words with their English translations.',
      difficulty: 'medium',
      estimatedTime: 4,
      pairs: matchingPairs,
      shufflePairs: true,
    });
  }

  // Create writing activity
  activities.push({
    id: 'writing_1',
    type: 'writing',
    title: 'Creative Writing',
    instructions: 'Complete the writing exercises using vocabulary from the chapter.',
    difficulty: 'hard',
    estimatedTime: 10,
    prompts: [
      {
        id: 'write_1',
        prompt: 'Escribe una oración usando tres palabras del capítulo.',
        type: 'sentence',
        minWords: 5,
        maxWords: 15,
        keyWords: chapterContent.slice(0, 3).map(w => w.text).filter(Boolean),
      },
      {
        id: 'write_2',
        prompt: 'Escribe un párrafo corto sobre tu opinión del capítulo.',
        type: 'paragraph',
        minWords: 30,
        maxWords: 80,
        suggestions: ['Me gusta...', 'Pienso que...', 'En mi opinión...'],
      },
    ],
  });

  return activities;
}

const router = Router();

// GET /chapters/:bookId/activities/:chapterIndex - get activities for a chapter
router.get('/chapters/:bookId/activities/:chapterIndex', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const userId = req.userId!;
    const chapterIndexNum = parseInt(chapterIndex);

    if (isNaN(chapterIndexNum)) {
      return res.status(400).json({ error: 'Invalid chapter index' });
    }

    // Check if user has entitlement to this book
    const userEntitlement = await db.select().from(entitlements).where(
      and(eq(entitlements.userId, userId), eq(entitlements.bookId, bookId))
    ).limit(1);

    if (userEntitlement.length === 0) {
      return res.status(403).json({ error: 'Access denied. You do not have access to this book.' });
    }

    // Get the specific chapter by bookId and chapterIndex
    const chapterResult = await db.select().from(chapters).where(
      and(eq(chapters.bookId, bookId), eq(chapters.indexInBook, chapterIndexNum))
    ).limit(1);

    if (chapterResult.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = chapterResult[0];

    // Get existing activities for this chapter from database
    const existingActivities = await db.select().from(chapterActivities).where(
      and(eq(chapterActivities.chapterId, chapter.id), eq(chapterActivities.isActive, 1))
    ).orderBy(chapterActivities.sortOrder);

    // Get user's progress on activities for this chapter
    const userProgress = await db.select().from(activityProgress).where(
      and(
        eq(activityProgress.userId, userId),
        eq(activityProgress.bookId, bookId),
        eq(activityProgress.chapterId, chapter.id)
      )
    );

    let activitiesByType = {
      vocabulary: [],
      comprehension: [],
      trueFalse: [],
      matching: [],
      writing: []
    };

    if (existingActivities.length > 0) {
      // Use stored activities from database
      existingActivities.forEach(activity => {
        const activityData = {
          id: activity.id.toString(),
          type: activity.activityType,
          title: activity.title,
          instructions: activity.description || '',
          difficulty: 'medium',
          estimatedTime: 5,
          ...activity.activityData
        };

        if (activitiesByType[activity.activityType]) {
          activitiesByType[activity.activityType].push(activityData);
        }
      });
    } else {
      // Generate mock activities from chapter content
      try {
        // Try to fetch chapter content to generate activities
        let chapterContent = [];
        if (chapter.jsonUrl) {
          try {
            const response = await fetch(chapter.jsonUrl);
            if (response.ok) {
              const contentData = await response.json();
              chapterContent = contentData.content || [];
            }
          } catch (error) {
            console.log('Could not fetch chapter content, using mock data');
          }
        }

        // Generate mock activities using the helper function
        const mockActivities = createMockActivities(chapterContent.length > 0 ? chapterContent : [
          { text: 'Hola', translation: 'Hello' },
          { text: 'amigo', translation: 'friend' },
          { text: 'casa', translation: 'house' },
          { text: 'libro', translation: 'book' },
          { text: 'agua', translation: 'water' },
          { text: 'familia', translation: 'family' }
        ]);

        // Group activities by type
        mockActivities.forEach(activity => {
          if (activitiesByType[activity.type]) {
            activitiesByType[activity.type].push(activity);
          }
        });
      } catch (error) {
        console.error('Error generating activities:', error);
        return res.status(500).json({ error: 'Failed to generate activities' });
      }
    }

    res.json({
      bookId,
      chapterIndex: chapterIndexNum,
      chapterId: chapter.id,
      activitiesByType,
      userProgress,
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /chapters/:bookId/activities/:chapterIndex/progress - save activity progress
router.post('/chapters/:bookId/activities/:chapterIndex/progress', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const userId = req.userId!;
    const chapterIndexNum = parseInt(chapterIndex);
    const { activityType, activityId, completed, score, timeSpent, answers } = req.body;

    if (isNaN(chapterIndexNum)) {
      return res.status(400).json({ error: 'Invalid chapter index' });
    }

    if (!activityType || !activityId) {
      return res.status(400).json({ error: 'activityType and activityId are required' });
    }

    // Check if user has entitlement to this book
    const userEntitlement = await db.select().from(entitlements).where(
      and(eq(entitlements.userId, userId), eq(entitlements.bookId, bookId))
    ).limit(1);

    if (userEntitlement.length === 0) {
      return res.status(403).json({ error: 'Access denied. You do not have access to this book.' });
    }

    // Get the specific chapter
    const chapterResult = await db.select().from(chapters).where(
      and(eq(chapters.bookId, bookId), eq(chapters.indexInBook, chapterIndexNum))
    ).limit(1);

    if (chapterResult.length === 0) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapter = chapterResult[0];

    // Check if progress record already exists
    const existingProgress = await db.select().from(activityProgress).where(
      and(
        eq(activityProgress.userId, userId),
        eq(activityProgress.bookId, bookId),
        eq(activityProgress.chapterId, chapter.id),
        eq(activityProgress.activityType, activityType),
        eq(activityProgress.activityId, activityId)
      )
    ).limit(1);

    const progressData = {
      userId,
      bookId,
      chapterId: chapter.id,
      chapterIndex: chapterIndexNum,
      activityType,
      activityId,
      completed: completed ? 1 : 0,
      score: score || null,
      timeSpent: timeSpent || 0,
      answers: answers || {},
      lastAttemptAt: new Date(),
      completedAt: completed ? new Date() : null,
      updatedAt: new Date(),
    };

    let result;
    if (existingProgress.length > 0) {
      // Update existing progress
      result = await db.update(activityProgress)
        .set({
          ...progressData,
          attempts: existingProgress[0].attempts + 1,
        })
        .where(eq(activityProgress.id, existingProgress[0].id))
        .returning();
    } else {
      // Create new progress record
      result = await db.insert(activityProgress)
        .values({
          ...progressData,
          attempts: 1,
          createdAt: new Date(),
        })
        .returning();
    }

    res.json({
      message: 'Progress saved successfully',
      progress: result[0],
    });
  } catch (error) {
    console.error('Save activity progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;