'use client';

import { useState, useEffect, useRef } from 'react';

interface Word {
  text: string;
  translation: string;
  start?: number;
  end?: number;
}

interface Chapter {
  id: string;
  title: string;
  audioUrl: string;
  jsonUrl: string;
}

interface InteractiveReaderProps {
  chapter: Chapter;
  bookId?: string;
}

export default function InteractiveReader({ chapter, bookId }: InteractiveReaderProps) {
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

  // Helper function to parse JSON content with proper UTF-8 decoding
  const getChapterJson = async (jsonUrl: string) => {
    if (jsonUrl?.startsWith('data:application/json') && jsonUrl.includes(';base64,')) {
      const base64Data = jsonUrl.split(';base64,')[1];
      
      // Properly decode base64 to bytes then to UTF-8 string
      try {
        const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(bytes);
        return JSON.parse(jsonString);
      } catch (error) {
        console.error('Error decoding chapter content:', error);
        // Fallback to simple atob
        const jsonString = atob(base64Data);
        return JSON.parse(jsonString);
      }
    }
    return null;
  };

  useEffect(() => {
    const parseContent = async () => {
      try {
        if (chapter.jsonUrl?.startsWith('data:application/json') && chapter.jsonUrl.includes(';base64,')) {
          const parsedData = await getChapterJson(chapter.jsonUrl);
          
          // Check for paragraphs array (new format with formatting)
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
              
              // Add paragraph break if not the last paragraph
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

            // Override with actual timing data if available
            if (parsedData.timingData && Array.isArray(parsedData.timingData)) {
              parsedData.timingData.forEach((timing: any, index: number) => {
                if (words[index] && typeof timing.start_time === 'number' && typeof timing.end_time === 'number') {
                  words[index].start = timing.start_time;
                  words[index].end = timing.end_time;
                }
              });
            }
            
            setContent({ ...parsedData, content: words });
          } else if (parsedData.content && Array.isArray(parsedData.content)) {
            // Fallback for simple word array format
            setContent(parsedData);
          }
        }
      } catch (error) {
        console.error('Error parsing chapter content:', error);
      } finally {
        setLoading(false);
      }
    };

    parseContent();
  }, [chapter]);

  // Audio event handlers
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
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const fetchTranslation = async (word: string): Promise<{ translation: string; wasInstant: boolean }> => {
    const cleanWord = word.toLowerCase().trim().replace(/[^a-záéíóúñü]/g, '');
    
    // Check local cache first
    if (translationCache.has(cleanWord)) {
      return { 
        translation: translationCache.get(cleanWord)!, 
        wasInstant: true 
      };
    }

    try {
      const response = await fetch(`/api/words/translate/${encodeURIComponent(cleanWord)}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const translation = data.english;
        const wasInstant = data.cached || false; // Backend indicates if it was cached
        
        // Cache the translation locally for faster subsequent access
        setTranslationCache(prev => new Map(prev.set(cleanWord, translation)));
        
        return { translation, wasInstant };
      } else {
        return { translation: 'Translation unavailable', wasInstant: false };
      }
    } catch (error) {
      console.error('Translation error:', error);
      return { translation: 'Translation error', wasInstant: false };
    }
  };

  const handleWordHover = async (word: Word) => {
    if (word.text === '\n' || word.text === '\n\n' || !word.text.trim()) return;
    
    const cleanWord = word.text.toLowerCase().trim().replace(/[^a-záéíóúñü]/g, '');
    
    // For cached translations, show immediately without loading state
    if (translationCache.has(cleanWord)) {
      setHoveredWord({ 
        word, 
        translation: translationCache.get(cleanWord)!, 
        loading: false 
      });
      return;
    }
    
    // Only show loading for non-cached words
    setHoveredWord({ word, loading: true });
    const result = await fetchTranslation(word.text);
    setHoveredWord({ 
      word, 
      translation: result.translation, 
      loading: false 
    });
  };

  const handleWordLeave = () => {
    setHoveredWord(null);
  };

  const handleWordClick = async (word: Word, index: number) => {
    if (word.text === '\n' || word.text === '\n\n') return;
    
    // Get the translation for the clicked word
    const cleanWord = word.text.toLowerCase().trim().replace(/[^a-záéíóúñü]/g, '');
    if (!cleanWord) return;
    
    // Get translation (from cache or fetch)
    let translation = translationCache.get(cleanWord);
    if (!translation) {
      const result = await fetchTranslation(word.text);
      translation = result.translation;
    }
    
    if (!translation || translation === 'Translation unavailable') {
      console.warn('Cannot save word without valid translation:', cleanWord);
      return;
    }
    
    try {
      // Save the word to user's word bank
      const response = await fetch('/api/words/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          spanishWord: cleanWord,
          englishTranslation: translation,
          bookId: bookId || 'EspanolBook1', // Use current book ID
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Word saved to word bank:', cleanWord, '→', translation);
        
        // Show success feedback
        setSelectedWord({ 
          ...word, 
          index, 
          saved: true,
          translation 
        });
        
        // Auto-hide success message after 2 seconds
        setTimeout(() => {
          setSelectedWord(null);
        }, 2000);
      } else {
        const error = await response.json();
        console.error('Failed to save word:', error);
      }
    } catch (error) {
      console.error('Error saving word:', error);
    }
  };

  if (loading) {
    return (
      <div className="bee-card max-w-4xl mx-auto">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <span className="ml-3 bee-text-light font-medium">Loading chapter content...</span>
        </div>
      </div>
    );
  }

  if (!content?.content) {
    return (
      <div className="bee-card max-w-4xl mx-auto text-center">
        <div className="text-red-500 font-medium">
          <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Unable to load chapter content
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Audio Controls */}
      <div className="bee-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bee-text-dark">{content.title}</h2>
          <div className="text-sm font-medium bee-text-light bg-gray-50 px-3 py-1 rounded-full">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        {/* Play/Pause Button */}
        <div className="flex items-center space-x-6 mb-6">
          <button
            onClick={togglePlayPause}
            className="flex items-center justify-center w-16 h-16 bee-bg-secondary text-white rounded-full transition-all duration-200 hover:scale-105 bee-shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1zM14 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          {/* Progress Bar */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={duration ? (currentTime / duration) * 100 : 0}
                onChange={handleSeek}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200 range-slider"
                style={{
                  background: `linear-gradient(to right, #f97316 0%, #f97316 ${duration ? (currentTime / duration) * 100 : 0}%, #e5e7eb ${duration ? (currentTime / duration) * 100 : 0}%, #e5e7eb 100%)`
                }}
              />
            </div>
          </div>
        </div>

        {/* Audio Element */}
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

      {/* Interactive Text Content */}
      <div className="bee-card">
        <div className="text-xl leading-relaxed bee-text-dark font-medium" style={{lineHeight: '1.8'}}>
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
                    relative inline-block mx-0.5 px-2 py-1 rounded-lg cursor-pointer transition-all duration-300 font-medium
                    hover:bg-orange-50 hover:text-orange-600 hover:shadow-md hover:scale-105
                    active:scale-95
                    ${index === currentWordIndex ? 'bg-orange-100 text-orange-700 shadow-lg scale-105 font-semibold' : ''}
                    ${selectedWord?.index === index ? 'bg-blue-100 text-blue-700 shadow-lg' : ''}
                  `}
                  title={`Click to save word • Hover for translation`}
                >
                  {word.text}
                  {/* Translation tooltip on hover */}
                  {hoveredWord?.word === word && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-xl z-20 whitespace-nowrap pointer-events-none border border-gray-700">
                      <div className="font-semibold text-orange-200 mb-1">{word.text}</div>
                      <div className="text-blue-200 font-medium">
                        {hoveredWord.loading ? (
                          <span className="flex items-center space-x-2">
                            <div className="w-3 h-3 border-2 border-orange-300 border-t-transparent rounded-full animate-spin"></div>
                            <span>Translating...</span>
                          </span>
                        ) : (
                          hoveredWord.translation
                        )}
                      </div>
                      {/* Tooltip arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
                </span>
              );
            }
          })}
        </div>
      </div>

      {/* Word Saved Success Notification */}
      {selectedWord && selectedWord.saved && (
        <div className="fixed top-6 right-6 bee-bg-accent text-white px-6 py-4 rounded-xl bee-shadow-lg flex items-center space-x-3 z-50 animate-bounce border border-green-400">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-lg">Word saved!</div>
            <div className="text-sm text-green-100 mt-1">
              <span className="font-medium">"{selectedWord.text}"</span> → <span className="font-medium">"{selectedWord.translation}"</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}