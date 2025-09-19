import { Router } from 'express';
import { db } from '../db/index.js';
import { readingProgress, entitlements, chapters } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /progress - get user's reading progress for all books
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const userProgress = await db
      .select()
      .from(readingProgress)
      .where(eq(readingProgress.userId, userId))
      .orderBy(desc(readingProgress.lastReadAt));

    res.json({
      progress: userProgress,
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /progress/:bookId - get user's reading progress for a specific book
router.get('/:bookId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.userId!;

    // Check if user has entitlement to this book
    const userEntitlement = await db.select().from(entitlements).where(
      and(eq(entitlements.userId, userId), eq(entitlements.bookId, bookId))
    ).limit(1);

    if (userEntitlement.length === 0) {
      return res.status(403).json({ error: 'Access denied. You do not have access to this book.' });
    }

    const bookProgress = await db
      .select()
      .from(readingProgress)
      .where(
        and(
          eq(readingProgress.userId, userId),
          eq(readingProgress.bookId, bookId)
        )
      )
      .limit(1);

    res.json({
      progress: bookProgress.length > 0 ? bookProgress[0] : null,
    });
  } catch (error) {
    console.error('Get book progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /progress - save or update user's reading progress
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { bookId, chapterId, chapterIndex, audioPosition, isCompleted } = req.body;
    const userId = req.userId!;

    if (!bookId || !chapterId || chapterIndex === undefined) {
      return res.status(400).json({ 
        error: 'bookId, chapterId, and chapterIndex are required' 
      });
    }

    // Check if user has access to this book
    const userEntitlement = await db.select().from(entitlements).where(
      and(eq(entitlements.userId, userId), eq(entitlements.bookId, bookId))
    ).limit(1);

    if (userEntitlement.length === 0) {
      return res.status(403).json({ error: 'Access denied. You do not have access to this book.' });
    }

    // Verify that the chapter belongs to this book and chapterIndex matches
    const chapter = await db.select().from(chapters).where(
      and(
        eq(chapters.id, chapterId),
        eq(chapters.bookId, bookId),
        eq(chapters.indexInBook, parseInt(chapterIndex))
      )
    ).limit(1);

    if (chapter.length === 0) {
      return res.status(400).json({ error: 'Chapter not found or does not belong to this book.' });
    }

    // Check if progress record already exists for this user and book
    const existingProgress = await db.select().from(readingProgress).where(
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.bookId, bookId)
      )
    ).limit(1);

    const progressData = {
      chapterId,
      chapterIndex: parseInt(chapterIndex),
      audioPosition: parseInt(audioPosition) || 0,
      isCompleted: isCompleted ? 1 : 0,
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    let savedProgress;

    if (existingProgress.length > 0) {
      // Update existing progress
      savedProgress = await db
        .update(readingProgress)
        .set(progressData)
        .where(
          and(
            eq(readingProgress.userId, userId),
            eq(readingProgress.bookId, bookId)
          )
        )
        .returning();
    } else {
      // Create new progress record
      savedProgress = await db.insert(readingProgress).values({
        userId,
        bookId,
        ...progressData,
      }).returning();
    }

    res.status(200).json({
      message: 'Progress saved successfully',
      progress: savedProgress[0],
    });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /progress/:bookId - reset progress for a book
router.delete('/:bookId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.userId!;

    await db.delete(readingProgress).where(
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.bookId, bookId)
      )
    );

    res.json({
      message: 'Progress reset successfully',
    });
  } catch (error) {
    console.error('Delete progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;