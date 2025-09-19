import { pgTable, serial, text, timestamp, integer, uniqueIndex, index, jsonb, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// Users table - keeping existing serial ID structure
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Books table - keeping existing text ID structure
export const books = pgTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').default('Unknown Author').notNull(),
  description: text('description').default('').notNull(),
  language: text('language').default('Spanish').notNull(),
  difficultyLevel: text('difficulty_level').default('Beginner').notNull(),
  estimatedReadingTimeMinutes: integer('estimated_reading_time_minutes').default(15).notNull(),
  kdpCode: text('kdp_code').unique(),
  coverImageUrl: text('cover_image_url'),
  publicationDate: timestamp('publication_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    kdpCodeIdx: uniqueIndex('books_kdp_code_idx').on(table.kdpCode),
  };
});

// Chapters table - keeping existing text ID structure
export const chapters = pgTable('chapters', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  indexInBook: integer('index_in_book').notNull(),
  title: text('title').notNull(),
  audioUrl: text('audio_url'), // Made optional - audio generation can fail
  jsonUrl: text('json_url').notNull(),
  elevenLabsTimingData: jsonb('elevenlabs_timing_data'), // Word-level timing data from ElevenLabs API
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    bookIdIdx: index('chapters_book_id_idx').on(table.bookId),
    bookIdIndexIdx: uniqueIndex('chapters_book_id_index_idx').on(table.bookId, table.indexInBook),
  };
});

// Entitlements table - keeping existing serial ID structure
export const entitlements = pgTable('entitlements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userIdBookIdIdx: uniqueIndex('entitlements_user_id_book_id_idx').on(table.userId, table.bookId),
    userIdIdx: index('entitlements_user_id_idx').on(table.userId),
  };
});

// Saved words table - keeping existing serial ID structure
export const savedWords = pgTable('saved_words', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dictId: text('dict_id').notNull(), // Legacy field, kept for backwards compatibility
  spanishWord: text('spanish_word').notNull(), // The actual Spanish word
  englishTranslation: text('english_translation').notNull(), // The English translation
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  ease: integer('ease').default(2).notNull(),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userIdDictIdBookIdIdx: uniqueIndex('saved_words_user_id_dict_id_book_id_idx').on(table.userId, table.dictId, table.bookId),
    userIdSpanishWordBookIdIdx: uniqueIndex('saved_words_user_id_spanish_word_book_id_idx').on(table.userId, table.spanishWord, table.bookId),
    userIdIdx: index('saved_words_user_id_idx').on(table.userId),
    nextReviewAtIdx: index('saved_words_next_review_at_idx').on(table.nextReviewAt),
    spanishWordIdx: index('saved_words_spanish_word_idx').on(table.spanishWord),
  };
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  entitlements: many(entitlements),
  savedWords: many(savedWords),
}));

export const booksRelations = relations(books, ({ many }) => ({
  chapters: many(chapters),
  entitlements: many(entitlements),
  bookSources: many(bookSources),
  ttsConfigs: many(ttsConfigs),
  processingJobs: many(processingJobs),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  book: one(books, {
    fields: [chapters.bookId],
    references: [books.id],
  }),
  processingJobs: many(processingJobs),
  ttsConfigs: many(ttsConfigs),
  activities: many(chapterActivities),
}));

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  user: one(users, {
    fields: [entitlements.userId],
    references: [users.id],
  }),
  book: one(books, {
    fields: [entitlements.bookId],
    references: [books.id],
  }),
}));

export const savedWordsRelations = relations(savedWords, ({ one }) => ({
  user: one(users, {
    fields: [savedWords.userId],
    references: [users.id],
  }),
}));

