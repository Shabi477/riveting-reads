import { Router } from 'express';
import { eq, and, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { savedWords, entitlements, translationCache } from '../db/schema';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import OpenAI from 'openai';

// Initialize OpenAI client
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const router = Router();

// POST /words/save - save a word for later review
router.post('/save', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { dictId, spanishWord, englishTranslation, bookId } = req.body;
    const userId = req.userId!;

    // Accept either legacy dictId format or new individual fields
    if ((!dictId && (!spanishWord || !englishTranslation)) || !bookId) {
      return res.status(400).json({ error: 'Either dictId or (spanishWord and englishTranslation) and bookId are required' });
    }

    // Extract spanish/english from dictId if new fields not provided (backwards compatibility)
    let finalSpanishWord = spanishWord;
    let finalEnglishTranslation = englishTranslation;
    let finalDictId = dictId;

    if (!spanishWord && dictId) {
      const parts = dictId.split('-');
      if (parts.length >= 2) {
        finalSpanishWord = parts[0];
        finalEnglishTranslation = parts.slice(1).join('-'); // Handle hyphens in translations
      }
    }

    if (!dictId && spanishWord && englishTranslation) {
      finalDictId = `${spanishWord}-${englishTranslation}`;
    }

    // Check if user has access to this book
    const userEntitlement = await db.select().from(entitlements).where(
      and(eq(entitlements.userId, userId), eq(entitlements.bookId, bookId))
    ).limit(1);

    if (userEntitlement.length === 0) {
      return res.status(403).json({ error: 'Access denied. You do not have access to this book.' });
    }

    // Check if word is already saved (use Spanish word as primary identifier)
    const existingWord = await db.select().from(savedWords).where(
      and(
        eq(savedWords.userId, userId),
        eq(savedWords.spanishWord, finalSpanishWord),
        eq(savedWords.bookId, bookId)
      )
    ).limit(1);

    if (existingWord.length > 0) {
      return res.status(200).json({ 
        message: 'Word already saved',
        word: existingWord[0]
      });
    }

    // Save the word with all required fields
    const newWord = await db.insert(savedWords).values({
      userId,
      dictId: finalDictId,
      spanishWord: finalSpanishWord,
      englishTranslation: finalEnglishTranslation,
      bookId,
      ease: 2, // Default ease level
      nextReviewAt: new Date(), // Available for immediate review
    }).returning();

    res.status(201).json({
      message: 'Word saved successfully',
      word: newWord[0],
    });
  } catch (error) {
    console.error('Save word error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /words/review - get words due for review
router.get('/review', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const now = new Date();

    // Get words due for review
    const wordsToReview = await db
      .select()
      .from(savedWords)
      .where(
        and(
          eq(savedWords.userId, userId),
          lte(savedWords.nextReviewAt, now)
        )
      )
      .orderBy(savedWords.nextReviewAt)
      .limit(20); // Limit to 20 words per review session

    res.json({
      words: wordsToReview,
      totalCount: wordsToReview.length,
    });
  } catch (error) {
    console.error('Get review words error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /words/review/:wordId - update word after review
router.post('/review/:wordId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { wordId } = req.params;
    const { ease } = req.body;
    const userId = req.userId!;

    if (ease === undefined || ease < 1 || ease > 5) {
      return res.status(400).json({ error: 'Ease must be between 1 and 5' });
    }

    // Check if word belongs to user
    const word = await db.select().from(savedWords).where(
      and(eq(savedWords.id, parseInt(wordId)), eq(savedWords.userId, userId))
    ).limit(1);

    if (word.length === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }

    // Calculate next review date based on ease (simple spaced repetition)
    const baseInterval = 1; // 1 day
    const intervals = [1, 1, 3, 7, 14]; // Days for ease levels 1-5
    const intervalDays = intervals[ease - 1] || 1;
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

    // Update the word
    const updatedWord = await db
      .update(savedWords)
      .set({
        ease,
        nextReviewAt,
      })
      .where(eq(savedWords.id, parseInt(wordId)))
      .returning();

    res.json({
      message: 'Word review updated successfully',
      word: updatedWord[0],
    });
  } catch (error) {
    console.error('Update word review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /words/translate/:word - get English translation for Spanish word (with caching)
router.get('/translate/:word', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { word } = req.params;
    const spanishWord = word.toLowerCase().trim();

    if (!spanishWord) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    // First check if translation exists in cache
    const cachedTranslation = await db
      .select()
      .from(translationCache)
      .where(eq(translationCache.spanishWord, spanishWord))
      .limit(1);

    if (cachedTranslation.length > 0) {
      // Update usage count for analytics
      await db
        .update(translationCache)
        .set({ 
          usageCount: sql`${translationCache.usageCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(translationCache.id, cachedTranslation[0].id));
      
      return res.json({
        spanish: spanishWord,
        english: cachedTranslation[0].englishTranslation,
        cached: true
      });
    }

    // If not in cache, use OpenAI to translate
    console.log(`🌍 Translating "${spanishWord}" using OpenAI...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using more efficient model for simple translations
      messages: [
        {
          role: "system",
          content: "You are a Spanish-English translation expert. Translate the given Spanish word to English. Provide only the most common, concise translation. Respond with JSON in this format: { 'english': 'translation' }"
        },
        {
          role: "user",
          content: `Translate this Spanish word to English: "${spanishWord}"`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 200
    });

    // Check if response has content before parsing
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('OpenAI response has no content:', response);
      throw new Error('OpenAI response is empty');
    }

    console.log('OpenAI raw response:', content);
    const result = JSON.parse(content);
    const englishTranslation = result.english;

    if (!englishTranslation) {
      console.error('No English translation found in response:', result);
      throw new Error('No translation found in OpenAI response');
    }

    // Save to cache for future use
    await db.insert(translationCache).values({
      spanishWord,
      englishTranslation,
      usageCount: 1
    });

    console.log(`✅ Translated "${spanishWord}" → "${englishTranslation}" and cached`);

    res.json({
      spanish: spanishWord,
      english: englishTranslation,
      cached: false
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Failed to translate word' });
  }
});

// GET /words/saved - get all saved words for user
router.get('/saved', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { bookId } = req.query;

    // Build query conditions
    const whereConditions = bookId 
      ? and(eq(savedWords.userId, userId), eq(savedWords.bookId, bookId as string))
      : eq(savedWords.userId, userId);

    const userSavedWords = await db
      .select()
      .from(savedWords)
      .where(whereConditions)
      .orderBy(savedWords.createdAt);


    res.json({
      words: userSavedWords,
      totalCount: userSavedWords.length,
    });
  } catch (error) {
    console.error('Get saved words error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;