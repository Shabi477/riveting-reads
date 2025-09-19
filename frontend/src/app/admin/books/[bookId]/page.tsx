'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LocalImageUploader } from '@/components/LocalImageUploader';

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  language: string;
  difficultyLevel: string;
  estimatedReadingTimeMinutes: number;
  coverImageUrl?: string;
  publicationDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookSource {
  id: number;
  originalFileName: string;
  fileSize: number;
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  createdAt: string;
  uploadedByAdmin: string;
}

interface ProcessingJob {
  id: number;
  jobType: 'parsing' | 'tts_generation' | 'chapter_creation';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  result?: any;
}

interface DetectedChapter {
  id: string;
  title: string;
  indexInBook: number;
  wordCount: number;
  preview: string;
  jsonContent: any;
}

interface UploadResult<TMeta extends Record<string, unknown>, TFile extends Record<string, unknown>> {
  successful: Array<TFile & { uploadURL?: unknown }>;
  failed: Array<{ error: string }>;
}

export default function EditBookPage() {
  const [book, setBook] = useState<Book | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    language: 'Spanish',
    difficultyLevel: 'Beginner',
    estimatedReadingTimeMinutes: 15,
    coverImageUrl: '',
    publicationDate: '',
  });

  // Upload states
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bookSources, setBookSources] = useState<BookSource[]>([]);
  const [activeJob, setActiveJob] = useState<ProcessingJob | null>(null);
  const [detectedChapters, setDetectedChapters] = useState<DetectedChapter[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'upload' | 'chapters'>('edit');
  
  const router = useRouter();
  const params = useParams();
  const bookId = params.bookId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jobPollingRef = useRef<number>();

  useEffect(() => {
    if (bookId) {
      loadBook();
      loadBookSources();
    }
    return () => {
      if (jobPollingRef.current) {
        clearInterval(jobPollingRef.current);
      }
    };
  }, [bookId]);

  const loadBook = async () => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (response.status === 404) {
          setError('Book not found');
          return;
        }
        throw new Error('Failed to load book');
      }

      const data = await response.json();
      setBook(data);
      setFormData({
        title: data.title || '',
        author: data.author || '',
        description: data.description || '',
        language: data.language || 'Spanish',
        difficultyLevel: data.difficultyLevel || 'Beginner',
        estimatedReadingTimeMinutes: data.estimatedReadingTimeMinutes || 15,
        coverImageUrl: data.coverImageUrl || '',
        publicationDate: data.publicationDate ? data.publicationDate.split('T')[0] : '',
      });
    } catch (err) {
      setError('Failed to load book');
      console.error('Load book error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookSources = async () => {
    try {
      const response = await fetch(`/api/admin/books/${bookId}/sources`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setBookSources(data.sources || []);
        
        // Check for active processing jobs
        const processingSource = data.sources?.find((source: BookSource) => 
          source.status === 'processing'
        );
        if (processingSource) {
          startJobPolling(processingSource.id);
        }
      }
    } catch (err) {
      console.error('Failed to load book sources:', err);
    }
  };

  const startJobPolling = (bookSourceId: number) => {
    if (jobPollingRef.current) {
      clearInterval(jobPollingRef.current);
    }
    
    jobPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/parsing/jobs/${bookSourceId}`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const jobs = await response.json();
          const currentJob = jobs.find((job: ProcessingJob) => 
            job.status === 'running' || job.status === 'pending'
          );
          
          if (currentJob) {
            setActiveJob(currentJob);
          } else {
            // Check for completed job
            const completedJob = jobs.find((job: ProcessingJob) => 
              job.status === 'completed'
            );
            if (completedJob && completedJob.result) {
              setDetectedChapters(completedJob.result.chapters || []);
              setActiveJob(completedJob);
            }
            
            // Check for failed job
            const failedJob = jobs.find((job: ProcessingJob) => 
              job.status === 'failed'
            );
            if (failedJob) {
              setActiveJob(failedJob);
              setError(failedJob.errorMessage || 'Processing job failed. Please try uploading again.');
            }
            
            // Stop polling if no active jobs
            if (jobPollingRef.current) {
              clearInterval(jobPollingRef.current);
            }
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const bookData = {
        ...formData,
        estimatedReadingTimeMinutes: parseInt(String(formData.estimatedReadingTimeMinutes)),
        publicationDate: formData.publicationDate || null,
        coverImageUrl: formData.coverImageUrl || null,
      };

      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(bookData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update book');
      }

      const updatedBook = await response.json();
      setBook(updatedBook);
      setSuccess('Book updated successfully!');
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const docxFile = files.find(file => 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx')
    );
    
    if (docxFile) {
      handleFileUpload(docxFile);
    } else {
      setError('Please upload a .docx file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch(`/api/admin/books/${bookId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      setSuccess(`Document "${file.name}" uploaded successfully!`);
      
      // Reload book sources
      await loadBookSources();
      
      // Start parsing
      await startParsing(result.bookSource.id);
      
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Cover image upload function
  const handleCoverUploadComplete = async (imageUrl: string) => {
    try {
      // Update form data with the image URL
      setFormData(prev => ({ ...prev, coverImageUrl: imageUrl }));
      setSuccess('Cover image uploaded successfully! Click "Save Changes" to apply.');
    } catch (error) {
      console.error('Error handling cover upload completion:', error);
      setError('Failed to process uploaded cover image');
    }
  };

  const startParsing = async (bookSourceId: number) => {
    try {
      const response = await fetch(`/api/admin/parsing/start/${bookSourceId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start parsing');
      }

      const job = await response.json();
      setActiveJob(job);
      startJobPolling(bookSourceId);
      
      // Switch to chapters tab to show progress
      setActiveTab('chapters');
      
    } catch (err: any) {
      setError(err.message || 'Failed to start processing');
    }
  };

  const approveChapters = async () => {
    if (!activeJob?.result) return;
    
    try {
      const response = await fetch(`/api/admin/books/${bookId}/chapters/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          chapters: detectedChapters,
          jobId: activeJob.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create chapters');
      }

      setSuccess('Chapters created successfully!');
      setTimeout(() => {
        router.push(`/admin/books/${bookId}/chapters`);
      }, 1500);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create chapters');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <div className="ml-4 text-gray-500">Loading book...</div>
        </div>
      </div>
    );
  }

  if (error && !book) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">📚 Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  api.logout().then(() => router.push('/admin/login')).catch(() => router.push('/admin/login'));
                }}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 py-4">
            <Link
              href="/admin/dashboard"
              className="text-indigo-200 hover:text-white font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/books"
              className="text-white font-semibold border-b-2 border-white pb-1"
            >
              Books
            </Link>
            <Link
              href="/admin/access-codes"
              className="text-indigo-200 hover:text-white font-medium"
            >
              Access Codes
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/admin/books"
              className="text-indigo-600 hover:text-indigo-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" />
              </svg>
              Back to Books
            </Link>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manage Book</h2>
              <p className="text-gray-600 mt-2">Edit details, upload manuscripts, and manage chapters</p>
            </div>
            {book && (
              <Link
                href={`/admin/books/${bookId}/chapters`}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 2H4v8h12V6z" />
                </svg>
                View Chapters
              </Link>
            )}
          </div>
        </div>

        {/* Global Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
            </svg>
            {success}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('edit')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'edit'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📝 Book Details
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'upload'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📄 Upload Manuscript
              </button>
              <button
                onClick={() => setActiveTab('chapters')}
                className={`py-4 px-1 border-b-2 font-medium text-sm relative ${
                  activeTab === 'chapters'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📖 Chapter Processing
                {activeJob && (activeJob.status === 'running' || activeJob.status === 'pending') && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full animate-pulse"></span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'edit' && (
          <div className="bg-white rounded-lg shadow-md">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter book title"
                  />
                </div>

                <div>
                  <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-2">
                    Author *
                  </label>
                  <input
                    id="author"
                    name="author"
                    type="text"
                    value={formData.author}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter author name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter book description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                    Language *
                  </label>
                  <select
                    id="language"
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="Spanish">Spanish</option>
                    <option value="Spanish (Mexico)">Spanish (Mexico)</option>
                    <option value="Spanish (Argentina)">Spanish (Argentina)</option>
                    <option value="Spanish (Colombia)">Spanish (Colombia)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="difficultyLevel" className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty Level *
                  </label>
                  <select
                    id="difficultyLevel"
                    name="difficultyLevel"
                    value={formData.difficultyLevel}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Elementary">Elementary</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Upper-Intermediate">Upper-Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="estimatedReadingTimeMinutes" className="block text-sm font-medium text-gray-700 mb-2">
                    Reading Time (minutes) *
                  </label>
                  <input
                    id="estimatedReadingTimeMinutes"
                    name="estimatedReadingTimeMinutes"
                    type="number"
                    min="1"
                    max="180"
                    value={formData.estimatedReadingTimeMinutes}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Cover Image Section */}
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Book Cover Image
                </label>
                
                {/* Current Cover Preview */}
                {formData.coverImageUrl && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Current cover:</p>
                    <div className="relative inline-block">
                      <img 
                        src={formData.coverImageUrl} 
                        alt="Book cover preview"
                        className="w-32 h-48 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, coverImageUrl: '' }))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload New Cover */}
                <div className="space-y-4">
                  <LocalImageUploader
                    onUploadComplete={handleCoverUploadComplete}
                    acceptedFileTypes={['image/png', 'image/jpeg', 'image/webp']}
                    maxFileSize={5 * 1024 * 1024} // 5MB
                    className="border-2 border-dashed border-gray-300 rounded-lg"
                  />
                  
                  <div className="text-center text-gray-500 text-sm">or</div>
                  
                  {/* Fallback URL Input */}
                  <div>
                    <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                      Enter Image URL Manually
                    </label>
                    <input
                      id="coverImageUrl"
                      name="coverImageUrl"
                      type="url"
                      value={formData.coverImageUrl}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="https://example.com/cover.jpg"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="publicationDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Publication Date
                  </label>
                  <input
                    id="publicationDate"
                    name="publicationDate"
                    type="date"
                    value={formData.publicationDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {book && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Book Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Book ID:</span>
                      <span className="ml-2 font-mono">{book.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <span className="ml-2">{book.createdAt ? new Date(book.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Updated:</span>
                      <span className="ml-2">{book.updatedAt ? new Date(book.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-6">
                <Link
                  href="/admin/books"
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Update Book'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-8">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Manuscript</h3>
              <p className="text-gray-600 mb-6">
                Upload a Word document (.docx) containing your Spanish storybook manuscript. 
                Our AI will automatically detect chapters and prepare the content for publication.
              </p>

              {/* Drag & Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-indigo-400'
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-lg font-medium text-gray-900">Uploading manuscript...</p>
                    <p className="text-gray-500">This may take a few moments</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Drop your .docx file here, or{' '}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-indigo-600 hover:text-indigo-700 underline"
                      >
                        browse to upload
                      </button>
                    </p>
                    <p className="text-gray-500">
                      Maximum file size: 50MB | Supported: Word documents (.docx)
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Upload History */}
            {bookSources.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload History</h3>
                <div className="space-y-4">
                  {bookSources.map((source) => (
                    <div key={source.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            source.status === 'processed' ? 'bg-green-500' :
                            source.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                            source.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                          }`}></div>
                          <div>
                            <p className="font-medium text-gray-900">{source.originalFileName}</p>
                            <p className="text-sm text-gray-500">
                              {(source.fileSize / 1024 / 1024).toFixed(2)} MB • 
                              Uploaded {new Date(source.createdAt).toLocaleDateString()} by {source.uploadedByAdmin}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            source.status === 'processed' ? 'bg-green-100 text-green-800' :
                            source.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            source.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {source.status}
                          </span>
                          {source.status === 'uploaded' && (
                            <button
                              onClick={() => startParsing(source.id)}
                              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                            >
                              Start Processing
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chapters' && (
          <div className="space-y-8">
            {/* Processing Status */}
            {activeJob && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">AI Processing Status</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {activeJob.status === 'pending' ? 'Preparing to process...' :
                       activeJob.status === 'running' ? 'Processing manuscript...' :
                       activeJob.status === 'completed' ? 'Processing completed!' :
                       'Processing failed'}
                    </span>
                    <span className="text-sm text-gray-500">{activeJob.progress}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        activeJob.status === 'completed' ? 'bg-green-500' :
                        activeJob.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${activeJob.progress}%` }}
                    ></div>
                  </div>
                  
                  {activeJob.message && (
                    <p className="text-sm text-gray-600">{activeJob.message}</p>
                  )}
                  
                  {activeJob.errorMessage && (
                    <p className="text-sm text-red-600">{activeJob.errorMessage}</p>
                  )}
                </div>
              </div>
            )}

            {/* Detected Chapters */}
            {detectedChapters.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Detected Chapters</h3>
                    <p className="text-gray-600">
                      Our AI found {detectedChapters.length} chapters in your manuscript. 
                      Review and approve to create the final book structure.
                    </p>
                  </div>
                  <button
                    onClick={approveChapters}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    ✓ Approve All Chapters
                  </button>
                </div>

                <div className="space-y-4">
                  {detectedChapters.map((chapter, index) => (
                    <div key={chapter.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            Chapter {chapter.indexInBook}: {chapter.title}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {chapter.wordCount} words
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          Detected
                        </span>
                      </div>
                      
                      {chapter.preview && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-700 italic">
                            "{chapter.preview.substring(0, 200)}..."
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!activeJob && detectedChapters.length === 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Processing Active</h3>
                <p className="text-gray-600">
                  Upload a manuscript to start the AI processing and chapter detection.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}