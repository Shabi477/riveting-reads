import { db } from '../db/index.js';
import { processingJobs, bookSources, books, chapters, chapterActivities } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import DocumentParser from './documentParser.js';
import fs from 'fs';
import path from 'path';

interface JobProgress {
  jobId: number;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  result?: any;
}

interface ParsingJobResult {
  chapters: Array<{
    id: string;
    title: string;
    indexInBook: number;
    jsonContent: any;
    wordCount: number;
    activities?: Array<{
      activityType: 'vocabulary_support' | 'comprehension_questions' | 'true_false' | 'matching' | 'writing_prompts';
      title: string;
      description?: string;
      activityData: any;
      sortOrder: number;
    }>;
  }>;
  metadata: {
    totalChapters: number;
    totalWords: number;
    totalSentences: number;
    processingTime: number;
  };
}

/**
 * Service for processing document parsing jobs
 * Integrates with the existing processing_jobs table for tracking
 */
export class JobProcessor {
  private parser: DocumentParser;

  constructor() {
    this.parser = new DocumentParser();
  }

  /**
   * Create a new parsing job
   */
  async createParsingJob(bookSourceId: number): Promise<number> {
    try {
      // Get book source information
      const bookSource = await db
        .select()
        .from(bookSources)
        .where(eq(bookSources.id, bookSourceId))
        .limit(1);

      if (bookSource.length === 0) {
        throw new Error(`Book source not found: ${bookSourceId}`);
      }

      // Create processing job
      const newJob = await db.insert(processingJobs).values({
        bookSourceId,
        bookId: bookSource[0].bookId,
        jobType: 'parsing',
        status: 'pending',
        progress: 0,
        metadata: {
          bookSourceId,
          originalFileName: bookSource[0].originalFileName,
          startTime: new Date().toISOString()
        }
      }).returning();

      console.log(`Created parsing job ${newJob[0].id} for book source ${bookSourceId}`);
      return newJob[0].id;
    } catch (error) {
      console.error('Error creating parsing job:', error);
      throw new Error(`Failed to create parsing job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a parsing job
   */
  async executeParsingJob(jobId: number): Promise<ParsingJobResult> {
    try {
      // Update job status to running
      await this.updateJobProgress(jobId, 5, 'running', 'Starting document parsing...');

      // Get job details
      const job = await db
        .select({
          job: processingJobs,
          bookSource: bookSources
        })
        .from(processingJobs)
        .leftJoin(bookSources, eq(processingJobs.bookSourceId, bookSources.id))
        .where(eq(processingJobs.id, jobId))
        .limit(1);

      if (job.length === 0) {
        throw new Error(`Job not found: ${jobId}`);
      }

      const { job: jobData, bookSource } = job[0];
      
      if (!bookSource) {
        throw new Error(`Book source not found for job: ${jobId}`);
      }

      // Update progress
      await this.updateJobProgress(jobId, 10, 'running', 'Reading document file...');

      // Construct file path
      const filePath = path.resolve(process.cwd(), bookSource.fileUrl);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Document file not found: ${filePath}`);
      }

      // Update progress
      await this.updateJobProgress(jobId, 20, 'running', 'Analyzing document structure...');

      // Parse the document
      const parsedDocument = await this.parser.parseDocument(filePath);

      // Update progress
      await this.updateJobProgress(jobId, 60, 'running', 'Processing chapters...');

      // Validate parsed document
      const validation = this.parser.validateParsedDocument(parsedDocument);
      if (!validation.isValid) {
        throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
      }

      // Update progress
      await this.updateJobProgress(jobId, 80, 'running', 'Generating output format...');

      // Generate reading JSON
      const readingJSON = this.parser.generateReadingJSON(parsedDocument);

      // Prepare result
      const result: ParsingJobResult = {
        chapters: parsedDocument.chapters.map(chapter => ({
          id: chapter.id,
          title: chapter.title,
          indexInBook: chapter.indexInBook,
          jsonContent: readingJSON.chapters.find((c: any) => c.id === chapter.id),
          wordCount: chapter.wordCount,
          activities: chapter.activities || []
        })),
        metadata: parsedDocument.metadata
      };

      // Update book source status
      await db.update(bookSources)
        .set({ 
          status: 'processed',
          updatedAt: new Date()
        })
        .where(eq(bookSources.id, bookSource.id));

      // Complete job
      await this.updateJobProgress(jobId, 100, 'completed', 'Document parsing completed successfully', result);

      console.log(`Parsing job ${jobId} completed successfully. Found ${result.chapters.length} chapters.`);
      
      // Create chapters in database from parsed results
      if (bookSource.bookId && result.chapters.length > 0) {
        console.log(`Creating ${result.chapters.length} chapters in database for book ${bookSource.bookId}`);
        await this.createChaptersFromResults(bookSource.bookId, result);
        console.log(`Successfully created chapters in database for book ${bookSource.bookId}`);
      }
      
      return result;

    } catch (error) {
      console.error(`Error executing parsing job ${jobId}:`, error);
      
      // Update job status to failed
      await this.updateJobProgress(
        jobId, 
        0, 
        'failed', 
        `Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Update book source status
      const jobData = await db.select().from(processingJobs).where(eq(processingJobs.id, jobId)).limit(1);
      if (jobData.length > 0 && jobData[0].bookSourceId) {
        await db.update(bookSources)
          .set({ 
            status: 'failed',
            updatedAt: new Date()
          })
          .where(eq(bookSources.id, jobData[0].bookSourceId));
      }

      throw error;
    }
  }

  /**
   * Update job progress and status
   */
  async updateJobProgress(
    jobId: number, 
    progress: number, 
    status: 'pending' | 'running' | 'completed' | 'failed',
    message?: string,
    result?: any
  ): Promise<void> {
    try {
      const updateData: any = {
        progress,
        status,
        updatedAt: new Date()
      };

      if (status === 'running' && !await this.isJobRunning(jobId)) {
        updateData.startedAt = new Date();
      }

      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
      }

      if (message) {
        updateData.errorMessage = status === 'failed' ? message : null;
        
        // Store progress message in metadata
        const currentJob = await db.select().from(processingJobs).where(eq(processingJobs.id, jobId)).limit(1);
        if (currentJob.length > 0) {
          const metadata = (currentJob[0].metadata as any) || {};
          updateData.metadata = {
            ...metadata,
            lastMessage: message,
            lastUpdated: new Date().toISOString()
          };
        }
      }

      if (result) {
        updateData.result = result;
      }

      await db.update(processingJobs)
        .set(updateData)
        .where(eq(processingJobs.id, jobId));

      console.log(`Job ${jobId} progress updated: ${progress}% - ${status} - ${message || ''}`);
    } catch (error) {
      console.error(`Error updating job progress for job ${jobId}:`, error);
    }
  }

  /**
   * Check if job is currently running
   */
  private async isJobRunning(jobId: number): Promise<boolean> {
    const job = await db.select().from(processingJobs).where(eq(processingJobs.id, jobId)).limit(1);
    return job.length > 0 && job[0].status === 'running';
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: number): Promise<JobProgress | null> {
    try {
      const job = await db.select().from(processingJobs).where(eq(processingJobs.id, jobId)).limit(1);
      
      if (job.length === 0) {
        return null;
      }

      const jobData = job[0];
      const metadata = (jobData.metadata as any) || {};

      return {
        jobId,
        progress: jobData.progress,
        status: jobData.status,
        message: metadata.lastMessage || jobData.errorMessage || undefined,
        result: jobData.result
      };
    } catch (error) {
      console.error(`Error getting job status for job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Get all jobs for a book source
   */
  async getJobsForBookSource(bookSourceId: number): Promise<JobProgress[]> {
    try {
      const jobs = await db
        .select()
        .from(processingJobs)
        .where(eq(processingJobs.bookSourceId, bookSourceId))
        .orderBy(processingJobs.createdAt);

      return jobs.map(job => {
        const metadata = (job.metadata as any) || {};
        return {
          jobId: job.id,
          progress: job.progress,
          status: job.status,
          message: metadata.lastMessage || job.errorMessage || undefined,
          result: job.result
        };
      });
    } catch (error) {
      console.error(`Error getting jobs for book source ${bookSourceId}:`, error);
      return [];
    }
  }

  /**
   * Create chapters from parsing results
   */
  async createChaptersFromResults(bookId: string, parsingResult: ParsingJobResult): Promise<void> {
    try {
      console.log(`Creating ${parsingResult.chapters.length} chapters for book ${bookId}`);

      for (const chapterData of parsingResult.chapters) {
        // Store JSON content as a file or in database
        const jsonContent = JSON.stringify(chapterData.jsonContent, null, 2);
        
        // For now, we'll store JSON content inline, but in production you might
        // want to store it as files and reference them by URL
        const jsonUrl = `data:application/json;base64,${Buffer.from(jsonContent).toString('base64')}`;
        
        // Create placeholder audio URL (to be replaced when TTS is implemented)
        const audioUrl = `audio/${bookId}/${chapterData.id}.mp3`;

        await db.insert(chapters).values({
          id: chapterData.id,
          bookId,
          title: chapterData.title,
          indexInBook: chapterData.indexInBook,
          audioUrl,
          jsonUrl
        });

        // Create activities for this chapter if they exist
        if (chapterData.activities && chapterData.activities.length > 0) {
          console.log(`Creating ${chapterData.activities.length} activities for chapter ${chapterData.id}`);
          
          for (const activity of chapterData.activities) {
            await db.insert(chapterActivities).values({
              chapterId: chapterData.id,
              activityType: activity.activityType,
              title: activity.title,
              description: activity.description || null,
              activityData: activity.activityData,
              sortOrder: activity.sortOrder,
              isActive: 1 // Activities are active by default
            });
          }
          
          console.log(`Successfully created ${chapterData.activities.length} activities for chapter ${chapterData.id}`);
        }
      }

      console.log(`Successfully created ${parsingResult.chapters.length} chapters for book ${bookId}`);
    } catch (error) {
      console.error('Error creating chapters from results:', error);
      throw new Error(`Failed to create chapters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process job queue (for background processing)
   */
  async processJobQueue(): Promise<void> {
    try {
      // Get pending parsing jobs
      const pendingJobs = await db
        .select()
        .from(processingJobs)
        .where(and(
          eq(processingJobs.status, 'pending'),
          eq(processingJobs.jobType, 'parsing')
        ))
        .orderBy(processingJobs.createdAt)
        .limit(5); // Process up to 5 jobs at a time

      for (const job of pendingJobs) {
        try {
          console.log(`Processing job ${job.id}...`);
          const result = await this.executeParsingJob(job.id);
          
          // If job completed successfully and has a bookId, create chapters
          if (job.bookId && result.chapters.length > 0) {
            await this.createChaptersFromResults(job.bookId, result);
          }
        } catch (error) {
          console.error(`Failed to process job ${job.id}:`, error);
          // Error handling is done in executeParsingJob
        }
      }
    } catch (error) {
      console.error('Error processing job queue:', error);
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: number): Promise<void> {
    try {
      await db.update(processingJobs)
        .set({
          status: 'failed',
          errorMessage: 'Job cancelled by user',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(processingJobs.id, jobId));

      console.log(`Job ${jobId} cancelled`);
    } catch (error) {
      console.error(`Error cancelling job ${jobId}:`, error);
      throw error;
    }
  }
}

export default JobProcessor;