'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Book {
  id: string;
  title: string;
  author: string;
}

interface Chapter {
  id: string;
  bookId: string;
  title: string;
  indexInBook: number;
  audioUrl?: string;
  jsonUrl?: string;
  duration?: number;
  createdAt: string;
}

// Shared helper to safely decode chapter JSON with UTF-8 support
async function getChapterJson(jsonUrl: string): Promise<any> {
  if (!jsonUrl.startsWith('data:application/json') || !jsonUrl.includes(';base64,')) {
    throw new Error('Invalid JSON URL format');
  }
  // Use fetch to properly decode the data URL with UTF-8 support
  const response = await fetch(jsonUrl);
  return await response.json();
}

// Component to preview Spanish content from base64 JSON
function ChapterContentPreview({ jsonUrl }: { jsonUrl: string }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parseContent = async () => {
      try {
        const parsedData = await getChapterJson(jsonUrl);
        
        // Try multiple approaches to extract content, preserving formatting
        let extractedContent = '';
        
        // Method 1: Extract from paragraphs array (new format with formatting)
        if (parsedData.content?.paragraphs && Array.isArray(parsedData.content.paragraphs)) {
          extractedContent = parsedData.content.paragraphs
            .map((paragraph: any) => paragraph.text || paragraph)
            .filter(text => text && text.trim())
            .join('\n\n'); // Join paragraphs with double line breaks
        }
        
        // Method 2: Extract from sentences array (legacy format)
        if (!extractedContent && parsedData.content?.sentences && Array.isArray(parsedData.content.sentences)) {
          extractedContent = parsedData.content.sentences
            .map((sentence: any) => sentence.text || sentence)
            .filter(text => text && text.trim())
            .join(' ');
        }
        
        // Method 3: Extract from words array (alternative format)
        if (!extractedContent && parsedData.words && Array.isArray(parsedData.words)) {
          extractedContent = parsedData.words
            .map((word: any) => word.original || word.text || word)
            .filter(text => text && text.trim())
            .join(' ');
        }
        
        // Method 4: Look for any direct content field
        if (!extractedContent && parsedData.content && typeof parsedData.content === 'string') {
          extractedContent = parsedData.content;
        }
        
        // Method 5: Look for text at root level
        if (!extractedContent && parsedData.text && typeof parsedData.text === 'string') {
          extractedContent = parsedData.text;
        }
        
        if (extractedContent) {
          setContent(extractedContent);
        } else if (parsedData.title) {
          setContent('Chapter created - ready for manual content entry');
        } else {
          setContent('Chapter structure ready - you can add content manually');
        }
      } catch (error) {
        console.log('Content parsing info:', error);
        // More graceful handling - likely means content needs to be entered manually
        setContent('Ready for manual content entry - use the edit button to add Spanish text');
      } finally {
        setLoading(false);
      }
    };

    parseContent();
  }, [jsonUrl]);

  if (loading) {
    return <span className="italic text-gray-400">Loading content...</span>;
  }

  return (
    <div className="bg-blue-50 p-3 rounded border">
      <div className="text-sm font-medium text-blue-800 mb-1">📖 Spanish Content:</div>
      <div className="text-blue-700 italic whitespace-pre-line">
        {content.length > 100 ? `${content.substring(0, 100)}...` : content}
      </div>
    </div>
  );
}

