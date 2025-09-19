import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { books, chapters, accessCodes, adminActions, users, bookSources, translationCache, chapterActivities } from '../db/schema.js';
import { requireAdmin } from '../middleware/admin.js';
import { validateBookId, uploadWordDocument, validateUploadedDocxContent, handleUploadErrors, cleanupUploadedFile, getSecureFileUrl } from '../middleware/upload.js';
import { eq, sql, desc, count, inArray } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { ElevenLabsService } from '../services/elevenLabsService.js';
import OpenAI from 'openai';
import { ObjectStorageService, ObjectNotFoundError } from '../objectStorage.js';

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Apply admin middleware to all routes
router.use(requireAdmin);

interface AdminRequest extends express.Request {
  adminId?: number;
  userRole?: string;
  validatedBookId?: string;
}

// Log admin action helper
async function logAdminAction(
  adminId: number,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: any
) {
  try {
    await db.insert(adminActions).values({
      adminId,
      action,
      resourceType,
      resourceId,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

// Generate cryptographically secure access code with proper entropy
function generateSecureAccessCode(prefix: string, bookId: string): string {
  // Generate 16 bytes of random data (128 bits) for sufficient entropy
  const randomBytes = crypto.randomBytes(16);
  // Convert to base32-like encoding for readability (avoiding 0, O, I, L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let result = '';
  
  // Convert random bytes to base32-like characters (5 bits per character)
  // This gives us 128 bits / 5 = 25.6, so we'll use 25 characters
  for (let i = 0; i < Math.min(randomBytes.length, 16); i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  // Ensure we have at least 16 characters in the random segment (80+ bits entropy)
  if (result.length < 16) {
    const additionalBytes = crypto.randomBytes(16 - result.length);
    for (let i = 0; i < additionalBytes.length; i++) {
      result += chars[additionalBytes[i] % chars.length];
    }
  }
  
  // Format: PREFIX-BOOKID-RANDOMSEGMENT
  const separator = prefix || bookId ? '-' : '';
  return `${prefix}${prefix ? '-' : ''}${bookId.toUpperCase()}${separator}${result}`;
}

// Generate SHA256 digest for deterministic uniqueness checking
function generateCodeDigest(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// Extract unique Spanish words from content text
function extractUniqueWords(content: string): string[] {
  // Use Unicode-preserving tokenizer to maintain Spanish diacritics
  const matches = [...content.normalize('NFC').matchAll(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/gu)];
  const words = matches
    .map(m => m[0].toLowerCase().trim())
    .filter(word => word.length > 1) // Filter out single letters
    .filter(word => /[a-záéíóúñü]/.test(word)); // Only words with Spanish characters
  
  // Return unique words
  return [...new Set(words)];
}

// Batch translate words and store in translation cache
async function preTranslateWords(words: string[]): Promise<void> {
  if (words.length === 0) return;

  console.log(`🌍 Pre-translating ${words.length} unique words...`);

  try {
    // Check which words are already translated using proper Drizzle method
    const existingTranslations = await db
      .select()
      .from(translationCache)
      .where(inArray(translationCache.spanishWord, words));

    const existingWords = new Set(existingTranslations.map(t => t.spanishWord));
    const wordsToTranslate = words.filter(word => !existingWords.has(word));

    if (wordsToTranslate.length === 0) {
      console.log('✅ All words already translated');
      return;
    }

    console.log(`🔄 Translating ${wordsToTranslate.length} new words using OpenAI...`);

    // Batch translate words (doing them in chunks of 20 to avoid token limits)
    const chunkSize = 20;
    for (let i = 0; i < wordsToTranslate.length; i += chunkSize) {
      const chunk = wordsToTranslate.slice(i, i + chunkSize);
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Use valid OpenAI model
            messages: [
              {
                role: "system",
                content: "You are a Spanish-English translation expert. Translate the given Spanish words to English. Provide only the most common, concise translation for each. Respond with JSON in this format: { 'translations': [{ 'spanish': 'word', 'english': 'translation' }, ...] }"
              },
              {
                role: "user",
                content: `Translate these Spanish words to English: ${chunk.join(', ')}`
              }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 500
          });

          const result = JSON.parse(response.choices[0].message.content!);
          const translations = result.translations || [];

          // Insert translations into cache with conflict handling
          const translationsToInsert = translations.map((t: any) => ({
            spanishWord: t.spanish?.toLowerCase()?.trim(),
            englishTranslation: t.english?.trim(),
            usageCount: 1
          })).filter((t: any) => t.spanishWord && t.englishTranslation);

          if (translationsToInsert.length > 0) {
            await db.insert(translationCache)
              .values(translationsToInsert)
              .onConflictDoNothing({ target: translationCache.spanishWord });
            console.log(`✅ Cached ${translationsToInsert.length} translations`);
          }
          
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;
          if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
            // Rate limit or server error - retry with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
            console.log(`Rate limit/server error, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error; // Other errors, don't retry
          }
        }
      }

      // Small delay to avoid hitting rate limits
      if (i + chunkSize < wordsToTranslate.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`🎉 Pre-translation complete! ${wordsToTranslate.length} new words cached`);
  } catch (error) {
    console.error('Error in pre-translation:', error);
    // Don't throw error - we don't want translation failure to break chapter updates
  }
}

// Generate access code with proper collision handling using SHA256 digest
async function generateUniqueAccessCode(
  prefix: string, 
  bookId: string, 
  maxRetries: number = 10
): Promise<{ code: string; codeHash: string; codeDigest: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateSecureAccessCode(prefix, bookId);
    const codeDigest = generateCodeDigest(code);
    
    // Check for collision using deterministic digest
    const existing = await db.select().from(accessCodes).where(eq(accessCodes.codeDigest, codeDigest)).limit(1);
    if (existing.length === 0) {
      // No collision, generate bcrypt hash for storage
      const codeHash = await bcrypt.hash(code, 12);
      return { code, codeHash, codeDigest };
    }
    
    // Collision detected, try again
    console.warn(`Access code collision detected on attempt ${attempt + 1}, retrying...`);
  }
  
  throw new Error('Failed to generate unique access code after multiple attempts');
}

// Book Management Routes

// GET /admin/books - List all books
router.get('/books', async (req: AdminRequest, res) => {
  try {
    const allBooks = await db
      .select({
        id: books.id,
        title: books.title,
        kdpCode: books.kdpCode,
        coverImageUrl: books.coverImageUrl,
        createdAt: books.createdAt,
        chapterCount: sql<number>`cast(count(${chapters.id}) as int)`,
      })
      .from(books)
      .leftJoin(chapters, eq(books.id, chapters.bookId))
      .groupBy(books.id, books.title, books.kdpCode, books.coverImageUrl, books.createdAt)
      .orderBy(desc(books.createdAt));

    res.json({ books: allBooks });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ message: 'Failed to fetch books' });
  }
});

// POST /admin/books - Create new book
router.post('/books', async (req: AdminRequest, res) => {
  try {
    const { id, title, kdpCode, coverImageUrl } = req.body;

    if (!id || !title) {
      return res.status(400).json({ message: 'Book ID and title are required' });
    }

    const newBook = await db.insert(books).values({
      id,
      title,
      kdpCode: kdpCode || null,
      coverImageUrl: coverImageUrl || null,
    }).returning();

    await logAdminAction(req.adminId!, 'create_book', 'book', id, { title, kdpCode });

    res.status(201).json({ message: 'Book created successfully', book: newBook[0] });
  } catch (error: any) {
    console.error('Error creating book:', error);
    
    if (error.code === '23505') { // Unique violation
      if (error.constraint?.includes('pkey')) {
        return res.status(400).json({ message: 'Book ID already exists' });
      }
      if (error.constraint?.includes('kdp_code')) {
        return res.status(400).json({ message: 'KDP code already exists' });
      }
    }
    
    res.status(500).json({ message: 'Failed to create book' });
  }
});

// GET /admin/books/:id - Get single book
router.get('/books/:id', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    const book = await db
      .select()
      .from(books)
      .where(eq(books.id, id))
      .limit(1);

    if (book.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.json(book[0]);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ message: 'Failed to fetch book' });
  }
});

// PUT /admin/books/:id - Update book
router.put('/books/:id', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const { title, kdpCode, coverImageUrl } = req.body;


    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const updatedBook = await db.update(books)
      .set({
        title,
        kdpCode: kdpCode || null,
        coverImageUrl: coverImageUrl || null,
      })
      .where(eq(books.id, id))
      .returning();

    if (updatedBook.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    await logAdminAction(req.adminId!, 'update_book', 'book', id, { title, kdpCode, coverImageUrl });

    res.json({ message: 'Book updated successfully', book: updatedBook[0] });
  } catch (error: any) {
    console.error('Error updating book:', error);
    
    if (error.code === '23505' && error.constraint?.includes('kdp_code')) {
      return res.status(400).json({ message: 'KDP code already exists' });
    }
    
    res.status(500).json({ message: 'Failed to update book' });
  }
});

// DELETE /admin/books/:id - Delete book
router.delete('/books/:id', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    const deletedBook = await db.delete(books).where(eq(books.id, id)).returning();

    if (deletedBook.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    await logAdminAction(req.adminId!, 'delete_book', 'book', id, { title: deletedBook[0].title });

    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ message: 'Failed to delete book' });
  }
});

// Document Upload Routes

// POST /admin/books/:bookId/upload - Upload Word document for a book
router.post('/books/:bookId/upload', validateBookId, uploadWordDocument, validateUploadedDocxContent, async (req: AdminRequest, res: express.Response) => {
  let uploadedFilePath: string | undefined;
  
  try {
    // Use the validated bookId from the middleware
    const bookId = req.validatedBookId || req.params.bookId;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No file uploaded. Please select a .docx file.',
        error: 'NO_FILE'
      });
    }

    uploadedFilePath = req.file.path;
    const fileUrl = getSecureFileUrl(bookId, req.file.filename);

    // Create book source record in database
    const newBookSource = await db.insert(bookSources).values({
      bookId,
      originalFileName: req.file.originalname,
      fileUrl,
      fileSize: req.file.size,
      uploadedByAdminId: req.adminId!,
      status: 'uploaded',
    }).returning();

    await logAdminAction(req.adminId!, 'upload_document', 'book_source', newBookSource[0].id.toString(), {
      bookId,
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
    });

    res.status(201).json({
      message: 'Document uploaded successfully',
      bookSource: {
        id: newBookSource[0].id,
        bookId,
        originalFileName: req.file.originalname,
        fileSize: req.file.size,
        status: newBookSource[0].status,
        createdAt: newBookSource[0].createdAt,
      }
    });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    
    // Cleanup uploaded file on error
    if (uploadedFilePath) {
      cleanupUploadedFile(uploadedFilePath);
    }
    
    res.status(500).json({ message: 'Failed to upload document' });
  }
}, handleUploadErrors);

// GET /admin/books/:bookId/sources - List uploaded documents for a book
router.get('/books/:bookId/sources', async (req: AdminRequest, res) => {
  try {
    const { bookId } = req.params;

    // Check if book exists
    const book = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (book.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const sources = await db
      .select({
        id: bookSources.id,
        originalFileName: bookSources.originalFileName,
        fileSize: bookSources.fileSize,
        status: bookSources.status,
        createdAt: bookSources.createdAt,
        updatedAt: bookSources.updatedAt,
        uploadedByAdmin: users.email,
      })
      .from(bookSources)
      .leftJoin(users, eq(bookSources.uploadedByAdminId, users.id))
      .where(eq(bookSources.bookId, bookId))
      .orderBy(desc(bookSources.createdAt));

    res.json({ bookId, sources });
  } catch (error) {
    console.error('Error fetching book sources:', error);
    res.status(500).json({ message: 'Failed to fetch book sources' });
  }
});

// DELETE /admin/book-sources/:id - Delete uploaded document
router.delete('/book-sources/:id', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    // Get book source details before deletion
    const bookSource = await db.select().from(bookSources).where(eq(bookSources.id, parseInt(id))).limit(1);
    
    if (bookSource.length === 0) {
      return res.status(404).json({ message: 'Book source not found' });
    }

    // Delete from database
    await db.delete(bookSources).where(eq(bookSources.id, parseInt(id)));

    // Delete physical file
    const filePath = path.join(process.cwd(), bookSource[0].fileUrl);
    cleanupUploadedFile(filePath);

    await logAdminAction(req.adminId!, 'delete_document', 'book_source', id, {
      originalFileName: bookSource[0].originalFileName,
      bookId: bookSource[0].bookId,
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting book source:', error);
    res.status(500).json({ message: 'Failed to delete document' });
  }
});

// PUT /admin/book-sources/:id/status - Update processing status
router.put('/book-sources/:id/status', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['uploaded', 'processing', 'processed', 'failed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Allowed values: ' + allowedStatuses.join(', ')
      });
    }

    const updatedSource = await db.update(bookSources)
      .set({ 
        status,
        updatedAt: sql`now()`,
      })
      .where(eq(bookSources.id, parseInt(id)))
      .returning();

    if (updatedSource.length === 0) {
      return res.status(404).json({ message: 'Book source not found' });
    }

    await logAdminAction(req.adminId!, 'update_document_status', 'book_source', id, {
      newStatus: status,
      originalFileName: updatedSource[0].originalFileName,
    });

    res.json({ 
      message: 'Document status updated successfully', 
      bookSource: updatedSource[0] 
    });
  } catch (error) {
    console.error('Error updating book source status:', error);
    res.status(500).json({ message: 'Failed to update document status' });
  }
});

// Chapter Management Routes

// GET /admin/books/:bookId/chapters - List chapters for a book
router.get('/books/:bookId/chapters', async (req: AdminRequest, res) => {
  try {
    const { bookId } = req.params;

    const bookChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.bookId, bookId))
      .orderBy(chapters.indexInBook);

    res.json({ bookId, chapters: bookChapters });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ message: 'Failed to fetch chapters' });
  }
});

// POST /admin/books/:bookId/chapters - Create new chapter
router.post('/books/:bookId/chapters', async (req: AdminRequest, res) => {
  try {
    const { bookId } = req.params;
    const { id, title, indexInBook, audioUrl, content } = req.body;

    if (!title || indexInBook === undefined || !content) {
      return res.status(400).json({ 
        message: 'Title, index, and content are required' 
      });
    }

    // Generate ID if not provided
    const chapterId = id || `chapter_${bookId}_${indexInBook}_${Date.now()}`;

    // Check if book exists
    const book = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (book.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Generate JSON structure with correct format for frontend editing
    // Split content by double line breaks to preserve paragraphs (handle Windows/Unix line endings)
    const paragraphs = content.split(/\r?\n\s*\r?\n/).filter((p: string) => p.trim().length > 0);
    
    const allSentences: any[] = [];
    const allWords: any[] = [];
    let sentenceIndex = 0;
    let wordIndex = 0;

    const processedParagraphs = paragraphs.map((paragraph: string, pIndex: number) => {
      // Split each paragraph into sentences while preserving line breaks within paragraphs  
      const paragraphText = paragraph.trim();
      const sentences = paragraphText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
      
      const paragraphSentences = sentences.map((sentence: string) => {
        const sentenceData = {
          id: sentenceIndex++,
          text: sentence.trim()
        };
        allSentences.push(sentenceData);
        return sentenceData;
      });

      // Process words for the entire paragraph, preserving original formatting
      const words = paragraphText.split(/\s+/).map((word: string) => {
        const currentIndex = wordIndex;
        const wordData = {
          id: wordIndex++,
          text: word.replace(/[^\w\s]/g, ''), // Remove punctuation for word lookup
          original: word,
          start_time: currentIndex * 0.5, // Rough timing estimate
          end_time: (currentIndex + 1) * 0.5
        };
        allWords.push(wordData);
        return wordData;
      });

      return {
        id: pIndex,
        text: paragraphText,
        sentences: paragraphSentences,
        words
      };
    });

    const chapterJson = {
      title,
      content: {
        paragraphs: processedParagraphs,
        sentences: allSentences // Keep flat structure for backward compatibility
      },
      words: allWords
    };

    // Store JSON as base64 data URL with explicit UTF-8 charset
    const jsonString = JSON.stringify(chapterJson);
    const base64Content = Buffer.from(jsonString, 'utf8').toString('base64');
    const jsonUrl = `data:application/json;charset=utf-8;base64,${base64Content}`;

    // Generate audio using ElevenLabs if no audioUrl provided
    let finalAudioUrl = audioUrl || null;
    let timingData = null;

    if (!audioUrl && content) {
      try {
        console.log(`Generating ElevenLabs audio for chapter ${chapterId}...`);
        const elevenLabs = new ElevenLabsService();
        const audioResult = await elevenLabs.generateAudioWithTiming(content, chapterId);
        
        finalAudioUrl = audioResult.audioUrl;
        timingData = audioResult.timingData;
        
        console.log(`Audio generated successfully: ${finalAudioUrl}`);
      } catch (audioError) {
        console.error('ElevenLabs audio generation failed:', audioError);
        // Continue without audio - admin can manually generate later
        console.log('Continuing without audio generation');
      }
    }

    const newChapter = await db.insert(chapters).values({
      id: chapterId,
      bookId,
      title,
      indexInBook: parseInt(indexInBook),
      audioUrl: finalAudioUrl,
      jsonUrl,
      elevenLabsTimingData: timingData,
    }).returning();

    await logAdminAction(req.adminId!, 'create_chapter', 'chapter', chapterId, { 
      bookId, title, indexInBook 
    });

    res.status(201).json({ message: 'Chapter created successfully', chapter: newChapter[0] });
  } catch (error: any) {
    console.error('Error creating chapter:', error);
    
    if (error.code === '23505') {
      if (error.constraint?.includes('pkey')) {
        return res.status(400).json({ message: 'Chapter ID already exists' });
      }
      if (error.constraint?.includes('book_id_index')) {
        return res.status(400).json({ message: 'Chapter index already exists for this book' });
      }
    }
    
    res.status(500).json({ message: 'Failed to create chapter' });
  }
});

// PUT /admin/chapters/:id - Update chapter
router.put('/chapters/:id', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const { title, indexInBook, audioUrl, content } = req.body;
    
    if (!title || indexInBook === undefined || !content) {
      return res.status(400).json({ 
        message: 'Title, index, and content are required' 
      });
    }

    // Generate updated JSON structure with correct format for frontend editing
    // Split content by double line breaks to preserve paragraphs (handle Windows/Unix line endings)
    const paragraphs = content.split(/\r?\n\s*\r?\n/).filter((p: string) => p.trim().length > 0);
    
    const allSentences: any[] = [];
    const allWords: any[] = [];
    let sentenceIndex = 0;
    let wordIndex = 0;

    const processedParagraphs = paragraphs.map((paragraph: string, pIndex: number) => {
      // Split each paragraph into sentences while preserving line breaks within paragraphs  
      const paragraphText = paragraph.trim();
      const sentences = paragraphText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
      
      const paragraphSentences = sentences.map((sentence: string) => {
        const sentenceData = {
          id: sentenceIndex++,
          text: sentence.trim()
        };
        allSentences.push(sentenceData);
        return sentenceData;
      });

      // Process words for the entire paragraph, preserving original formatting
      const words = paragraphText.split(/\s+/).map((word: string) => {
        const currentIndex = wordIndex;
        const wordData = {
          id: wordIndex++,
          text: word.replace(/[^\w\s]/g, ''), // Remove punctuation for word lookup
          original: word,
          start_time: currentIndex * 0.5, // Rough timing estimate
          end_time: (currentIndex + 1) * 0.5
        };
        allWords.push(wordData);
        return wordData;
      });

      return {
        id: pIndex,
        text: paragraphText,
        sentences: paragraphSentences,
        words
      };
    });

    const chapterJson = {
      title,
      content: {
        paragraphs: processedParagraphs,
        sentences: allSentences // Keep flat structure for backward compatibility
      },
      words: allWords
    };

    // Get existing chapter to find book ID
    const existingChapter = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1);
    if (existingChapter.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    const bookId = existingChapter[0].bookId;

    // Store JSON as base64 data URL with explicit UTF-8 charset
    const jsonString = JSON.stringify(chapterJson);
    const base64Content = Buffer.from(jsonString, 'utf8').toString('base64');
    const jsonUrl = `data:application/json;charset=utf-8;base64,${base64Content}`;

    // Pre-translate all Spanish words in the content SYNCHRONOUSLY
    console.log('🔤 Extracting and pre-translating words from chapter content...');
    const uniqueWords = extractUniqueWords(content);
    if (uniqueWords.length > 0) {
      try {
        // Wait for pre-translation to complete before responding
        await preTranslateWords(uniqueWords);
        console.log(`✅ Successfully pre-translated ${uniqueWords.length} words - hover translations ready!`);
      } catch (error) {
        console.error('Pre-translation failed:', error);
        // Continue with chapter update even if translation fails
      }
    }

    // Generate audio using ElevenLabs if no audioUrl provided
    let finalAudioUrl = audioUrl || null;
    let timingData = null;

    if (!audioUrl && content) {
      try {
        console.log(`Regenerating ElevenLabs audio for chapter ${id}...`);
        const elevenLabs = new ElevenLabsService();
        const audioResult = await elevenLabs.generateAudioWithTiming(content, id);
        
        finalAudioUrl = audioResult.audioUrl;
        timingData = audioResult.timingData;
        
        console.log(`Audio regenerated successfully: ${finalAudioUrl}`);
      } catch (audioError) {
        console.error('ElevenLabs audio regeneration failed:', audioError);
        // Continue without updating audio
        console.log('Continuing without audio regeneration');
      }
    }

    const updatedChapter = await db.update(chapters)
      .set({
        title,
        indexInBook: parseInt(indexInBook),
        audioUrl: finalAudioUrl,
        jsonUrl,
        elevenLabsTimingData: timingData,
      })
      .where(eq(chapters.id, id))
      .returning();

    if (updatedChapter.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    await logAdminAction(req.adminId!, 'update_chapter', 'chapter', id, { 
      title, indexInBook, audioUrl, jsonUrl 
    });

    res.json({ message: 'Chapter updated successfully', chapter: updatedChapter[0] });
  } catch (error: any) {
    console.error('Error updating chapter:', error);
    
    if (error.code === '23505' && error.constraint?.includes('book_id_index')) {
      return res.status(400).json({ message: 'Chapter index already exists for this book' });
    }
    
    res.status(500).json({ message: 'Failed to update chapter' });
  }
});

// GET /admin/chapters/:id - Get single chapter
router.get('/chapters/:id', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    const chapter = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, id))
      .limit(1);

    if (chapter.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    res.json(chapter[0]);
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ message: 'Failed to fetch chapter' });
  }
});

// DELETE /admin/chapters/:id - Delete chapter
router.delete('/chapters/:id', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    const deletedChapter = await db.delete(chapters).where(eq(chapters.id, id)).returning();

    if (deletedChapter.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    await logAdminAction(req.adminId!, 'delete_chapter', 'chapter', id, { 
      title: deletedChapter[0].title 
    });

    res.json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({ message: 'Failed to delete chapter' });
  }
});

// Access Code Management Routes

// POST /admin/books/:bookId/access-codes - Generate access codes
router.post('/books/:bookId/access-codes', async (req: AdminRequest, res) => {
  try {
    const { bookId } = req.params;
    const { count = 1, prefix = '', expiresAt } = req.body;

    if (count < 1 || count > 100) {
      return res.status(400).json({ message: 'Count must be between 1 and 100' });
    }

    // Check if book exists
    const book = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (book.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const generatedCodes = [];
    const SALT_ROUNDS = 12;

    for (let i = 0; i < count; i++) {
      try {
        // Generate cryptographically secure access code with proper collision handling
        const { code, codeHash, codeDigest } = await generateUniqueAccessCode(prefix, bookId);

        const newAccessCode = await db.insert(accessCodes).values({
          codeHash,
          codeDigest,
          bookId,
          generatedByAdminId: req.adminId!,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        }).returning();

        generatedCodes.push({
          id: newAccessCode[0].id,
          code, // Only shown at generation time
          bookId,
          expiresAt: newAccessCode[0].expiresAt,
          createdAt: newAccessCode[0].createdAt,
        });
      } catch (error) {
        console.error(`Failed to generate access code ${i + 1}:`, error);
        return res.status(500).json({ message: 'Failed to generate all access codes' });
      }
    }

    await logAdminAction(req.adminId!, 'generate_codes', 'access_code', bookId, { 
      count, prefix, expiresAt 
    });

    res.status(201).json({ 
      message: `${count} access code(s) generated successfully`,
      codes: generatedCodes 
    });
  } catch (error) {
    console.error('Error generating access codes:', error);
    res.status(500).json({ message: 'Failed to generate access codes' });
  }
});

// GET /admin/books/:bookId/access-codes - List access codes for a book
router.get('/books/:bookId/access-codes', async (req: AdminRequest, res) => {
  try {
    const { bookId } = req.params;
    const { status } = req.query;

    let whereConditions = eq(accessCodes.bookId, bookId);
    
    if (status && ['unused', 'redeemed', 'revoked'].includes(status as string)) {
      whereConditions = sql`${accessCodes.bookId} = ${bookId} AND ${accessCodes.status} = ${status}`;
    }

    const codes = await db
      .select({
        id: accessCodes.id,
        bookId: accessCodes.bookId,
        status: accessCodes.status,
        redeemedByUserId: accessCodes.redeemedByUserId,
        redeemedAt: accessCodes.redeemedAt,
        expiresAt: accessCodes.expiresAt,
        createdAt: accessCodes.createdAt,
        redeemedByEmail: users.email,
      })
      .from(accessCodes)
      .leftJoin(users, eq(accessCodes.redeemedByUserId, users.id))
      .where(whereConditions)
      .orderBy(desc(accessCodes.createdAt));


    res.json({ bookId, codes });
  } catch (error) {
    console.error('Error fetching access codes:', error);
    res.status(500).json({ message: 'Failed to fetch access codes' });
  }
});

// PUT /admin/access-codes/:id/revoke - Revoke a specific access code
router.put('/access-codes/:id/revoke', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    const updatedCode = await db.update(accessCodes)
      .set({ status: 'revoked' })
      .where(eq(accessCodes.id, parseInt(id)))
      .returning();

    if (updatedCode.length === 0) {
      return res.status(404).json({ message: 'Access code not found' });
    }

    await logAdminAction(req.adminId!, 'revoke_code', 'access_code', id);

    res.json({ message: 'Access code revoked successfully', code: updatedCode[0] });
  } catch (error) {
    console.error('Error revoking access code:', error);
    res.status(500).json({ message: 'Failed to revoke access code' });
  }
});

// PUT /admin/access-codes/:id/unrevoke - Unrevoke a specific access code
router.put('/access-codes/:id/unrevoke', async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;

    // Check current status
    const currentCode = await db.select().from(accessCodes).where(eq(accessCodes.id, parseInt(id))).limit(1);
    
    if (currentCode.length === 0) {
      return res.status(404).json({ message: 'Access code not found' });
    }

    if (currentCode[0].status === 'redeemed') {
      return res.status(400).json({ message: 'Cannot unrevoke a redeemed access code' });
    }

    const updatedCode = await db.update(accessCodes)
      .set({ status: 'unused' })
      .where(eq(accessCodes.id, parseInt(id)))
      .returning();

    await logAdminAction(req.adminId!, 'unrevoke_code', 'access_code', id);

    res.json({ message: 'Access code unrevoked successfully', code: updatedCode[0] });
  } catch (error) {
    console.error('Error unrevoking access code:', error);
    res.status(500).json({ message: 'Failed to unrevoke access code' });
  }
});

// PUT /admin/books/:bookId/access-codes/revoke-all - Bulk revoke all unused codes for a book
router.put('/books/:bookId/access-codes/revoke-all', async (req: AdminRequest, res) => {
  try {
    const { bookId } = req.params;

    // Check if book exists
    const book = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (book.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const updatedCodes = await db.update(accessCodes)
      .set({ status: 'revoked' })
      .where(sql`${accessCodes.bookId} = ${bookId} AND ${accessCodes.status} = 'unused'`)
      .returning();

    await logAdminAction(req.adminId!, 'bulk_revoke_codes', 'access_code', bookId, { 
      revokedCount: updatedCodes.length 
    });

    res.json({ 
      message: `${updatedCodes.length} access code(s) revoked successfully`,
      revokedCount: updatedCodes.length 
    });
  } catch (error) {
    console.error('Error bulk revoking access codes:', error);
    res.status(500).json({ message: 'Failed to revoke access codes' });
  }
});

// Analytics Routes

// GET /admin/analytics/overview - Basic analytics
router.get('/analytics/overview', async (req: AdminRequest, res) => {
  try {
    // Total books
    const totalBooks = await db.select({ count: count() }).from(books);
    
    // Total chapters
    const totalChapters = await db.select({ count: count() }).from(chapters);
    
    // Total users
    const totalUsers = await db.select({ count: count() }).from(users);
    
    // Books with entitlement counts
    const bookStats = await db
      .select({
        bookId: books.id,
        title: books.title,
        totalUsers: sql<number>`cast(count(distinct ${users.id}) as int)`,
        totalCodes: sql<number>`cast(count(${accessCodes.id}) as int)`,
        redeemedCodes: sql<number>`cast(sum(case when ${accessCodes.status} = 'redeemed' then 1 else 0 end) as int)`,
      })
      .from(books)
      .leftJoin(accessCodes, eq(books.id, accessCodes.bookId))
      .leftJoin(users, eq(accessCodes.redeemedByUserId, users.id))
      .groupBy(books.id, books.title)
      .orderBy(books.title);

    res.json({
      summary: {
        totalBooks: totalBooks[0]?.count || 0,
        totalChapters: totalChapters[0]?.count || 0,
        totalUsers: totalUsers[0]?.count || 0,
      },
      bookStats,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

// Chapter Batch Creation from Parsing Results

// POST /admin/books/:bookId/chapters/create - Create chapters from parsing results
router.post('/books/:bookId/chapters/create', async (req: AdminRequest, res) => {
  try {
    const { bookId } = req.params;
    const { chapters: chapterData, jobId } = req.body;

    if (!chapterData || !Array.isArray(chapterData)) {
      return res.status(400).json({ 
        message: 'Chapter data array is required' 
      });
    }

    // Check if book exists
    const book = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (book.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Import JobProcessor and create instance
    const { default: JobProcessor } = await import('../services/jobProcessor.js');
    const jobProcessor = new JobProcessor();

    // Prepare parsing result format
    const parsingResult = {
      chapters: chapterData.map((chapter: any) => ({
        id: chapter.id,
        title: chapter.title,
        indexInBook: chapter.indexInBook,
        jsonContent: chapter.jsonContent,
        wordCount: chapter.wordCount
      })),
      metadata: {
        totalChapters: chapterData.length,
        totalWords: chapterData.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0),
        totalSentences: 0,
        processingTime: 0
      }
    };

    // Create chapters using job processor
    await jobProcessor.createChaptersFromResults(bookId, parsingResult);

    await logAdminAction(req.adminId!, 'batch_create_chapters', 'chapter', bookId, { 
      chapterCount: chapterData.length,
      jobId 
    });

    res.status(201).json({ 
      message: `${chapterData.length} chapters created successfully`,
      chapterCount: chapterData.length,
      bookId
    });
  } catch (error: any) {
    console.error('Error creating chapters from parsing results:', error);
    
    if (error.message?.includes('already exists')) {
      return res.status(400).json({ 
        message: 'Some chapters already exist. Please delete existing chapters first.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to create chapters',
      error: error.message || 'Unknown error'
    });
  }
});

// POST /admin/chapters/:chapterId/activities - Save all activities for a chapter
router.post('/chapters/:chapterId/activities', async (req: AdminRequest, res) => {
  try {
    const { chapterId } = req.params;
    const { activitiesByType } = req.body;

    if (!activitiesByType || typeof activitiesByType !== 'object') {
      return res.status(400).json({ 
        message: 'activitiesByType object is required' 
      });
    }

    // Verify chapter exists
    const chapterResult = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
    if (chapterResult.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    const chapter = chapterResult[0];

    // Delete existing activities for this chapter first (to handle updates/removals)
    await db.delete(chapterActivities).where(eq(chapterActivities.chapterId, chapterId));

    // Prepare new activities for insertion
    const activitiesToInsert: any[] = [];
    let sortOrder = 0;

    const activityTypes = ['vocabulary', 'comprehension', 'trueFalse', 'matching', 'writing'];
    
    for (const activityType of activityTypes) {
      const activities = activitiesByType[activityType] || [];
      
      for (const activity of activities) {
        if (!activity.id || !activity.title) {
          console.warn(`Skipping invalid activity for type ${activityType}:`, activity);
          continue;
        }

        // Prepare activity data by removing type-specific properties that should go in columns
        const activityData = { ...activity };
        delete activityData.id; // Will be generated as serial
        delete activityData.type; // Goes in activityType column
        delete activityData.title; // Goes in title column

        activitiesToInsert.push({
          chapterId,
          activityType,
          title: activity.title,
          description: activity.instructions || activity.description || '',
          activityData,
          sortOrder: sortOrder++,
          isActive: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Insert new activities
    if (activitiesToInsert.length > 0) {
      await db.insert(chapterActivities).values(activitiesToInsert);
    }

    await logAdminAction(req.adminId!, 'save_chapter_activities', 'chapter', chapterId, { 
      activityCount: activitiesToInsert.length,
      activityTypes: Object.keys(activitiesByType)
    });

    res.json({ 
      message: 'Activities saved successfully',
      activityCount: activitiesToInsert.length
    });
  } catch (error: any) {
    console.error('Error saving chapter activities:', error);
    res.status(500).json({ 
      message: 'Failed to save activities',
      error: error.message || 'Unknown error'
    });
  }
});

// GET /admin/chapters/:chapterId/activities - Load activities for editing
router.get('/chapters/:chapterId/activities', async (req: AdminRequest, res) => {
  try {
    const { chapterId } = req.params;

    // Verify chapter exists
    const chapterResult = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
    if (chapterResult.length === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Get all activities for this chapter
    const existingActivities = await db.select().from(chapterActivities).where(
      eq(chapterActivities.chapterId, chapterId)
    ).orderBy(chapterActivities.sortOrder);

    // Group activities by type
    const activitiesByType: Record<string, any[]> = {
      vocabulary: [],
      comprehension: [],
      trueFalse: [],
      matching: [],
      writing: []
    };

    existingActivities.forEach(activity => {
      const activityData = {
        id: activity.id.toString(),
        type: activity.activityType,
        title: activity.title,
        instructions: activity.description || '',
        ...(activity.activityData as Record<string, any> || {})
      };

      if (activitiesByType[activity.activityType as string]) {
        activitiesByType[activity.activityType as string].push(activityData);
      }
    });

    res.json({
      chapterId,
      activitiesByType
    });
  } catch (error: any) {
    console.error('Error loading chapter activities:', error);
    res.status(500).json({ 
      message: 'Failed to load activities',
      error: error.message || 'Unknown error'
    });
  }
});

// Object Storage Routes for Book Cover Images

// POST /admin/objects/upload - Get upload URL for book cover images
router.post('/objects/upload', async (req: AdminRequest, res) => {
  try {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  } catch (error) {
    console.error('Error getting upload URL:', error);
    res.status(500).json({ error: 'Failed to get upload URL' });
  }
});

// PUT /admin/book-covers - Update book cover image
router.put('/book-covers', async (req: AdminRequest, res) => {
  try {
    const { bookId, coverImageURL } = req.body;

    if (!bookId || !coverImageURL) {
      return res.status(400).json({ error: 'bookId and coverImageURL are required' });
    }

    // Check if book exists
    const book = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (book.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const objectStorageService = new ObjectStorageService();
    const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
      coverImageURL,
      {
        owner: req.adminId!.toString(),
        visibility: "public", // Book covers should be publicly accessible
      }
    );

    // Update book with cover image URL
    await db.update(books)
      .set({ 
        coverImageUrl: objectPath,
        updatedAt: new Date()
      })
      .where(eq(books.id, bookId));

    await logAdminAction(req.adminId!, 'update_book_cover', 'book', bookId, {
      coverImageUrl: objectPath
    });

    res.json({
      message: 'Book cover updated successfully',
      objectPath: objectPath,
      bookId
    });
  } catch (error) {
    console.error('Error setting book cover:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;