// Access codes table for admin-generated book access
export const accessCodes = pgTable('access_codes', {
  id: serial('id').primaryKey(),
  codeHash: text('code_hash').notNull().unique(),
  codeDigest: text('code_digest').notNull().unique(), // SHA256 digest for deterministic uniqueness checking
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  generatedByAdminId: integer('generated_by_admin_id').notNull().references(() => users.id),
  redeemedByUserId: integer('redeemed_by_user_id').references(() => users.id),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  status: text('status', { enum: ['unused', 'redeemed', 'revoked'] }).default('unused').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    bookIdIdx: index('access_codes_book_id_idx').on(table.bookId),
    statusIdx: index('access_codes_status_idx').on(table.status),
    redeemedByUserIdIdx: index('access_codes_redeemed_by_user_id_idx').on(table.redeemedByUserId),
    generatedByAdminIdIdx: index('access_codes_generated_by_admin_id_idx').on(table.generatedByAdminId),
    codeDigestIdx: uniqueIndex('access_codes_code_digest_idx').on(table.codeDigest),
  };
});

// Reading progress table - tracks user's reading progress within chapters
export const readingProgress = pgTable('reading_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  chapterIndex: integer('chapter_index').notNull(),
  audioPosition: integer('audio_position').default(0).notNull(), // Position in audio (seconds)
  lastReadAt: timestamp('last_read_at', { withTimezone: true }).defaultNow().notNull(),
  isCompleted: integer('is_completed').default(0).notNull(), // 0 = in progress, 1 = completed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userIdBookIdIdx: uniqueIndex('reading_progress_user_id_book_id_idx').on(table.userId, table.bookId),
    userIdIdx: index('reading_progress_user_id_idx').on(table.userId),
    bookIdIdx: index('reading_progress_book_id_idx').on(table.bookId),
    lastReadAtIdx: index('reading_progress_last_read_at_idx').on(table.lastReadAt),
  };
});

// Admin actions audit log
export const adminActions = pgTable('admin_actions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => users.id),
  action: text('action').notNull(), // 'create_book', 'update_book', 'delete_book', 'generate_codes', etc.
  resourceType: text('resource_type').notNull(), // 'book', 'chapter', 'access_code', etc.
  resourceId: text('resource_id'), // ID of the affected resource
  details: text('details'), // JSON string with additional details
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    adminIdIdx: index('admin_actions_admin_id_idx').on(table.adminId),
    actionIdx: index('admin_actions_action_idx').on(table.action),
    resourceTypeIdx: index('admin_actions_resource_type_idx').on(table.resourceType),
    createdAtIdx: index('admin_actions_created_at_idx').on(table.createdAt),
  };
});

// Book sources table - tracks uploaded Word documents for processing
export const bookSources = pgTable('book_sources', {
  id: serial('id').primaryKey(),
  bookId: text('book_id').references(() => books.id, { onDelete: 'cascade' }), // nullable initially, book created after processing
  originalFileName: text('original_file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'), // size in bytes
  uploadedByAdminId: integer('uploaded_by_admin_id').notNull().references(() => users.id),
  status: text('status', { enum: ['uploaded', 'processing', 'processed', 'failed'] }).default('uploaded').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    bookIdIdx: index('book_sources_book_id_idx').on(table.bookId),
    statusIdx: index('book_sources_status_idx').on(table.status),
    uploadedByAdminIdIdx: index('book_sources_uploaded_by_admin_id_idx').on(table.uploadedByAdminId),
    createdAtIdx: index('book_sources_created_at_idx').on(table.createdAt),
  };
});

// Processing jobs table - monitors async parsing/TTS jobs
export const processingJobs = pgTable('processing_jobs', {
  id: serial('id').primaryKey(),
  bookSourceId: integer('book_source_id').notNull().references(() => bookSources.id, { onDelete: 'cascade' }),
  bookId: text('book_id').references(() => books.id, { onDelete: 'cascade' }), // nullable initially, set when book is created
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }), // nullable, for chapter-specific jobs
  jobType: text('job_type', { enum: ['parsing', 'tts_generation', 'chapter_creation'] }).notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).default('pending').notNull(),
  progress: integer('progress').default(0).notNull(), // 0-100 progress percentage
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'), // if failed
  metadata: jsonb('metadata'), // JSONB for structured job info
  result: jsonb('result'), // JSONB for job results
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    bookSourceIdIdx: index('processing_jobs_book_source_id_idx').on(table.bookSourceId),
    bookIdIdx: index('processing_jobs_book_id_idx').on(table.bookId),
    chapterIdIdx: index('processing_jobs_chapter_id_idx').on(table.chapterId),
    jobTypeIdx: index('processing_jobs_job_type_idx').on(table.jobType),
    statusIdx: index('processing_jobs_status_idx').on(table.status),
    progressIdx: index('processing_jobs_progress_idx').on(table.progress),
    createdAtIdx: index('processing_jobs_created_at_idx').on(table.createdAt),
    // Composite index for efficient querying by status and creation time
    statusCreatedAtIdx: index('processing_jobs_status_created_at_idx').on(table.status, table.createdAt),
    // CHECK constraint to ensure progress is between 0 and 100
    progressCheck: check('processing_jobs_progress_check', sql`${table.progress} >= 0 AND ${table.progress} <= 100`),
  };
});