// Student Reading Experience Preview - Shows exactly what students see
function DetailedChapterPreview({ chapter }: { chapter: Chapter }) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [hoveredWord, setHoveredWord] = useState<{ word: Word; translation?: string; loading?: boolean } | null>(null);
  const [translationCache, setTranslationCache] = useState<Map<string, string>>(new Map());
  
  const audioRef = useRef<HTMLAudioElement>(null);

  interface Word {
    text: string;
    translation: string;
    start?: number;
    end?: number;
  }

  useEffect(() => {
    const parseContent = async () => {
      try {
        if (chapter.jsonUrl?.startsWith('data:application/json') && chapter.jsonUrl.includes(';base64,')) {
          const parsedData = await getChapterJson(chapter.jsonUrl);
          
          
          // First check for paragraphs array (new format with formatting)
          if (parsedData.content?.paragraphs && Array.isArray(parsedData.content.paragraphs)) {
            // Extract words from all paragraphs while preserving all line breaks
            const words: Word[] = [];
            let wordIndex = 0;
            
            parsedData.content.paragraphs.forEach((paragraph: any, pIndex: number) => {
              // Split paragraph text by single line breaks to preserve them
              const lines = paragraph.text.split(/\r?\n/);
              
              lines.forEach((line: string, lineIndex: number) => {
                // Split each line into words
                if (line.trim()) {
                  const lineWords = line.trim().split(/\s+/);
                  lineWords.forEach((word: string) => {
                    words.push({
                      text: word,
                      translation: word, // Simple fallback
                      start: wordIndex * 0.5,
                      end: (wordIndex + 1) * 0.5
                    });
                    wordIndex++;
                  });
                }
                
                // Add line break if not the last line in paragraph
                if (lineIndex < lines.length - 1) {
                  words.push({
                    text: '\n', // Single line break
                    translation: '',
                    start: wordIndex * 0.5,
                    end: (wordIndex + 1) * 0.5
                  });
                  wordIndex++;
                }
              });
              
              // Add paragraph break marker if not the last paragraph
              if (pIndex < parsedData.content.paragraphs.length - 1) {
                words.push({
                  text: '\n\n', // Paragraph break
                  translation: '',
                  start: wordIndex * 0.5,
                  end: (wordIndex + 1) * 0.5
                });
                wordIndex++;
              }
            });
            
            setContent({
              title: parsedData.title || chapter.title,
              content: words
            });
          } else if (parsedData.words && Array.isArray(parsedData.words)) {
            const words: Word[] = parsedData.words.map((word: any, index: number) => ({
              text: word.original || word.text, // Use 'original' which has punctuation
              translation: word.definition?.english || word.text,
              start: word.start_time ?? (index * 0.5),
              end: word.end_time ?? ((index + 1) * 0.5)
            }));
            
            setContent({
              title: parsedData.title || chapter.title,
              content: words
            });
          } else if (parsedData.content?.sentences) {
            // Extract words from sentences and create a flat array
            const words: Word[] = [];
            let wordIndex = 0;
            
            parsedData.content.sentences.forEach((sentence: any) => {
              if (sentence.words) {
                sentence.words.forEach((word: any) => {
                  // Include all words, including punctuation
                  words.push({
                    text: word.text,
                    translation: word.definition?.english || word.text,
                    // Use actual timestamps if available, otherwise create evenly spaced timestamps
                    start: word.audioTimestamp?.start ?? (wordIndex * 0.5),
                    end: word.audioTimestamp?.end ?? ((wordIndex + 1) * 0.5)
                  });
                  wordIndex++;
                });
              } else {
                // Fallback: split sentence text but preserve punctuation
                const sentenceText = sentence.text;
                // Split on word boundaries but keep punctuation attached
                const wordMatches = sentenceText.match(/\S+/g) || [];
                wordMatches.forEach((wordText: string) => {
                  words.push({
                    text: wordText,
                    translation: wordText, // No translation available
                    start: wordIndex * 0.5,
                    end: (wordIndex + 1) * 0.5
                  });
                  wordIndex++;
                });
              }
            });
            
            setContent({
              title: parsedData.title || chapter.title,
              content: words
            });
          } else {
            // Fallback to demo content
            setContent({
              title: chapter.title,
              content: [
                { text: 'Hola', translation: 'Hello', start: 0, end: 0.5 },
                { text: 'mi', translation: 'my', start: 0.5, end: 1.0 },
                { text: 'nombre', translation: 'name', start: 1.0, end: 1.5 },
                { text: 'es', translation: 'is', start: 1.5, end: 2.0 },
                { text: 'María.', translation: 'María.', start: 2.0, end: 2.5 }
              ]
            });
          }
        } else {
          // No jsonUrl, use demo content
          setContent({
            title: chapter.title,
            content: [
              { text: 'Demo', translation: 'Demo', start: 0, end: 0.5 },
              { text: 'content', translation: 'content', start: 0.5, end: 1.0 },
              { text: 'for', translation: 'for', start: 1.0, end: 1.5 },
              { text: 'preview', translation: 'preview', start: 1.5, end: 2.0 }
            ]
          });
        }
      } catch (error) {
        console.error('Error parsing chapter content:', error);
        // Error fallback
        setContent({
          title: chapter.title,
          content: [
            { text: 'Error', translation: 'Error', start: 0, end: 0.5 },
            { text: 'loading', translation: 'loading', start: 0.5, end: 1.0 },
            { text: 'content', translation: 'content', start: 1.0, end: 1.5 }
          ]
        });
      } finally {
        setLoading(false);
      }
    };

    parseContent();
  }, [chapter.jsonUrl]);

  // Audio time update handler for word highlighting
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      // Find current word based on audio time
      if (content?.content) {
        const currentWord = content.content.findIndex((word: Word) => {
          const startTime = word.start || 0;
          const endTime = word.end || (word.start + 0.5); // Use word's end time, not next word's start
          return audio.currentTime >= startTime && audio.currentTime < endTime;
        });
        setCurrentWordIndex(currentWord >= 0 ? currentWord : -1);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentWordIndex(-1);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [content, duration]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Audio playback failed:', error);
        setIsPlaying(false);
        // Could show a user-friendly error message here if needed
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Fetch translation with caching (using frontend API route)
  const fetchTranslation = async (word: string): Promise<string> => {
    // Check local cache first
    if (translationCache.has(word.toLowerCase())) {
      return translationCache.get(word.toLowerCase())!;
    }

    try {
      // Use frontend API route for same-origin request with proper auth handling
      const response = await fetch(`/api/words/translate/${encodeURIComponent(word)}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const translation = data.english;
        console.log(`✅ Translated "${word}" → "${translation}"`);
        // Cache the translation locally
        setTranslationCache(prev => new Map(prev.set(word.toLowerCase(), translation)));
        return translation;
      } else if (response.status === 401) {
        console.log('Admin authentication required for translations');
        return 'Admin login required';
      } else if (response.status === 404) {
        console.log('Translation API not found');
        return 'Translation unavailable';
      } else {
        const errorText = await response.text();
        console.error(`Translation API error ${response.status}:`, errorText);
        return 'Translation error';
      }
    } catch (error) {
      console.error('Translation fetch error:', error);
      return 'Network error';
    }
  };

  const handleWordHover = async (word: Word) => {
    if (!word.text || word.text === '\n' || word.text === '\n\n') return;
    
    setHoveredWord({ word, loading: true });
    
    try {
      const translation = await fetchTranslation(word.text);
      setHoveredWord({ word, translation, loading: false });
    } catch (error) {
      setHoveredWord({ word, translation: word.text, loading: false });
    }
  };

  const handleWordLeave = () => {
    setHoveredWord(null);
  };

  const handleWordClick = (word: Word, index: number) => {
    setSelectedWord({ ...word, index });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!content || !content.content || !Array.isArray(content.content)) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">
          <p>No processed content available for this chapter</p>
          <p className="text-sm mt-2">Upload a Word document to generate interactive content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header - Student View */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  Preview Mode
                </span>
                <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Chapter {chapter.indexInBook}
                </span>
                <h1 className="text-xl font-bold text-gray-900">{chapter.title}</h1>
              </div>
            </div>
            <nav className="flex items-center space-x-4">
              <span className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2">
                <span>🎯</span>
                <span>Practice Activities</span>
              </span>
              <span className="text-gray-600 text-sm font-medium">Word Bank</span>
              <span className="text-gray-600 text-sm font-medium">Library</span>
            </nav>
          </div>
        </div>
      </header>

      {/* Audio Player - Student Experience */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlayPause}
              className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
              )}
            </button>

            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={chapter.audioUrl ? (chapter.audioUrl.startsWith('http') ? chapter.audioUrl : `/audio/${chapter.audioUrl.replace(/^\/?(audio\/)?/, '')}`) : ''}
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={(e) => {
                console.error('Audio loading error:', e);
                setIsPlaying(false);
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Reading Area - Student Experience */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{content.title}</h2>
          
          <div className="text-lg leading-relaxed space-y-2">
            {content.content.map((word: Word, index: number) => {
              // Handle line break tokens specially
              if (word.text === '\n') {
                return <br key={index} />;
              } else if (word.text === '\n\n') {
                return <div key={index} className="my-4"></div>; // Paragraph break with spacing
              } else {
                return (
                  <span
                    key={index}
                    onClick={() => handleWordClick(word, index)}
                    onMouseEnter={() => handleWordHover(word)}
                    onMouseLeave={handleWordLeave}
                    className={`
                      relative inline-block mx-1 px-1 py-0.5 rounded cursor-pointer transition-all duration-200
                      hover:bg-blue-100 hover:shadow-sm
                      ${index === currentWordIndex ? 'bg-yellow-200 shadow-md' : ''}
                      ${selectedWord?.index === index ? 'bg-blue-200 shadow-md' : ''}
                    `}
                    title={`Hover for translation, click to save`}
                  >
                    {word.text}
                    {/* Translation tooltip on hover */}
                    {hoveredWord?.word === word && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-10 whitespace-nowrap pointer-events-none">
                        <div className="font-medium">{word.text}</div>
                        <div className="text-blue-200">
                          {hoveredWord.loading ? (
                            <span className="flex items-center space-x-1">
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Translating...</span>
                            </span>
                          ) : (
                            hoveredWord.translation
                          )}
                        </div>
                        {/* Tooltip arrow */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </span>
                );
              }
            })}
          </div>
        </div>

        {/* Practice Activities Call-to-Action - Student View */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 mb-8 border border-green-200">
          <div className="text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Ready to Practice?
            </h3>
            <p className="text-lg text-gray-600 mb-6">
              Test your understanding with interactive activities including flashcards, comprehension questions, matching exercises, and writing prompts.
            </p>
            <div className="inline-flex items-center px-8 py-4 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700 transition-all transform hover:scale-105 shadow-lg cursor-pointer">
              <span className="mr-2">🎯</span>
              Start Practice Activities
              <svg className="w-5 h-5 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Navigation - Student View */}
        <div className="flex justify-between items-center">
          <div>
            <div className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg font-medium cursor-pointer">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
              </svg>
              Previous Chapter
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="inline-flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-medium cursor-pointer">
              <span className="mr-2">🎯</span>
              Activities
            </div>
            
            <div className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium cursor-pointer">
              Next Chapter
              <svg className="w-5 h-5 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Word Definition Modal - Student Experience */}
      {selectedWord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedWord.text}</h3>
              <p className="text-lg text-gray-600">{selectedWord.translation}</p>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={() => setSelectedWord(null)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Close
              </button>
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save to Word Bank
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChapterManagementPage() {
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioGenMessage, setAudioGenMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [deleteChapterId, setDeleteChapterId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewingChapter, setPreviewingChapter] = useState<Chapter | null>(null);
  
  const [chapterForm, setChapterForm] = useState({
    title: '',
    indexInBook: 1,
    content: '',
    audioUrl: '',
    duration: 0,
  });

  const router = useRouter();
  const params = useParams();
  const bookId = params.bookId as string;

  useEffect(() => {
    if (bookId) {
      loadBookAndChapters();
    }
  }, [bookId]);

  const loadBookAndChapters = async () => {
    try {
      // Load book details
      const bookResponse = await fetch(`/api/admin/books/${bookId}`, {
        credentials: 'include',
      });
      
      if (!bookResponse.ok) {
        if (bookResponse.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error('Failed to load book');
      }

      const bookData = await bookResponse.json();
      setBook(bookData);

      // Load chapters
      const chaptersResponse = await fetch(`/api/admin/books/${bookId}/chapters`, {
        credentials: 'include',
      });
      
      if (!chaptersResponse.ok) {
        throw new Error('Failed to load chapters');
      }

      const chaptersData = await chaptersResponse.json();
      setChapters(chaptersData.chapters.sort((a: Chapter, b: Chapter) => a.indexInBook - b.indexInBook));
      
      // Set next chapter index
      const maxIndex = chaptersData.chapters.reduce((max: number, ch: Chapter) => Math.max(max, ch.indexInBook), 0);
      setChapterForm(prev => ({ ...prev, indexInBook: maxIndex + 1 }));
      
    } catch (err) {
      setError('Failed to load book or chapters');
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    // Extract text content for TTS generation
    let textContent = '';
    
    if (editingChapter && editingChapter.jsonUrl?.startsWith('data:application/json;base64,')) {
      // For existing chapters, extract text from structured JSON content
      try {
        const parsedData = await getChapterJson(editingChapter.jsonUrl);
        
        if (parsedData.content?.sentences) {
          textContent = parsedData.content.sentences
            .map((sentence: any) => sentence.text)
            .join(' ');
        }
      } catch (error) {
        console.error('Error extracting text from chapter content:', error);
      }
    } else {
      // For new chapters, use form content
      textContent = chapterForm.content;
    }

    if (!textContent || textContent.trim().length === 0) {
      setAudioGenMessage('Please enter chapter content first');
      return;
    }

    setGeneratingAudio(true);
    setAudioGenMessage('');

    try {
      // Always use current form values for chapter ID to respect user changes
      const chapterId = `chapter_${chapterForm.indexInBook}`;
      
      const response = await fetch('/api/tts/generate-spanish-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: textContent,
          bookId: bookId,
          chapterId: chapterId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update the form with the generated audio URL and duration
        setChapterForm(prev => ({
          ...prev,
          audioUrl: data.audioUrl,
          duration: data.duration,
        }));
        setAudioGenMessage('✅ Spanish audio generated successfully!');
      } else {
        throw new Error(data.error || 'Failed to generate audio');
      }
    } catch (error: any) {
      console.error('Audio generation error:', error);
      setAudioGenMessage(`❌ Error: ${error.message}`);
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const chapterData = {
        ...(editingChapter?.id && { id: editingChapter.id }),
        title: chapterForm.title,
        content: chapterForm.content,
        indexInBook: parseInt(String(chapterForm.indexInBook)),
        audioUrl: chapterForm.audioUrl || null,
      };

      let response;
      
      if (editingChapter) {
        // Update existing chapter
        response = await fetch(`/api/admin/chapters/${editingChapter.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          credentials: 'include',
          body: JSON.stringify(chapterData),
        });
      } else {
        // Create new chapter
        response = await fetch(`/api/admin/books/${bookId}/chapters`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          credentials: 'include',
          body: JSON.stringify(chapterData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to save chapter');
      }

      setShowCreateModal(false);
      setEditingChapter(null);
      setChapterForm({
        title: '',
        indexInBook: chapters.length + 1,
        content: '',
        audioUrl: '',
        duration: 0,
      });
      setSuccess(editingChapter ? 'Chapter updated successfully!' : 'Chapter created successfully!');
      loadBookAndChapters();
    } catch (err: any) {
      setError(err.message || 'Failed to save chapter');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/chapters/${chapterId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete chapter');
      }

      setChapters(chapters.filter(ch => ch.id !== chapterId));
      setDeleteChapterId(null);
      setSuccess('Chapter deleted successfully!');
    } catch (err) {
      setError('Failed to delete chapter');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setChapterForm({
      title: '',
      indexInBook: chapters.length + 1,
      content: '',
      audioUrl: '',
      duration: 0,
    });
    setEditingChapter(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading chapters...</div>
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
                onClick={async () => {
                  try {
                    await api.logout();
                    router.push('/admin/login');
                  } catch { router.push('/admin/login'); }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <span className="text-gray-500">→</span>
            <Link
              href={`/admin/books/${bookId}`}
              className="text-indigo-600 hover:text-indigo-700"
            >
              Edit Book
            </Link>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manage Chapters</h2>
              {book && (
                <p className="text-gray-600 mt-2">
                  Managing chapters for "{book.title}" by {book.author}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href={`/admin/books/${bookId}/access-codes`}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
              >
                🎫 Generate Access Codes
              </Link>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                </svg>
                Add Chapter
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}


        {/* Chapters List */}  
        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-500">Loading chapters...</div>
          </div>
        ) : chapters.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Chapters ({chapters.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {chapters.map((chapter) => (
                <div key={chapter.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium">
                          Chapter {chapter.indexInBook}
                        </span>
                        <h4 className="text-lg font-medium text-gray-900">{chapter.title}</h4>
                      </div>
                      <div className="text-gray-600 text-sm mb-2">
                        {chapter.jsonUrl ? (
                          <ChapterContentPreview jsonUrl={chapter.jsonUrl} />
                        ) : (
                          <span className="italic text-gray-400">No content available</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {chapter.audioUrl && (
                          <span className="flex items-center">
                            🎵 Audio available
                          </span>
                        )}
                        {chapter.duration && (
                          <span>{chapter.duration} seconds</span>
                        )}
                        <span>Created {new Date(chapter.createdAt).toISOString().slice(0, 10)}</span>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Link
                        href={`/admin/books/${book?.id}/chapters/${chapter.id}/activities`}
                        className="px-3 py-1 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
                      >
                        Activities
                      </Link>
                      <button
                        onClick={() => setPreviewingChapter(chapter)}
                        className="px-3 py-1 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
                      >
                        Preview
                      </button>
                      <button
                        onClick={async () => {
                          setEditingChapter(chapter);
                          
                          // Extract Spanish content if available
                          let spanishContent = '';
                          if (chapter.jsonUrl?.startsWith('data:application/json') && chapter.jsonUrl.includes(';base64,')) {
                            try {
                              const parsedData = await getChapterJson(chapter.jsonUrl);
                              
                              // Try to extract from paragraphs first (preserves formatting)
                              if (parsedData.content?.paragraphs) {
                                spanishContent = parsedData.content.paragraphs
                                  .map((paragraph: any) => paragraph.text)
                                  .join('\n\n');
                              } else if (parsedData.content?.sentences) {
                                spanishContent = parsedData.content.sentences
                                  .map((sentence: any) => sentence.text)
                                  .join(' ');
                              }
                            } catch (error) {
                              console.warn('Failed to extract Spanish content for editing:', error);
                            }
                          }
                          
                          setChapterForm({
                            title: chapter.title,
                            indexInBook: chapter.indexInBook,
                            content: spanishContent,
                            audioUrl: chapter.audioUrl || '',
                            duration: chapter.duration || 0,
                          });
                          setShowCreateModal(true);
                        }}
                        className="px-3 py-1 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteChapterId(chapter.id)}
                        className="px-3 py-1 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📖</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No chapters yet</h3>
            <p className="text-gray-600 mb-4">Start building your story by adding the first chapter.</p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
            >
              Add First Chapter
            </button>
          </div>
        )}
      </div>

      {/* Chapter Preview Modal */}
      {previewingChapter && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Chapter Preview</h3>
              <button
                onClick={() => setPreviewingChapter(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <DetailedChapterPreview chapter={previewingChapter} />
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Chapter Modal - Only mount when actually open */}
      {showCreateModal ? (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingChapter ? 'Edit Chapter' : 'Add New Chapter'}
            </h3>
            
            <form onSubmit={handleCreateChapter} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="chapterTitle" className="block text-sm font-medium text-gray-700 mb-2">
                    Chapter Title *
                  </label>
                  <input
                    id="chapterTitle"
                    type="text"
                    value={chapterForm.title}
                    onChange={(e) => setChapterForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter chapter title"
                  />
                </div>

                <div>
                  <label htmlFor="chapterIndex" className="block text-sm font-medium text-gray-700 mb-2">
                    Chapter Number *
                  </label>
                  <input
                    id="chapterIndex"
                    type="number"
                    min="1"
                    value={chapterForm.indexInBook}
                    onChange={(e) => setChapterForm(prev => ({ ...prev, indexInBook: parseInt(e.target.value) || 1 }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="chapterContent" className="block text-sm font-medium text-gray-700 mb-2">
                  Chapter Content *
                </label>
                <textarea
                  id="chapterContent"
                  value={chapterForm.content}
                  onChange={(e) => setChapterForm(prev => ({ ...prev, content: e.target.value }))}
                  required
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter the chapter content in Spanish..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="audioUrl" className="block text-sm font-medium text-gray-700">
                      Audio URL (optional)
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAudio}
                      disabled={!chapterForm.content || generatingAudio}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {generatingAudio ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12 9a1 1 0 011.414 0L15 10.586l1.586-1.586a1 1 0 011.414 1.414L16.414 12 18 13.586a1 1 0 01-1.414 1.414L15 13.414l-1.586 1.586a1 1 0 01-1.414-1.414L13.586 12 12 10.414A1 1 0 0112 9z" />
                          </svg>
                          Generate Audio
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    id="audioUrl"
                    type="text"
                    value={chapterForm.audioUrl}
                    onChange={(e) => setChapterForm(prev => ({ ...prev, audioUrl: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="https://example.com/audio.mp3 or audio/book/chapter.mp3"
                  />
                  {audioGenMessage && (
                    <p className={`text-xs mt-1 ${audioGenMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                      {audioGenMessage}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (seconds)
                  </label>
                  <input
                    id="duration"
                    type="number"
                    min="0"
                    value={chapterForm.duration}
                    onChange={(e) => setChapterForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Audio duration in seconds"
                  />
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  disabled={creating}
                >
                  {creating ? 'Saving...' : editingChapter ? 'Update Chapter' : 'Create Chapter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete Confirmation Modal - Only mount when actually open */}
      {deleteChapterId ? (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Chapter</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this chapter? This action cannot be undone.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setDeleteChapterId(null)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteChapterId && handleDeleteChapter(deleteChapterId)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}