import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
// Define WordTiming interface to match the ElevenLabs service format
interface WordTiming {
  word: string;
  start: number; // seconds  
  end: number;   // seconds
  textStart: number; // character position in original text
  textEnd: number;   // character position in original text
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface WhisperWordTiming {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

interface WhisperTranscriptionResponse {
  text: string;
  words: WhisperWordTiming[];
  duration: number;
}

/**
 * AI-Powered Perfect Timing Synchronization Service
 * Uses OpenAI Whisper to analyze generated audio and provide millisecond-precise word timestamps
 * Solves the timing drift problem by detecting exactly when each Spanish word is spoken
 */
export class WhisperTimingService {
  /**
   * Analyze audio file with Whisper to get perfect word-level timing
   */
  async analyzeAudioTiming(
    audioFilePath: string,
    originalText: string,
    language: string = 'es' // Spanish
  ): Promise<WhisperTranscriptionResponse> {
    try {
      console.log('🧠 Using AI (Whisper) to analyze audio for perfect timing synchronization...');
      console.log(`📁 Audio file: ${audioFilePath}`);
      console.log(`🔤 Original text: ${originalText.substring(0, 100)}...`);
      console.log(`🗣️ Language: ${language}`);

      // Ensure file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      const audioReadStream = fs.createReadStream(audioFilePath);

      // Use Whisper with word-level timestamps for precise timing
      const transcription = await openai.audio.transcriptions.create({
        file: audioReadStream,
        model: "whisper-1",
        language: language,
        response_format: "verbose_json",
        timestamp_granularities: ["word"], // This gives us word-level timestamps!
      });

      console.log('✅ Whisper analysis complete');
      console.log(`📝 Transcribed text: ${transcription.text}`);
      console.log(`⏱️ Audio duration: ${transcription.duration}s`);
      console.log(`🔢 Word count: ${transcription.words?.length || 0} words`);

      // Extract word-level timing data
      const words: WhisperWordTiming[] = transcription.words || [];
      
      if (words.length === 0) {
        console.warn('⚠️ No word-level timing data received from Whisper');
        return {
          text: transcription.text,
          words: [],
          duration: transcription.duration || 0
        };
      }

      // Log first few words for debugging
      console.log('🎯 First few word timings:');
      words.slice(0, 5).forEach((word, i) => {
        console.log(`  ${i + 1}. "${word.word}" → ${word.start}s - ${word.end}s (${((word.end - word.start) * 1000).toFixed(0)}ms)`);
      });

      return {
        text: transcription.text,
        words: words,
        duration: transcription.duration || 0
      };

    } catch (error) {
      console.error('❌ Whisper timing analysis failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Whisper timing analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Convert with improved alignment and timing normalization (architect's fix)
   * Handles TTS→Whisper alignment and Display→TTS mapping  
   */
  convertToWordTimingsWithAlignment(
    whisperWords: WhisperWordTiming[],
    ttsInputText: string,        // Exact TTS input with pause markers
    displayText: string,         // Clean display text
    whisperTranscript: string,   // What Whisper transcribed
    actualAudioDuration: number  // For timing normalization
  ): WordTiming[] {
    console.log('🔄 Converting with improved alignment and normalization...');
    console.log(`📝 TTS Input: "${ttsInputText.substring(0, 100)}..."`);
    console.log(`📖 Display: "${displayText.substring(0, 100)}..."`);
    console.log(`🎙️ Whisper: "${whisperTranscript.substring(0, 100)}..."`);
    console.log(`⏱️ Audio Duration: ${actualAudioDuration}s`);

    // Step 1: Clean TTS text by removing pause markers  
    const cleanTtsText = this.cleanTtsText(ttsInputText);
    console.log(`🧹 Clean TTS: "${cleanTtsText.substring(0, 100)}..."`);

    // Step 2: Extract words from each text
    const displayWords = this.extractWordsFromText(displayText);
    const ttsWords = this.extractWordsFromText(cleanTtsText);
    console.log(`📊 Words count - Display: ${displayWords.length}, TTS: ${ttsWords.length}, Whisper: ${whisperWords.length}`);

    // Step 3: Align Display→TTS→Whisper using improved alignment (returns match tracking)
    const alignmentResult = this.alignWordsWithTiming(displayWords, ttsWords, whisperWords, whisperTranscript);

    // Step 4: Apply timing normalization to eliminate drift
    const normalizedTimings = this.normalizeTimings(alignmentResult.wordTimings, actualAudioDuration);

    console.log(`✅ Generated ${normalizedTimings.length} word timings with normalization, ${alignmentResult.matchedCount} matched`);
    
    // ARCHITECT'S FIX 4: Store match count for accuracy tracking
    (normalizedTimings as any).matchedCount = alignmentResult.matchedCount;
    
    return normalizedTimings;
  }

  /**
   * LEGACY METHOD - Convert Whisper word timings to our WordTiming format
   * Handles text alignment and word matching between original and transcribed text
   */
  convertToWordTimings(
    whisperWords: WhisperWordTiming[],
    originalText: string,
    transcribedText: string
  ): WordTiming[] {
    console.log('🔄 Converting Whisper timings to WordTiming format...');
    console.log(`📝 Original: "${originalText.substring(0, 100)}..."`);
    console.log(`🎙️ Transcribed: "${transcribedText.substring(0, 100)}..."`);

    // Simple approach: match words by cleaning punctuation
    const originalWords = this.extractWordsFromText(originalText);
    const wordTimings: WordTiming[] = [];

    let whisperIndex = 0;

    for (let i = 0; i < originalWords.length; i++) {
      const originalWord = originalWords[i];
      
      // Find matching word in Whisper results
      let matchedWhisperWord: WhisperWordTiming | null = null;
      
      // Look ahead a few words to find match (handles transcription differences)
      for (let j = whisperIndex; j < Math.min(whisperIndex + 3, whisperWords.length); j++) {
        const whisperWord = whisperWords[j];
        if (this.wordsMatch(originalWord.text, whisperWord.word)) {
          matchedWhisperWord = whisperWord;
          whisperIndex = j + 1;
          break;
        }
      }

      if (matchedWhisperWord) {
        wordTimings.push({
          word: originalWord.text,
          start: matchedWhisperWord.start,
          end: matchedWhisperWord.end,
          textStart: originalWord.startIndex,
          textEnd: originalWord.endIndex
        });
      } else {
        // Improved fallback: interpolate timing to prevent cumulative drift
        const totalOriginalWords = originalWords.length;
        const totalWhisperDuration = whisperWords.length > 0 ? whisperWords[whisperWords.length - 1].end : totalOriginalWords * 0.8;
        
        // Interpolate position based on progress through the text
        const progressRatio = i / totalOriginalWords;
        const interpolatedTime = progressRatio * totalWhisperDuration;
        
        // Use shorter duration for common Spanish articles/prepositions to prevent drift
        const wordLength = originalWord.text.length;
        const isShortWord = wordLength <= 2 || ['el', 'la', 'de', 'en', 'un', 'una', 'y', 'o', 'que', 'se', 'te', 'me'].includes(originalWord.text.toLowerCase());
        const estimatedDuration = isShortWord ? 0.3 : Math.min(wordLength * 0.08 + 0.2, 0.8); // Adaptive duration
        
        const estimatedStart = interpolatedTime;
        const estimatedEnd = estimatedStart + estimatedDuration;

        console.log(`⚠️ No Whisper match for "${originalWord.text}" - using smart interpolated timing: ${estimatedStart.toFixed(2)}s - ${estimatedEnd.toFixed(2)}s`);
        
        wordTimings.push({
          word: originalWord.text,
          start: estimatedStart,
          end: estimatedEnd,
          textStart: originalWord.startIndex,
          textEnd: originalWord.endIndex
        });
      }
    }

    const totalDuration = wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].end : 0;
    console.log(`✅ Converted ${wordTimings.length} words with total duration: ${totalDuration}s`);
    console.log(`📊 Speech rate: ${(wordTimings.length / totalDuration).toFixed(2)} words/second`);

    return wordTimings;
  }

  /**
   * Extract words with their positions from text
   */
  private extractWordsFromText(text: string): Array<{ text: string; startIndex: number; endIndex: number }> {
    const words: Array<{ text: string; startIndex: number; endIndex: number }> = [];
    const wordRegex = /\b[\p{L}\p{N}]+(?:['\-][\p{L}\p{N}]+)?\b/gu;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        text: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    return words;
  }

  /**
   * Check if two words match (handles case, punctuation, accents)
   */
  private wordsMatch(word1: string, word2: string): boolean {
    const normalize = (word: string) => 
      word.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove accents
          .replace(/[^\w]/g, ''); // Remove punctuation

    return normalize(word1) === normalize(word2);
  }

  /**
   * Generate perfect timing using AI analysis with proper TTS text alignment
   * This is the main method that replaces imprecise ElevenLabs timing
   */
  async generatePerfectTiming(
    audioFilePath: string,
    ttsInputText: string,      // Exact text sent to TTS (with pause markers)
    displayText: string,       // Original display text for mapping
    language: string = 'es'
  ): Promise<{
    words: WordTiming[];
    totalDuration: number;
    accuracy: 'perfect' | 'good' | 'fallback';
  }> {
    try {
      // Step 1: Analyze audio with Whisper AI using TTS input text
      console.log('🎯 Using TTS input text for precise Whisper alignment...');
      console.log(`📝 TTS Input: "${ttsInputText.substring(0, 100)}..."`);
      console.log(`📖 Display Text: "${displayText.substring(0, 100)}..."`);
      
      const whisperResult = await this.analyzeAudioTiming(audioFilePath, ttsInputText, language);
      
      // Step 2: Convert with improved alignment and timing normalization
      const wordTimings = this.convertToWordTimingsWithAlignment(
        whisperResult.words,
        ttsInputText,        // What Whisper analyzed
        displayText,         // What user sees
        whisperResult.text,  // What Whisper transcribed
        whisperResult.duration // Actual audio duration for normalization
      );

      // Step 3: Determine accuracy level using ARCHITECT'S FIX 4 - actual match tracking
      const matchedWords = (wordTimings as any).matchedCount || 0; // Use tracked matches, not start > 0 heuristic
      const totalWords = wordTimings.length;
      const matchRate = totalWords > 0 ? matchedWords / totalWords : 0;

      let accuracy: 'perfect' | 'good' | 'fallback';
      if (matchRate >= 0.9) accuracy = 'perfect';
      else if (matchRate >= 0.7) accuracy = 'good';
      else accuracy = 'fallback';

      console.log(`🎯 AI Timing Quality: ${accuracy} (${matchedWords}/${totalWords} words matched = ${(matchRate * 100).toFixed(1)}%)`);

      return {
        words: wordTimings,
        totalDuration: whisperResult.duration,
        accuracy
      };

    } catch (error) {
      console.error('❌ AI perfect timing failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced text cleaning: Remove all pause markers including U+2026 and normalize punctuation
   */
  private cleanTtsText(ttsText: string): string {
    return ttsText
      .replace(/\.{2,}/g, '')     // Remove multiple periods (pause markers)
      .replace(/\u2026/g, '')     // Remove ellipsis character (…)
      .replace(/[\u2010-\u2015]/g, '-') // Normalize various dashes to hyphen
      .replace(/[""'']/g, '')     // Remove various quote types
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();
  }

  /**
   * Scoring function for word alignment with case/accent-insensitive matching
   * Returns 0 for perfect match, positive costs for mismatches
   */
  private alignmentScore(word1: string, word2: string): number {
    if (this.wordsMatch(word1, word2)) {
      return 0; // Perfect match
    }
    
    // Calculate similarity-based substitution cost
    const similarity = this.calculateWordSimilarity(word1, word2);
    if (similarity > 0.7) {
      return 1; // Similar words (partial match)
    } else if (similarity > 0.4) {
      return 2; // Somewhat similar
    } else {
      return 3; // Very different
    }
  }

  /**
   * Calculate word similarity using normalized edit distance
   */
  private calculateWordSimilarity(word1: string, word2: string): number {
    const normalize = (word: string) => 
      word.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove accents
          .replace(/[^\w]/g, ''); // Remove punctuation

    const norm1 = normalize(word1);
    const norm2 = normalize(word2);
    
    if (norm1 === norm2) return 1.0;
    
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(norm1, norm2);
    return 1.0 - (editDistance / maxLen);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion  
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Needleman-Wunsch global sequence alignment algorithm
   * Aligns two sequences of words with optimal global alignment
   */
  private globalSequenceAlignment(sequence1: string[], sequence2: string[]): {
    alignment1: number[]; // Maps seq1 indices to seq2 indices (-1 = gap)
    alignment2: number[]; // Maps seq2 indices to seq1 indices (-1 = gap)
    score: number;
  } {
    const MATCH_SCORE = 0;
    const GAP_PENALTY = 1; // ARCHITECT'S FIX 3: Reduced from 2 to 1 to encourage gaps
    
    const m = sequence1.length;
    const n = sequence2.length;
    
    // Initialize scoring matrix
    const scoreMatrix = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Initialize first row and column with gap penalties
    for (let i = 0; i <= m; i++) scoreMatrix[i][0] = i * GAP_PENALTY;
    for (let j = 0; j <= n; j++) scoreMatrix[0][j] = j * GAP_PENALTY;
    
    // Fill scoring matrix using dynamic programming
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const alignScore = this.alignmentScore(sequence1[i-1], sequence2[j-1]);
        const matchScore = scoreMatrix[i-1][j-1] + Math.max(alignScore, GAP_PENALTY); // ARCHITECT'S FIX 3: substitution≥gap
        const deleteScore = scoreMatrix[i-1][j] + GAP_PENALTY;
        const insertScore = scoreMatrix[i][j-1] + GAP_PENALTY;
        
        scoreMatrix[i][j] = Math.min(matchScore, deleteScore, insertScore);
      }
    }
    
    // Backtrack to find optimal alignment
    const alignment1: number[] = new Array(m).fill(-1);
    const alignment2: number[] = new Array(n).fill(-1);
    
    let i = m, j = n;
    while (i > 0 && j > 0) {
      const currentScore = scoreMatrix[i][j];
      const alignScore = this.alignmentScore(sequence1[i-1], sequence2[j-1]);
      const matchScore = scoreMatrix[i-1][j-1] + Math.max(alignScore, GAP_PENALTY); // ARCHITECT'S FIX 3: substitution≥gap
      const deleteScore = scoreMatrix[i-1][j] + GAP_PENALTY;
      const insertScore = scoreMatrix[i][j-1] + GAP_PENALTY;
      
      if (currentScore === matchScore) {
        // Match/substitution
        alignment1[i-1] = j-1;
        alignment2[j-1] = i-1;
        i--; j--;
      } else if (currentScore === deleteScore) {
        // Deletion from sequence1 (gap in sequence2)
        i--;
      } else {
        // Insertion to sequence1 (gap in sequence1)
        j--;
      }
    }
    
    console.log(`🧬 Global alignment complete: Score=${scoreMatrix[m][n]}, Seq1=${m}→Seq2=${n}`);
    
    return {
      alignment1,
      alignment2, 
      score: scoreMatrix[m][n]
    };
  }

  /**
   * Interpolate timing from neighboring words when alignment fails
   */
  private interpolateTimingFromNeighbors(
    word: { text: string; startIndex: number; endIndex: number },
    existingTimings: WordTiming[],
    currentIndex: number,
    totalWords: number
  ): WordTiming {
    const prevTiming = existingTimings[existingTimings.length - 1];
    
    // Estimate timing based on position and word characteristics
    const baseStart = prevTiming ? prevTiming.end + 0.05 : (currentIndex / totalWords) * 10; // Assume 10s total
    const wordLength = word.text.length;
    const isShortWord = wordLength <= 2 || ['el', 'la', 'de', 'en', 'un', 'una', 'y', 'o', 'que', 'se', 'te', 'me'].includes(word.text.toLowerCase());
    const estimatedDuration = isShortWord ? 0.3 : Math.min(wordLength * 0.08 + 0.2, 0.8);
    
    return {
      word: word.text,
      start: baseStart,
      end: baseStart + estimatedDuration,
      textStart: word.startIndex,
      textEnd: word.endIndex
    };
  }

  /**
   * ARCHITECT'S FIX 2: Bounded lookahead with similarity threshold for Display↔TTS mapping
   * Finds best TTS match within window using similarity scoring
   */
  private findBestTtsMatch(
    displayWord: string,
    ttsWords: Array<{ text: string; startIndex: number; endIndex: number }>,
    startIndex: number,
    windowSize: number = 5
  ): number {
    let bestIndex = -1;
    let bestSimilarity = 0.7; // Minimum threshold for acceptance
    
    const endIndex = Math.min(startIndex + windowSize, ttsWords.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      const ttsWord = ttsWords[i].text;
      
      // Perfect match
      if (this.wordsMatch(displayWord, ttsWord)) {
        return i;
      }
      
      // Similarity-based match
      const similarity = this.calculateWordSimilarity(displayWord, ttsWord);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = i;
      }
    }
    
    return bestIndex;
  }

  /**
   * Global sequence alignment using Needleman-Wunsch algorithm
   * Provides robust Display→TTS→Whisper alignment that handles ASR variations
   */
  private alignWordsWithTiming(
    displayWords: Array<{ text: string; startIndex: number; endIndex: number }>,
    ttsWords: Array<{ text: string; startIndex: number; endIndex: number }>,
    whisperWords: WhisperWordTiming[],
    whisperTranscript: string
  ): { wordTimings: WordTiming[]; matchedCount: number } { // ARCHITECT'S FIX 4: Return match tracking
    console.log('🧬 Using Needleman-Wunsch global sequence alignment for robust timing...');
    console.log(`📊 Sequence lengths - Display: ${displayWords.length}, TTS: ${ttsWords.length}, Whisper: ${whisperWords.length}`);

    // ARCHITECT'S FIX 1: Align to timed tokens directly (critical index mismatch fix)
    // Use whisperWords.map(w => w.word) instead of transcript text to eliminate tokenization divergence
    console.log(`🎙️ Whisper timed tokens: ${whisperWords.length}`);

    // Step 2: Global alignment between clean TTS words and Whisper timed tokens (FIXED)
    const ttsToWhisperAlignment = this.globalSequenceAlignment(
      ttsWords.map(w => w.text),
      whisperWords.map(w => w.word) // CRITICAL FIX: Use timed tokens, not transcript
    );

    // ARCHITECT'S FIX 2: Strengthen Display↔TTS mapping with bounded lookahead
    const alignedTimings: WordTiming[] = [];
    let matchedCount = 0; // ARCHITECT'S FIX 4: Track actual matches
    let ttsIndex = 0;

    for (let i = 0; i < displayWords.length; i++) {
      const displayWord = displayWords[i];
      
      // ARCHITECT'S FIX 2: Bounded lookahead with similarity threshold for text divergences
      const matchedTtsIndex = this.findBestTtsMatch(displayWord.text, ttsWords, ttsIndex, 5);
      
      if (matchedTtsIndex !== -1) {
        ttsIndex = matchedTtsIndex;
      } else {
        // Skip ahead if no reasonable match found within window
        while (ttsIndex < ttsWords.length && !this.wordsMatch(displayWord.text, ttsWords[ttsIndex].text)) {
          ttsIndex++;
        }
      }

      if (ttsIndex < ttsWords.length) {
        // Found TTS match, now get aligned Whisper index and timing
        const whisperIndex = ttsToWhisperAlignment.alignment1[ttsIndex];
        
        if (whisperIndex !== -1 && whisperIndex < whisperWords.length) {
          // Perfect global alignment - use Whisper timing
          const whisperTiming = whisperWords[whisperIndex];
          alignedTimings.push({
            word: displayWord.text,
            start: whisperTiming.start,
            end: whisperTiming.end,
            textStart: displayWord.startIndex,
            textEnd: displayWord.endIndex
          });
          matchedCount++; // ARCHITECT'S FIX 4: Track successful alignment
          console.log(`✅ Global match: "${displayWord.text}" → Whisper[${whisperIndex}] "${whisperTiming.word}" @ ${whisperTiming.start.toFixed(2)}s`);
        } else {
          // TTS word didn't align with Whisper, use intelligent interpolation
          const timing = this.interpolateTimingFromNeighbors(displayWord, alignedTimings, i, displayWords.length);
          alignedTimings.push(timing);
          console.log(`⚠️ TTS→Whisper gap: "${displayWord.text}" interpolated @ ${timing.start.toFixed(2)}s`);
        }
        ttsIndex++;
      } else {
        // Display word not in TTS (shouldn't happen, but handle gracefully)
        const timing = this.interpolateTimingFromNeighbors(displayWord, alignedTimings, i, displayWords.length);
        alignedTimings.push(timing);
        console.log(`⚠️ Display→TTS gap: "${displayWord.text}" interpolated @ ${timing.start.toFixed(2)}s`);
      }
    }

    console.log(`🧬 Global alignment complete: ${alignedTimings.length} words aligned, ${matchedCount} matched`);
    return { wordTimings: alignedTimings, matchedCount }; // ARCHITECT'S FIX 4: Return match count
  }

  /**
   * Normalize timings to actual audio duration (architect's critical fix)
   */
  private normalizeTimings(
    timings: WordTiming[],
    actualAudioDuration: number
  ): WordTiming[] {
    if (timings.length === 0) return timings;

    const lastTiming = timings[timings.length - 1];
    const whisperDuration = lastTiming.end;
    
    // Calculate scale factor to match actual audio duration
    const scaleFactor = actualAudioDuration / whisperDuration;
    
    console.log(`📏 Timing normalization: Whisper=${whisperDuration.toFixed(2)}s, Actual=${actualAudioDuration.toFixed(2)}s, Scale=${scaleFactor.toFixed(3)}`);

    // Apply scaling and ensure monotonicity
    const normalizedTimings: WordTiming[] = [];
    let lastEnd = 0;

    for (const timing of timings) {
      const scaledStart = Math.max(timing.start * scaleFactor, lastEnd);
      const scaledEnd = Math.max(timing.end * scaleFactor, scaledStart + 0.05); // Minimum 50ms duration
      
      normalizedTimings.push({
        word: timing.word,
        start: scaledStart,
        end: scaledEnd,
        textStart: timing.textStart,
        textEnd: timing.textEnd
      });
      
      lastEnd = scaledEnd;
    }

    console.log(`✅ Normalized ${normalizedTimings.length} timings to actual audio duration`);
    return normalizedTimings;
  }
}

export const whisperTimingService = new WhisperTimingService();