// TTS configs table - stores voice preferences per book/chapter
export const ttsConfigs = pgTable('tts_configs', {
  id: serial('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').references(() => chapters.id, { onDelete: 'cascade' }), // nullable for book-level configs
  scope: text('scope', { enum: ['book', 'chapter'] }).default('book').notNull(),
  voiceProvider: text('voice_provider').notNull(), // 'aws', 'google', 'azure', etc
  voiceId: text('voice_id').notNull(), // specific voice ID from provider
  voiceSettings: jsonb('voice_settings'), // JSONB with speed, pitch, etc
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    bookIdIdx: index('tts_configs_book_id_idx').on(table.bookId),
    chapterIdIdx: index('tts_configs_chapter_id_idx').on(table.chapterId),
    scopeIdx: index('tts_configs_scope_idx').on(table.scope),
    // Partial unique indexes to handle NULL semantics properly:
    // 1. For book-level configs: only one config per book where scope = 'book'
    bookLevelUniqueIdx: uniqueIndex('tts_configs_book_level_unique_idx').on(table.bookId).where(sql`${table.scope} = 'book'`),
    // 2. For chapter-level configs: only one config per book-chapter combination where scope = 'chapter'
    chapterLevelUniqueIdx: uniqueIndex('tts_configs_chapter_level_unique_idx').on(table.bookId, table.chapterId).where(sql`${table.scope} = 'chapter'`),
    // CHECK constraint to ensure data integrity:
    // - scope='book' must have chapter_id IS NULL
    // - scope='chapter' must have chapter_id IS NOT NULL
    scopeChapterCheck: check('tts_configs_scope_chapter_check', 
      sql`(scope = 'book' AND chapter_id IS NULL) OR (scope = 'chapter' AND chapter_id IS NOT NULL)`
    ),
  };
});

// Chapter activities table - stores different types of learning activities for chapters
export const chapterActivities = pgTable('chapter_activities', {
  id: serial('id').primaryKey(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  activityType: text('activity_type', { 
    enum: ['vocabulary', 'comprehension', 'trueFalse', 'matching', 'writing'] 
  }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  activityData: jsonb('activity_data').notNull(), // Flexible JSON storage for different activity structures
  sortOrder: integer('sort_order').default(0).notNull(), // For ordering activities within a chapter
  isActive: integer('is_active').default(1).notNull(), // 0 = disabled, 1 = active
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    chapterIdIdx: index('chapter_activities_chapter_id_idx').on(table.chapterId),
    activityTypeIdx: index('chapter_activities_activity_type_idx').on(table.activityType),
    chapterIdActivityTypeIdx: index('chapter_activities_chapter_id_activity_type_idx').on(table.chapterId, table.activityType),
    sortOrderIdx: index('chapter_activities_sort_order_idx').on(table.sortOrder),
    isActiveIdx: index('chapter_activities_is_active_idx').on(table.isActive),
  };
});

// Translation cache table - stores Spanish-English word translations to save OpenAI API costs
export const translationCache = pgTable('translation_cache', {
  id: serial('id').primaryKey(),
  spanishWord: text('spanish_word').notNull(),
  englishTranslation: text('english_translation').notNull(),
  context: text('context'), // Optional context where the word appears
  usageCount: integer('usage_count').default(1).notNull(), // Track how often this translation is used
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    spanishWordIdx: uniqueIndex('translation_cache_spanish_word_idx').on(table.spanishWord),
    usageCountIdx: index('translation_cache_usage_count_idx').on(table.usageCount),
    createdAtIdx: index('translation_cache_created_at_idx').on(table.createdAt),
  };
});

