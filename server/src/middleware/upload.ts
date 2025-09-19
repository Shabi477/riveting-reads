import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { books } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Define custom interface for file upload requests
export interface UploadRequest extends Request {
  adminId?: number;
  userRole?: string;
  validatedBookId?: string;
}

// Secure bookId validation middleware - prevents path traversal attacks
export const validateBookId = async (req: UploadRequest, res: Response, next: NextFunction) => {
  try {
    const bookId = req.params.bookId;
    
    if (!bookId) {
      return res.status(400).json({ 
        message: 'Book ID is required',
        error: 'MISSING_BOOK_ID'
      });
    }

    // Strict whitelist validation - only allow alphanumeric, hyphens, and underscores
    const bookIdPattern = /^[A-Za-z0-9_-]+$/;
    if (!bookIdPattern.test(bookId)) {
      return res.status(400).json({ 
        message: 'Invalid book ID format. Only alphanumeric characters, hyphens, and underscores are allowed.',
        error: 'INVALID_BOOK_ID_FORMAT'
      });
    }

    // Additional length validation
    if (bookId.length > 100) {
      return res.status(400).json({ 
        message: 'Book ID too long. Maximum 100 characters allowed.',
        error: 'BOOK_ID_TOO_LONG'
      });
    }

    // Verify book exists in database
    const existingBook = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (existingBook.length === 0) {
      return res.status(404).json({ 
        message: 'Book not found',
        error: 'BOOK_NOT_FOUND'
      });
    }

    // Store validated bookId for later use
    req.validatedBookId = bookId;
    next();
  } catch (error) {
    console.error('Error validating book ID:', error);
    return res.status(500).json({ 
      message: 'Internal server error during book validation',
      error: 'VALIDATION_ERROR'
    });
  }
};

// Content validation for .docx files - checks ZIP magic bytes and structure
const validateDocxContent = (buffer: Buffer): boolean => {
  // Check ZIP magic bytes (first 4 bytes should be 'PK\x03\x04' or 'PK\x05\x06' or 'PK\x07\x08')
  if (buffer.length < 4) return false;
  
  const magicBytes = buffer.subarray(0, 4);
  const validMagicBytes = [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP local file header
    Buffer.from([0x50, 0x4B, 0x05, 0x06]), // ZIP end of central directory
    Buffer.from([0x50, 0x4B, 0x07, 0x08])  // ZIP data descriptor
  ];
  
  const hasValidMagicBytes = validMagicBytes.some(validMagic => 
    magicBytes.equals(validMagic)
  );
  
  if (!hasValidMagicBytes) return false;
  
  // Check for required .docx files in the ZIP structure
  const bufferString = buffer.toString('binary');
  const requiredFiles = [
    'word/document.xml',     // Main document content
    '[Content_Types].xml',   // Content types definition
    '_rels/.rels'           // Package relationships
  ];
  
  // Check if all required files are mentioned in the ZIP
  const hasAllRequiredFiles = requiredFiles.every(filename => 
    bufferString.includes(filename)
  );
  
  return hasAllRequiredFiles;
};

// Enhanced file filter with content validation
const fileFilter = (req: UploadRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file extension
  const allowedExtensions = ['.docx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    return cb(new Error('Only .docx files are allowed'));
  }

  // Check MIME type for additional security
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only Word documents are allowed'));
  }

  cb(null, true);
};

// Post-upload content validation middleware
export const validateUploadedDocxContent = async (req: UploadRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next();
    }

    // Read the uploaded file for content validation
    const fileBuffer = fs.readFileSync(req.file.path);
    
    // Validate .docx content structure
    if (!validateDocxContent(fileBuffer)) {
      // Cleanup invalid file
      cleanupUploadedFile(req.file.path);
      
      return res.status(400).json({
        message: 'Invalid .docx file content. File does not contain required Word document structure.',
        error: 'INVALID_DOCX_CONTENT'
      });
    }

    next();
  } catch (error) {
    console.error('Error validating uploaded file content:', error);
    
    // Cleanup file on error
    if (req.file) {
      cleanupUploadedFile(req.file.path);
    }
    
    return res.status(500).json({
      message: 'Failed to validate uploaded file content',
      error: 'VALIDATION_ERROR'
    });
  }
};

// Secure storage configuration with path traversal protection
const storage = multer.diskStorage({
  destination: (req: UploadRequest, file: Express.Multer.File, cb) => {
    // Use the validated bookId from the pre-middleware
    const bookId = req.validatedBookId;
    
    if (!bookId) {
      return cb(new Error('Book ID validation failed'), '');
    }

    // Define base upload directory
    const baseUploadDir = path.resolve(process.cwd(), 'uploads', 'books');
    
    // Construct and resolve the target path
    const targetPath = path.resolve(baseUploadDir, bookId);
    
    // Security check: ensure target path is within the base upload directory
    if (!targetPath.startsWith(baseUploadDir + path.sep) && targetPath !== baseUploadDir) {
      return cb(new Error('Invalid upload path - security violation'), '');
    }

    try {
      // Create book-specific directory if it doesn't exist
      fs.mkdirSync(targetPath, { recursive: true });
      cb(null, targetPath);
    } catch (error) {
      console.error('Failed to create upload directory:', error);
      cb(new Error('Failed to create upload directory'), '');
    }
  },
  filename: (req: UploadRequest, file: Express.Multer.File, cb) => {
    // Generate unique filename with timestamp and original name
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    
    cb(null, filename);
  }
});

// Configure multer with validation and limits
export const uploadWordDocument = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1, // Only one file at a time
  },
}).single('document'); // Field name 'document'

// Error handling middleware for multer errors
export const handleUploadErrors = (error: any, req: UploadRequest, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          message: 'File too large. Maximum size is 50MB.',
          error: 'FILE_TOO_LARGE'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ 
          message: 'Too many files. Only one file allowed.',
          error: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          message: 'Unexpected field name. Use "document" field.',
          error: 'UNEXPECTED_FIELD'
        });
      default:
        return res.status(400).json({ 
          message: 'Upload error occurred.',
          error: error.code
        });
    }
  }
  
  if (error.message) {
    return res.status(400).json({ 
      message: error.message,
      error: 'VALIDATION_ERROR'
    });
  }

  next(error);
};

// Cleanup uploaded file in case of processing failure
export const cleanupUploadedFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to cleanup file ${filePath}:`, error);
  }
};

// Secure helper function to get file URL with path validation
export const getSecureFileUrl = (validatedBookId: string, filename: string): string => {
  // Additional validation for bookId (should have been validated by middleware)
  const bookIdPattern = /^[A-Za-z0-9_-]+$/;
  if (!bookIdPattern.test(validatedBookId)) {
    throw new Error('Invalid book ID for file URL generation');
  }
  
  // Sanitize filename to prevent path traversal
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Use forward slashes for consistent URL paths (works on all platforms)
  return `uploads/books/${validatedBookId}/${sanitizedFilename}`;
};

// Legacy function for backward compatibility (deprecated)
export const getFileUrl = (bookId: string, filename: string): string => {
  console.warn('getFileUrl is deprecated. Use getSecureFileUrl instead.');
  return getSecureFileUrl(bookId, filename);
};