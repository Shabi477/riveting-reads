import express from 'express';
import { db } from '../db/index.js';
import { bookSources, processingJobs } from '../db/schema.js';
import { requireAdmin } from '../middleware/admin.js';
import { eq } from 'drizzle-orm';
import JobProcessor from '../services/jobProcessor.js';
import path from 'path';

const router = express.Router();
const jobProcessor = new JobProcessor();

// Apply admin middleware to all parsing routes
router.use(requireAdmin);

interface AdminRequest extends express.Request {
  adminId?: number;
  userRole?: string;
}

/**
 * POST /parsing/start/:bookSourceId - Start document parsing for a book source
 */
router.post('/start/:bookSourceId', async (req: AdminRequest, res) => {
  try {
    const bookSourceId = parseInt(req.params.bookSourceId);
    
    if (isNaN(bookSourceId)) {
      return res.status(400).json({ 
        message: 'Invalid book source ID',
        error: 'INVALID_BOOK_SOURCE_ID'
      });
    }

    // Check if book source exists
    const bookSource = await db
      .select()
      .from(bookSources)
      .where(eq(bookSources.id, bookSourceId))
      .limit(1);

    if (bookSource.length === 0) {
      return res.status(404).json({ 
        message: 'Book source not found',
        error: 'BOOK_SOURCE_NOT_FOUND'
      });
    }

    // Check if there's already a running job for this book source
    const existingJobs = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.bookSourceId, bookSourceId))
      .orderBy(processingJobs.createdAt);

    const runningJob = existingJobs.find(job => job.status === 'running' || job.status === 'pending');
    if (runningJob) {
      return res.status(409).json({
        message: 'A parsing job is already running for this document',
        error: 'JOB_ALREADY_RUNNING',
        jobId: runningJob.id
      });
    }

    // Create and start parsing job
    const jobId = await jobProcessor.createParsingJob(bookSourceId);

    // Start processing in background
    setImmediate(async () => {
      try {
        await jobProcessor.executeParsingJob(jobId);
      } catch (error) {
        console.error(`Background parsing job ${jobId} failed:`, error);
      }
    });

    res.status(201).json({
      message: 'Document parsing started',
      jobId,
      bookSourceId
    });

  } catch (error) {
    console.error('Error starting document parsing:', error);
    res.status(500).json({ 
      message: 'Failed to start document parsing',
      error: 'PROCESSING_ERROR'
    });
  }
});

/**
 * GET /parsing/status/:jobId - Get parsing job status
 */
router.get('/status/:jobId', async (req: AdminRequest, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ 
        message: 'Invalid job ID',
        error: 'INVALID_JOB_ID'
      });
    }

    const jobStatus = await jobProcessor.getJobStatus(jobId);
    
    if (!jobStatus) {
      return res.status(404).json({ 
        message: 'Job not found',
        error: 'JOB_NOT_FOUND'
      });
    }

    res.json(jobStatus);

  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ 
      message: 'Failed to get job status',
      error: 'STATUS_ERROR'
    });
  }
});

/**
 * GET /parsing/jobs/:bookSourceId - Get all jobs for a book source
 */
router.get('/jobs/:bookSourceId', async (req: AdminRequest, res) => {
  try {
    const bookSourceId = parseInt(req.params.bookSourceId);
    
    if (isNaN(bookSourceId)) {
      return res.status(400).json({ 
        message: 'Invalid book source ID',
        error: 'INVALID_BOOK_SOURCE_ID'
      });
    }

    const jobs = await jobProcessor.getJobsForBookSource(bookSourceId);
    
    res.json({
      bookSourceId,
      jobs
    });

  } catch (error) {
    console.error('Error getting jobs for book source:', error);
    res.status(500).json({ 
      message: 'Failed to get jobs',
      error: 'JOBS_ERROR'
    });
  }
});

/**
 * POST /parsing/cancel/:jobId - Cancel a parsing job
 */
router.post('/cancel/:jobId', async (req: AdminRequest, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ 
        message: 'Invalid job ID',
        error: 'INVALID_JOB_ID'
      });
    }

    // Check if job exists and can be cancelled
    const jobStatus = await jobProcessor.getJobStatus(jobId);
    
    if (!jobStatus) {
      return res.status(404).json({ 
        message: 'Job not found',
        error: 'JOB_NOT_FOUND'
      });
    }

    if (jobStatus.status === 'completed') {
      return res.status(400).json({ 
        message: 'Cannot cancel completed job',
        error: 'JOB_COMPLETED'
      });
    }

    if (jobStatus.status === 'failed') {
      return res.status(400).json({ 
        message: 'Job already failed',
        error: 'JOB_FAILED'
      });
    }

    await jobProcessor.cancelJob(jobId);

    res.json({
      message: 'Job cancelled successfully',
      jobId
    });

  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ 
      message: 'Failed to cancel job',
      error: 'CANCEL_ERROR'
    });
  }
});

/**
 * POST /parsing/process-queue - Manually trigger job queue processing
 */
router.post('/process-queue', async (req: AdminRequest, res) => {
  try {
    // Process job queue in background
    setImmediate(async () => {
      try {
        await jobProcessor.processJobQueue();
      } catch (error) {
        console.error('Error processing job queue:', error);
      }
    });

    res.json({
      message: 'Job queue processing started'
    });

  } catch (error) {
    console.error('Error triggering job queue processing:', error);
    res.status(500).json({ 
      message: 'Failed to trigger job queue processing',
      error: 'QUEUE_ERROR'
    });
  }
});

/**
 * GET /parsing/preview/:bookSourceId - Get parsing preview without creating chapters
 */
router.get('/preview/:bookSourceId', async (req: AdminRequest, res) => {
  try {
    const bookSourceId = parseInt(req.params.bookSourceId);
    
    if (isNaN(bookSourceId)) {
      return res.status(400).json({ 
        message: 'Invalid book source ID',
        error: 'INVALID_BOOK_SOURCE_ID'
      });
    }

    // Check if book source exists
    const bookSource = await db
      .select()
      .from(bookSources)
      .where(eq(bookSources.id, bookSourceId))
      .limit(1);

    if (bookSource.length === 0) {
      return res.status(404).json({ 
        message: 'Book source not found',
        error: 'BOOK_SOURCE_NOT_FOUND'
      });
    }

    // Create temporary parser and parse document for preview
    const parser = new (await import('../services/documentParser.js')).default();
    const filePath = path.resolve(process.cwd(), bookSource[0].fileUrl);
    
    const parsedDocument = await parser.parseDocument(filePath);
    const validation = parser.validateParsedDocument(parsedDocument);

    res.json({
      bookSourceId,
      preview: {
        chapters: parsedDocument.chapters.map(chapter => ({
          id: chapter.id,
          title: chapter.title,
          indexInBook: chapter.indexInBook,
          wordCount: chapter.wordCount,
          sentenceCount: chapter.sentences.length,
          contentPreview: chapter.sentences.slice(0, 2).map(s => s.text).join(' ')
        })),
        metadata: parsedDocument.metadata,
        validation
      }
    });

  } catch (error) {
    console.error('Error generating parsing preview:', error);
    res.status(500).json({ 
      message: 'Failed to generate parsing preview',
      error: 'PREVIEW_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;