// Activity progress table - tracks user progress on chapter activities
export const activityProgress = pgTable('activity_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  chapterIndex: integer('chapter_index').notNull(),
  activityType: text('activity_type', { 
    enum: ['vocabulary', 'comprehension', 'trueFalse', 'matching', 'writing'] 
  }).notNull(),
  activityId: text('activity_id').notNull(), // ID of the specific activity
  completed: integer('completed').default(0).notNull(), // 0 = not completed, 1 = completed
  score: integer('score'), // 0-100 percentage score
  timeSpent: integer('time_spent').default(0).notNull(), // Time spent in seconds
  answers: jsonb('answers'), // JSONB storage for user answers/responses
  attempts: integer('attempts').default(1).notNull(),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userIdBookIdChapterIdx: uniqueIndex('activity_progress_user_book_chapter_activity_idx').on(table.userId, table.bookId, table.chapterId, table.activityType, table.activityId),
    userIdIdx: index('activity_progress_user_id_idx').on(table.userId),
    bookIdIdx: index('activity_progress_book_id_idx').on(table.bookId),
    chapterIdIdx: index('activity_progress_chapter_id_idx').on(table.chapterId),
    activityTypeIdx: index('activity_progress_activity_type_idx').on(table.activityType),
    completedIdx: index('activity_progress_completed_idx').on(table.completed),
    lastAttemptAtIdx: index('activity_progress_last_attempt_at_idx').on(table.lastAttemptAt),
  };
});

// Relations for new tables
export const accessCodesRelations = relations(accessCodes, ({ one }) => ({
  book: one(books, {
    fields: [accessCodes.bookId],
    references: [books.id],
  }),
  generatedByAdmin: one(users, {
    fields: [accessCodes.generatedByAdminId],
    references: [users.id],
  }),
  redeemedByUser: one(users, {
    fields: [accessCodes.redeemedByUserId],
    references: [users.id],
  }),
}));

export const adminActionsRelations = relations(adminActions, ({ one }) => ({
  admin: one(users, {
    fields: [adminActions.adminId],
    references: [users.id],
  }),
}));

export const readingProgressRelations = relations(readingProgress, ({ one }) => ({
  user: one(users, {
    fields: [readingProgress.userId],
    references: [users.id],
  }),
  book: one(books, {
    fields: [readingProgress.bookId],
    references: [books.id],
  }),
  chapter: one(chapters, {
    fields: [readingProgress.chapterId],
    references: [chapters.id],
  }),
}));

// Relations for document processing workflow tables
export const bookSourcesRelations = relations(bookSources, ({ one, many }) => ({
  book: one(books, {
    fields: [bookSources.bookId],
    references: [books.id],
  }),
  uploadedByAdmin: one(users, {
    fields: [bookSources.uploadedByAdminId],
    references: [users.id],
  }),
  processingJobs: many(processingJobs),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  bookSource: one(bookSources, {
    fields: [processingJobs.bookSourceId],
    references: [bookSources.id],
  }),
  book: one(books, {
    fields: [processingJobs.bookId],
    references: [books.id],
  }),
  chapter: one(chapters, {
    fields: [processingJobs.chapterId],
    references: [chapters.id],
  }),
}));

export const ttsConfigsRelations = relations(ttsConfigs, ({ one }) => ({
  book: one(books, {
    fields: [ttsConfigs.bookId],
    references: [books.id],
  }),
  chapter: one(chapters, {
    fields: [ttsConfigs.chapterId],
    references: [chapters.id],
  }),
}));

export const chapterActivitiesRelations = relations(chapterActivities, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterActivities.chapterId],
    references: [chapters.id],
  }),
}));

export const activityProgressRelations = relations(activityProgress, ({ one }) => ({
  user: one(users, {
    fields: [activityProgress.userId],
    references: [users.id],
  }),
  book: one(books, {
    fields: [activityProgress.bookId],
    references: [books.id],
  }),
  chapter: one(chapters, {
    fields: [activityProgress.chapterId],
    references: [chapters.id],
  }),
}));