import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import { books, chapters, entitlements, accessCodes } from '../db/schema';
import { authMiddleware, AuthRequest } from '../middleware/auth';

// Generate SHA256 digest for code lookup
function generateCodeDigest(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

const router = Router();

// Rate limiting for redeem endpoint to prevent brute force code attempts
const redeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Allow 10 attempts per IP per window
  message: { error: 'Too many code redemption attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IPv6-safe IP generator combined with user ID if authenticated
    const userId = (req as AuthRequest).userId ? `user-${(req as AuthRequest).userId}` : 'anonymous';
    return `${ipKeyGenerator(req)}:${userId}`;
  },
});

// POST /redeem - redeem access code for a book
router.post('/redeem', redeemLimiter, authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code, bookId } = req.body;
    const userId = req.userId!;

    if (!code || !bookId) {
      return res.status(400).json({ error: 'Code and bookId are required' });
    }

    // Check if book exists and code matches
    const book = await db.select().from(books).where(
      and(eq(books.id, bookId), eq(books.kdpCode, code))
    ).limit(1);

    if (book.length === 0) {
      return res.status(400).json({ error: 'Invalid access code or book not found' });
    }

    // Check if user already has entitlement
    const existingEntitlement = await db.select().from(entitlements).where(
      and(eq(entitlements.userId, userId), eq(entitlements.bookId, bookId))
    ).limit(1);

    if (existingEntitlement.length > 0) {
      return res.status(200).json({ 
        message: 'Book already unlocked', 
        book: {
          id: book[0].id,
          title: book[0].title,
          createdAt: book[0].createdAt,
        }
      });
    }

    // Create entitlement
    await db.insert(entitlements).values({
      userId,
      bookId,
    });

    res.status(201).json({
      message: 'Book successfully unlocked',
      book: {
        id: book[0].id,
        title: book[0].title,
        createdAt: book[0].createdAt,
      },
    });
  } catch (error) {
    console.error('Redeem error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /redeem-access-code - redeem admin-generated access code for a book
router.post('/redeem-access-code', redeemLimiter, authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const userId = req.userId!;

    if (!code) {
      return res.status(400).json({ error: 'Access code is required' });
    }

    // Generate digest for O(1) lookup instead of brute force bcrypt comparison
    const codeDigest = generateCodeDigest(code);

    // Use database transaction with proper locking to prevent race conditions
    const result = await db.transaction(async (tx) => {
      // Find access code using digest with SELECT ... FOR UPDATE to prevent race conditions
      const accessCodeResult = await tx
        .select()
        .from(accessCodes)
        .where(and(
          eq(accessCodes.codeDigest, codeDigest),
          eq(accessCodes.status, 'unused')
        ))
        .limit(1);
        // Note: FOR UPDATE would be ideal here but Drizzle doesn't have direct support
        // The unique constraint on codeDigest provides some protection

      if (accessCodeResult.length === 0) {
        throw new Error('INVALID_CODE');
      }

      const matchingCode = accessCodeResult[0];

      // Verify the code matches using bcrypt (defense in depth)
      const isValidCode = await bcrypt.compare(code, matchingCode.codeHash);
      if (!isValidCode) {
        throw new Error('INVALID_CODE');
      }

      // Check if code is expired
      if (matchingCode.expiresAt && new Date() > matchingCode.expiresAt) {
        throw new Error('EXPIRED_CODE');
      }

      // Get book details
      const bookResult = await tx.select().from(books).where(eq(books.id, matchingCode.bookId)).limit(1);
      if (bookResult.length === 0) {
        throw new Error('BOOK_NOT_FOUND');
      }
      const book = bookResult[0];

      // Check if user already has entitlement
      const existingEntitlement = await tx.select().from(entitlements).where(
        and(eq(entitlements.userId, userId), eq(entitlements.bookId, matchingCode.bookId))
      ).limit(1);

      if (existingEntitlement.length > 0) {
        return {
          alreadyUnlocked: true,
          book: {
            id: book.id,
            title: book.title,
            createdAt: book.createdAt,
          }
        };
      }

      // Mark access code as redeemed FIRST to prevent double redemption
      const updateResult = await tx.update(accessCodes)
        .set({
          status: 'redeemed',
          redeemedByUserId: userId,
          redeemedAt: new Date(),
        })
        .where(and(
          eq(accessCodes.id, matchingCode.id),
          eq(accessCodes.status, 'unused') // Additional safety check
        ))
        .returning();

      if (updateResult.length === 0) {
        // Code was already redeemed by another transaction
        throw new Error('CODE_ALREADY_USED');
      }

      // Create entitlement
      await tx.insert(entitlements).values({
        userId,
        bookId: matchingCode.bookId,
      });

      return {
        alreadyUnlocked: false,
        book: {
          id: book.id,
          title: book.title,
          createdAt: book.createdAt,
        }
      };
    });

    if (result.alreadyUnlocked) {
      return res.status(200).json({ 
        message: 'Book already unlocked', 
        book: result.book
      });
    }

    res.status(201).json({
      message: 'Book successfully unlocked',
      book: result.book,
    });
  } catch (error: any) {
    console.error('Redeem access code error:', error);
    
    if (error.message === 'INVALID_CODE') {
      return res.status(400).json({ error: 'Invalid access code' });
    }
    if (error.message === 'EXPIRED_CODE') {
      return res.status(400).json({ error: 'Access code has expired' });
    }
    if (error.message === 'BOOK_NOT_FOUND') {
      return res.status(400).json({ error: 'Book not found' });
    }
    if (error.message === 'CODE_ALREADY_USED') {
      return res.status(400).json({ error: 'Access code has already been used' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /books - get books user is entitled to
router.get('/books', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Get books with entitlements for this user
    const userBooks = await db
      .select({
        id: books.id,
        title: books.title,
        coverImageUrl: books.coverImageUrl,
        createdAt: books.createdAt,
        unlockedAt: entitlements.createdAt,
      })
      .from(books)
      .innerJoin(entitlements, eq(books.id, entitlements.bookId))
      .where(eq(entitlements.userId, userId))
      .orderBy(entitlements.createdAt);

    res.json({
      books: userBooks,
    });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /chapters/:bookId - get chapters for a book user has access to
router.get('/chapters/:bookId', authMiddleware, async (req: AuthRequest, res) => {
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

    // Get chapters for this book
    const bookChapters = await db
      .select({
        id: chapters.id,
        title: chapters.title,
        indexInBook: chapters.indexInBook,
        audioUrl: chapters.audioUrl,
        jsonUrl: chapters.jsonUrl,
        elevenLabsTimingData: chapters.elevenLabsTimingData, // Include ElevenLabs timing data for precise word highlighting
        createdAt: chapters.createdAt,
      })
      .from(chapters)
      .where(eq(chapters.bookId, bookId))
      .orderBy(chapters.indexInBook);

    res.json({
      bookId,
      chapters: bookChapters,
    });
  } catch (error) {
    console.error('Get chapters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;