import WebSocket from 'ws';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { whisperTimingService } from './whisperTimingService';

interface ElevenLabsTimingData {
  chars: string[];
  charStartTimesMs: number[];
  charsDurationsMs: number[];
}

interface WordTiming {
  text: string;
  startTime: number;  // Backend field name
  endTime: number;    // Backend field name
  start: number;      // Frontend expected field name  
  end: number;        // Frontend expected field name
  charStart: number;
  charEnd: number;
  isPause?: boolean; // Mark injected pauses to prevent frontend highlighting
}

interface AudioGenerationResult {
  audioUrl: string;
  timingData: {
    words: WordTiming[];
    totalDuration: number;
    charAlignment: ElevenLabsTimingData;
  };
}

export class ElevenLabsService {
  private apiKey: string;
  private voiceId: string = 'VR6AewLTigWG4xSOukaG'; // Spanish female voice
  private modelId: string = 'eleven_multilingual_v2';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY!;
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }
  }

  setVoiceId(voiceId: string) {
    this.voiceId = voiceId;
    console.log('Voice set to:', voiceId);
  }

  // ===== ELEVENLABS PROJECTS API FOR NATIVE PLAYER =====
  
  async createAudioNativeProjectForPerfectTiming(text: string, title: string): Promise<{ projectId: string; audioUrl: string }> {
    console.log(`Creating ElevenLabs Audio Native project for web player: ${title}`);
    
    try {
      // Create Audio Native project (designed for web embedding)
      const formData = new FormData();
      formData.append('name', title);
      formData.append('text', text);
      formData.append('voice_id', this.voiceId);
      formData.append('model_id', this.modelId);
      formData.append('voice_settings', JSON.stringify({
        stability: 1.0,           // Maximum clarity for Spanish learning
        similarity_boost: 0.3,    // Slower, more deliberate speech  
        style: 0.1,               // Minimal style for natural pacing
        use_speaker_boost: false
      }));

      const createProjectResponse = await fetch('https://api.elevenlabs.io/v1/audio-native', {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!createProjectResponse.ok) {
        const errorText = await createProjectResponse.text();
        throw new Error(`Failed to create Audio Native project: ${createProjectResponse.status} ${errorText}`);
      }

      const projectData = await createProjectResponse.json();
      const projectId = projectData.project_id;
      const htmlSnippet = projectData.html_snippet;
      
      console.log(`✅ Created Audio Native project: ${projectId}`);
      console.log(`📄 HTML snippet available for embedding`);
      
      // For Audio Native, the project should be immediately available
      // Let's try to get the audio directly (may need different endpoint)
      let audioUrl;
      
      try {
        // Try to get audio from the Audio Native project
        const audioResponse = await fetch(`https://api.elevenlabs.io/v1/audio-native/${projectId}/audio`, {
          method: 'GET',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.apiKey,
          },
        });

        if (audioResponse.ok) {
          const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
          audioUrl = this.saveAudioFile(audioBuffer, `native_${projectId}`);
        } else {
          console.log(`Audio fetch returned ${audioResponse.status}, Audio Native project created but no audio file - will fall back to WebSocket TTS`);
          throw new Error('Audio Native project created but no downloadable audio available');
        }
      } catch (audioError) {
        console.log('Audio fetch failed, falling back to WebSocket TTS:', audioError);
        throw new Error('Audio Native project created but audio not accessible');
      }

      console.log(`🎧 Audio Native project created: ${audioUrl}`);
      console.log(`🎯 Native Player will use projectId: ${projectId} for perfect timing`);
      
      return { projectId, audioUrl };
      
    } catch (error) {
      console.error('Failed to create Audio Native project:', error);
      throw error;
    }
  }


  // ===== NEW ROBUST CHUNKED TTS SYSTEM =====
  
  private chunkTextIntelligently(text: string, maxChunkSize: number = 2000): string[] {
    console.log(`Chunking text of ${text.length} characters with max chunk size ${maxChunkSize}...`);
    
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    
    // First split by double line breaks (paragraphs)
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed the limit
      if (currentChunk && (currentChunk + '\n\n' + paragraph).length > maxChunkSize) {
        // Save current chunk and start new one
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      } else {
        // Add paragraph to current chunk
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
      }
      
      // If single paragraph is too long, split by sentences
      if (currentChunk.length > maxChunkSize) {
        const sentences = currentChunk.split(/(?<=[.!?])\s+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if (sentenceChunk && (sentenceChunk + ' ' + sentence).length > maxChunkSize) {
            if (sentenceChunk.trim()) {
              chunks.push(sentenceChunk.trim());
            }
            sentenceChunk = sentence;
          } else {
            sentenceChunk = sentenceChunk ? sentenceChunk + ' ' + sentence : sentence;
          }
        }
        
        if (sentenceChunk.trim()) {
          currentChunk = sentenceChunk;
        }
      }
    }
    
    // Add the final chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    console.log(`Text split into ${chunks.length} chunks:`, chunks.map(c => c.length));
    return chunks.filter(chunk => chunk.length > 0);
  }

  private addPauseTokens(chunks: string[]): { text: string; pausePositions: number[] } {
    if (chunks.length === 0) return { text: '', pausePositions: [] };
    if (chunks.length === 1) return { text: chunks[0], pausePositions: [] };

    const pausePositions: number[] = [];
    let fullText = chunks[0];
    
    for (let i = 1; i < chunks.length; i++) {
      // Add pause marker at the end of previous chunk
      const pauseMarker = ' …'; // 400-600ms pause token
      pausePositions.push(fullText.length);
      fullText += pauseMarker + ' ' + chunks[i];
    }
    
    console.log(`Added ${pausePositions.length} pause tokens at positions:`, pausePositions);
    return { text: fullText, pausePositions };
  }

  private async generateChunkedAudioWithTiming(chunks: string[], chapterId: string): Promise<AudioGenerationResult> {
    console.log(`Generating audio for ${chunks.length} chunks using robust WebSocket method...`);
    
    // FIX 2: Don't add pause tokens to text - send clean chunks to ElevenLabs
    const fullTextClean = chunks.join(' '); // Join without pause tokens
    
    // Process each chunk via WebSocket with timing
    const chunkResults: {
      audioBuffer: Buffer;
      timingData: ElevenLabsTimingData;
      textStartIndex: number;
      textEndIndex: number;
    }[] = [];
    
    let cumulativeTextIndex = 0;
    let retryCount = 0;
    const maxRetries = 3;
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} chars clean)...`);
          
          // FIX 2: Send clean chunk text WITHOUT pause tokens to ElevenLabs
          const result = await this.generateSingleChunkWithTiming(chunk, `${chapterId}_chunk_${chunkIndex}`);
          
          chunkResults.push({
            audioBuffer: result.audioBuffer,
            timingData: result.timingData,
            textStartIndex: cumulativeTextIndex,
            textEndIndex: cumulativeTextIndex + chunk.length
          });
          
          // FIX 2: Update index without pause token calculations
          cumulativeTextIndex += chunk.length + (chunkIndex < chunks.length - 1 ? 1 : 0); // +1 for space between chunks
          retryCount = 0; // Reset retry count on success
          break;
          
        } catch (error) {
          retryCount++;
          console.error(`Chunk ${chunkIndex + 1} failed (attempt ${retryCount}/${maxRetries}):`, error);
          
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to process chunk ${chunkIndex + 1} after ${maxRetries} retries: ${error}`);
          }
          
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }
    }
    
    // FIX 2: Merge with clean text (no pause positions needed)
    return this.mergeChunkedResults(chunkResults, fullTextClean, [], chapterId);
  }

  private async generateSingleChunkWithTiming(text: string, chunkId: string): Promise<{
    audioBuffer: Buffer;
    timingData: ElevenLabsTimingData;
  }> {
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=${this.modelId}`;
    const ws = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      let audioChunks: Buffer[] = [];
      // FIX 1: Accumulate alignment data instead of overwriting
      let accumulatedTimingData: ElevenLabsTimingData = {
        chars: [],
        charStartTimesMs: [],
        charsDurationsMs: []
      };
      let hasReceivedAudio = false;

      ws.on('open', () => {
        console.log(`Connected to ElevenLabs WebSocket for chunk ${chunkId}`);
        
        // Send initial configuration with slower speech settings for 0.5-0.7 words/second
        // FIX: Use empty text to avoid off-by-one character alignment bug
        ws.send(JSON.stringify({
          text: "",
          voice_settings: {
            stability: 0.95,        // Maximum stability for slowest speech
            similarity_boost: 0.70, // Lower for more deliberate pacing
            style: 0.05,            // Minimum style for slowest, clearest speech
            use_speaker_boost: false // Disable for natural slow pacing
          },
          xi_api_key: this.apiKey
        }));

        // Send the actual text
        ws.send(JSON.stringify({
          text: text
        }));

        // End the stream
        ws.send(JSON.stringify({
          text: ""
        }));
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.audio) {
            const audioBuffer = Buffer.from(response.audio, 'base64');
            audioChunks.push(audioBuffer);
            hasReceivedAudio = true;
          }

          if (response.alignment) {
            // FIX 1: ACCUMULATE all alignment frames instead of overwriting
            const alignment = response.alignment;
            const newChars = alignment.chars || [];
            const newStartTimes = alignment.charStartTimesMs || alignment.char_start_times_ms || [];
            const newDurations = alignment.charsDurationsMs || alignment.chars_durations_ms || [];
            
            // Accumulate the data from this frame
            accumulatedTimingData.chars.push(...newChars);
            accumulatedTimingData.charStartTimesMs.push(...newStartTimes);
            accumulatedTimingData.charsDurationsMs.push(...newDurations);
            
            console.log(`Accumulated timing frame for chunk ${chunkId}: +${newChars.length} chars (total: ${accumulatedTimingData.chars.length})`);
          }

          if (response.isFinal && hasReceivedAudio && accumulatedTimingData.chars.length > 0) {
            const fullAudio = Buffer.concat(audioChunks);
            console.log(`Final chunk ${chunkId}: ${accumulatedTimingData.chars.length} total characters aligned`);
            resolve({
              audioBuffer: fullAudio,
              timingData: accumulatedTimingData
            });
          }
        } catch (error) {
          console.error(`Error processing WebSocket message for chunk ${chunkId}:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for chunk ${chunkId}:`, error);
        reject(error);
      });

      ws.on('close', () => {
        console.log(`WebSocket connection closed for chunk ${chunkId}`);
      });

      // 10-minute timeout per chunk to prevent fallbacks
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          reject(new Error(`Chunk ${chunkId} timeout after 10 minutes`));
        }
      }, 600000);
    });
  }

  private mergeChunkedResults(
    chunkResults: Array<{
      audioBuffer: Buffer;
      timingData: ElevenLabsTimingData;
      textStartIndex: number;
      textEndIndex: number;
    }>,
    fullText: string,
    pausePositions: number[],
    chapterId: string
  ): AudioGenerationResult {
    console.log('Merging chunked results with cumulative timing...');
    
    // Merge all audio buffers
    const mergedAudio = Buffer.concat(chunkResults.map(r => r.audioBuffer));
    const audioUrl = this.saveAudioFile(mergedAudio, chapterId);
    
    // FIX 3: Add duration validation for chunks
    for (let i = 0; i < chunkResults.length; i++) {
      const chunk = chunkResults[i];
      const chunkDuration = this.calculateTotalDuration(chunk.timingData);
      if (chunkDuration < 1.0) { // Chunks should be at least 1 second
        console.warn(`Chunk ${i} has unrealistic duration: ${chunkDuration}s - may indicate timing issues`);
      }
    }
    
    // Build cumulative timing data
    let cumulativeTimeOffset = 0;
    const allWords: WordTiming[] = [];
    const mergedCharAlignment: ElevenLabsTimingData = {
      chars: [],
      charStartTimesMs: [],
      charsDurationsMs: []
    };
    
    for (let i = 0; i < chunkResults.length; i++) {
      const chunk = chunkResults[i];
      const chunkText = fullText.substring(chunk.textStartIndex, chunk.textEndIndex);
      
      // Process words for this chunk with cumulative timing
      const chunkWords = this.processTimingData(chunkText, chunk.timingData);
      
      // Apply cumulative time offset to chunk words
      const offsetWords = chunkWords.map(word => ({
        ...word,
        startTime: word.startTime + cumulativeTimeOffset,
        endTime: word.endTime + cumulativeTimeOffset,
        charStart: word.charStart + chunk.textStartIndex,
        charEnd: word.charEnd + chunk.textStartIndex
      }));
      
      allWords.push(...offsetWords);
      
      // Calculate actual chunk duration from timing data
      const chunkDuration = this.calculateTotalDuration(chunk.timingData);
      
      // FIX 2: No more pause tokens in clean text approach
      if (i < chunkResults.length - 1) {
        // Add natural pause between chunks (but not in text alignment)
        const pauseDuration = 0.5; // 500ms pause between chunks
        cumulativeTimeOffset += chunkDuration + pauseDuration;
      } else {
        // Last chunk - just add its duration
        cumulativeTimeOffset += chunkDuration;
      }
      
      // Merge character alignment data with time offsets
      const timeOffsetMs = (cumulativeTimeOffset - chunkDuration) * 1000;
      
      if (chunk.timingData.chars) {
        mergedCharAlignment.chars.push(...chunk.timingData.chars);
      }
      if (chunk.timingData.charStartTimesMs) {
        mergedCharAlignment.charStartTimesMs.push(...chunk.timingData.charStartTimesMs.map(t => t + timeOffsetMs));
      }
      if (chunk.timingData.charsDurationsMs) {
        mergedCharAlignment.charsDurationsMs.push(...chunk.timingData.charsDurationsMs);
      }
    }
    
    console.log(`Merged ${chunkResults.length} chunks into ${allWords.length} words with total duration ${cumulativeTimeOffset}s`);
    console.log(`Expected speech rate: ${allWords.length / cumulativeTimeOffset} words/second (target: 0.5-0.7)`);
    console.log(`Character alignment: input=${fullText.length}, aligned=${mergedCharAlignment.chars.length}`);
    
    return {
      audioUrl,
      timingData: {
        words: allWords,
        totalDuration: cumulativeTimeOffset,
        charAlignment: mergedCharAlignment
      }
    };
  }

  async generateAudioWithTiming(text: string, chapterId: string): Promise<AudioGenerationResult & { projectId?: string }> {
    console.log(`Generating Spanish TTS for chapter: ${chapterId}`);
    console.log(`Text length: ${text.length} characters`);
    console.log('Using Spanish voice: Isabel ID:', this.voiceId);
    
    // Skip problematic WebSocket approach - go directly to reliable HTTP TTS + AI timing
    console.log('=== RELIABLE HTTP TTS + AI TIMING APPROACH ===');
    console.log(`Generating Spanish audio with AI-powered perfect timing for chapter ${chapterId}`);
    console.log(`Text length: ${text.length} characters`);
    
    try {
      // Direct HTTP TTS generation (more reliable than WebSocket)
      return await this.generateHttpTtsWithTiming(text, chapterId);
      
    } catch (httpError) {
      console.error('HTTP TTS + AI timing failed:', httpError);
      
      // Only fallback to simple timing if absolutely necessary
      console.warn('Creating fallback timing data as last resort...');
      const audioUrl = `audio/fallback_${chapterId}_${Date.now()}.mp3`; // Placeholder
      const wordTimings = this.createFallbackTimings(text);
      
      return {
        audioUrl,
        timingData: {
          words: wordTimings,
          totalDuration: wordTimings.length * 1.5, // 1.5s per word for 0.67 words/second
          charAlignment: { chars: [], charStartTimesMs: [], charsDurationsMs: [] }
        }
      };
    }
  }

  private async generateHttpTtsWithTiming(text: string, chapterId: string): Promise<AudioGenerationResult> {
    console.log(`Generating slower Spanish TTS with natural punctuation pauses...`);
    
    // Add natural pauses using punctuation (works with ElevenLabs)
    const textWithPauses = this.addNaturalPausesWithPunctuation(text);
    console.log(`Enhanced text for natural pauses: ${text.length} → ${textWithPauses.length} characters`);
    
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text: textWithPauses,
        model_id: this.modelId,
        voice_settings: {
          stability: 0.95,          // High stability for clear learning speech
          similarity_boost: 0.15,   // Much lower for very slow, deliberate speech
          style: 0.05,              // Minimal style for slowest educational pacing
          use_speaker_boost: false  // Keep disabled for natural learning pace
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs HTTP TTS failed: ${response.status} ${errorText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioUrl = this.saveAudioFile(audioBuffer, chapterId);
    
    console.log(`HTTP TTS successful - audio saved: ${audioUrl}`);
    
    // 🧠 **AI-POWERED PERFECT TIMING SYNCHRONIZATION** 🧠
    // Use OpenAI Whisper to analyze the generated audio for millisecond-precise word timestamps
    try {
      console.log('🎯 Starting AI-powered timing analysis...');
      const audioFilePath = join(__dirname, '../../public', audioUrl);
      
      // CRITICAL: Use the exact TTS input text for Whisper alignment (not original text)
      const aiTimingResult = await whisperTimingService.generatePerfectTiming(
        audioFilePath,
        textWithPauses, // Use exact TTS input text with pause markers for precise alignment
        text,           // Pass original text separately for display mapping
        'es'           // Spanish
      );
      
      console.log(`✅ AI Timing Quality: ${aiTimingResult.accuracy}`);
      console.log(`🎧 Perfect synchronization with ${aiTimingResult.words.length} words over ${aiTimingResult.totalDuration}s`);
      
      // Convert AI timing to our format (using field names frontend expects)
      const perfectWordTimings: WordTiming[] = aiTimingResult.words.map(w => ({
        text: w.word,
        startTime: w.start, // Backend field name
        endTime: w.end,     // Backend field name  
        start: w.start,     // Frontend expected field name
        end: w.end,         // Frontend expected field name
        charStart: w.textStart,
        charEnd: w.textEnd,
        isPause: false
      }));
      
      return {
        audioUrl,
        timingData: {
          words: perfectWordTimings,
          totalDuration: aiTimingResult.totalDuration,
          charAlignment: { chars: [], charStartTimesMs: [], charsDurationsMs: [] }
        }
      };
      
    } catch (aiError) {
      console.error('❌ AI timing analysis failed, using fallback:', aiError);
      
      // Fallback to synthetic timing if AI fails
      const fallbackTimings = this.createFallbackTimings(text);
      const syntheticDuration = fallbackTimings.length * 1.67;
      
      console.warn('⚠️ Using synthetic timing fallback - highlighting may have slight drift');
      
      return {
        audioUrl,
        timingData: {
          words: fallbackTimings,
          totalDuration: syntheticDuration,
          charAlignment: { chars: [], charStartTimesMs: [], charsDurationsMs: [] }
        }
      };
    }
  }

  private addNaturalPausesWithPunctuation(text: string): string {
    console.log('Adding EXTRA SLOW pauses for Spanish language learners...');
    
    let processedText = text;
    
    // MUCH longer pauses after sentences for very slow learning pace
    processedText = processedText
      .replace(/([.!?])\s+/g, '$1..... ')      // 5 periods = extra long pause after sentences
      .replace(/([.!?])$/g, '$1.....');        // End of text sentences with extra pause
    
    // Extra slow paragraph break pauses
    processedText = processedText
      .replace(/\n\s*\n/g, '...\n\n')          // Triple period for paragraph breaks
      .replace(/\n/g, '...\n');                // Triple period for all line breaks
    
    // Slower commas for Spanish learner rhythm (more time to process)
    processedText = processedText
      .replace(/,\s+/g, ',... ');              // Triple period after commas for learning pause
    
    // Extra pauses after colons and semicolons for comprehension
    processedText = processedText
      .replace(/[:;]\s+/g, '$&... ');          // Triple period after colons/semicolons
    
    // Add breathing room between clauses with "que", "pero", "y", "como"
    processedText = processedText
      .replace(/\s+(que|pero|y|como)\s+/gi, '.. $1. ');  // Pause before/after connecting words
    
    console.log(`Enhanced SLOW Spanish text for learners: ${text.length} → ${processedText.length} characters`);
    console.log('⏰ Optimized for 0.5-0.7 words/second learning pace');
    return processedText;
  }

  private saveAudioFile(audioBuffer: Buffer, chapterId: string): string {
    try {
      // Create audio directory if it doesn't exist
      const audioDir = join(process.cwd(), 'public', 'audio');
      mkdirSync(audioDir, { recursive: true });

      // Sanitize chapterId to prevent path traversal attacks
      const sanitizedChapterId = this.sanitizeFilename(chapterId);

      // Generate unique filename with timestamp for uniqueness
      const filename = `chapter_${sanitizedChapterId}_${Date.now()}.mp3`;
      const filePath = join(audioDir, filename);

      // Save the audio file
      writeFileSync(filePath, audioBuffer);

      // Return the public URL path
      return `audio/${filename}`;
    } catch (error) {
      console.error('Error saving audio file:', error);
      throw error;
    }
  }

  private sanitizeFilename(input: string): string {
    // Remove or replace dangerous characters to prevent path traversal
    return input
      .replace(/[\/\\]/g, '_')      // Replace forward and back slashes
      .replace(/\.\./g, '_')        // Replace double dots
      .replace(/[<>:"|?*]/g, '_')   // Replace other illegal filename characters
      .replace(/\s+/g, '_')         // Replace whitespace with underscores
      .replace(/^\.+/, '')          // Remove leading dots
      .replace(/\.+$/, '')          // Remove trailing dots
      .substring(0, 50);            // Limit length to prevent overly long filenames
  }

  private processTimingData(text: string, timingData: ElevenLabsTimingData | null): WordTiming[] {
    if (!timingData || !timingData.chars || !timingData.charStartTimesMs || !timingData.charsDurationsMs) {
      console.warn('No timing data available, creating fallback timings');
      return this.createFallbackTimings(text);
    }

    try {
      console.log('Processing timing data with robust word alignment...');
      
      // FIX 3: Robust text normalization and character mapping
      const alignedText = timingData.chars.join('');
      
      // Multiple normalization strategies
      const originalText = text.normalize('NFC').trim();
      const alignedTextNormalized = alignedText.normalize('NFC').trim();
      
      console.log('Original text length:', originalText.length);
      console.log('Aligned text length:', alignedTextNormalized.length);
      console.log('Text samples - Original:', originalText.substring(0, 100));
      console.log('Text samples - Aligned:', alignedTextNormalized.substring(0, 100));
      
      // FIX 3: Robust character mapping using incremental two-pointer approach
      const charMapping = this.buildCharacterMapping(originalText, alignedTextNormalized);
      
      // Extract words from original text
      const wordRegex = /\S+/g;
      const words: WordTiming[] = [];
      let match;
      
      while ((match = wordRegex.exec(originalText)) !== null) {
        const wordText = match[0];
        const wordStart = match.index;
        const wordEnd = wordStart + wordText.length;
        
        // Map original character positions to aligned positions
        const alignedStart = charMapping.get(wordStart);
        const alignedEnd = charMapping.get(wordEnd - 1);
        
        if (alignedStart !== undefined && alignedEnd !== undefined && 
            alignedStart < timingData.charStartTimesMs.length && 
            alignedEnd < timingData.charStartTimesMs.length &&
            alignedStart < timingData.charsDurationsMs.length &&
            alignedEnd < timingData.charsDurationsMs.length) {
          
          const startTimeMs = timingData.charStartTimesMs[alignedStart] || 0;
          const endCharStartMs = timingData.charStartTimesMs[alignedEnd] || 0;
          const endCharDurationMs = timingData.charsDurationsMs[alignedEnd] || 100; // 100ms fallback
          const endTimeMs = endCharStartMs + endCharDurationMs;
          
          // FIX: Validate timing values are reasonable
          if (!isNaN(startTimeMs) && !isNaN(endTimeMs) && endTimeMs > startTimeMs) {
            words.push({
              text: wordText,
              startTime: startTimeMs / 1000,
              endTime: endTimeMs / 1000,
              charStart: wordStart, // Keep original text positions
              charEnd: wordEnd - 1
            });
            
            console.log(`✓ Mapped word "${wordText}": ${(startTimeMs/1000).toFixed(2)}s - ${(endTimeMs/1000).toFixed(2)}s`);
          } else {
            console.warn(`✗ Invalid timing for word "${wordText}": start=${startTimeMs}ms, end=${endTimeMs}ms`);
            // Use fallback timing calculation
            this.addFallbackWordTiming(words, wordText, wordStart, wordEnd, originalText, timingData);
          }
        } else {
          console.warn(`✗ Could not map word "${wordText}" at position ${wordStart}-${wordEnd}`);
          
          // Proportional fallback timing
          const textProgress = wordStart / originalText.length;
          const totalDurationMs = Math.max(...timingData.charStartTimesMs) + Math.max(...timingData.charsDurationsMs);
          const estimatedStartMs = textProgress * totalDurationMs;
          const estimatedDurationMs = (wordText.length / originalText.length) * totalDurationMs;
          
          words.push({
            text: wordText,
            startTime: estimatedStartMs / 1000,
            endTime: (estimatedStartMs + estimatedDurationMs) / 1000,
            charStart: wordStart,
            charEnd: wordEnd - 1
          });
        }
      }

      console.log(`Processed ${words.length} words with robust mapping (${words.filter(w => w.startTime > 0).length} successful)`);
      return words;

    } catch (error) {
      console.error('Error processing timing data with robust algorithm:', error);
      return this.createFallbackTimings(text);
    }
  }

  // FIX: Helper method for fallback timing calculation
  private addFallbackWordTiming(words: WordTiming[], wordText: string, wordStart: number, wordEnd: number, originalText: string, timingData: ElevenLabsTimingData) {
    const textProgress = wordStart / originalText.length;
    const totalDurationMs = Math.max(...timingData.charStartTimesMs) + Math.max(...timingData.charsDurationsMs);
    const estimatedStartMs = textProgress * totalDurationMs;
    const estimatedDurationMs = (wordText.length / originalText.length) * totalDurationMs;
    
    words.push({
      text: wordText,
      startTime: estimatedStartMs / 1000,
      endTime: (estimatedStartMs + estimatedDurationMs) / 1000,
      charStart: wordStart,
      charEnd: wordEnd - 1
    });
  }

  // FIX: Robust two-pointer character-level mapping
  private buildCharacterMapping(originalText: string, alignedText: string): Map<number, number> {
    const mapping = new Map<number, number>();
    
    console.log('Building robust character mapping...');
    console.log(`Original sample: "${originalText.substring(0, 50)}..."`);
    console.log(`Aligned sample:  "${alignedText.substring(0, 50)}..."`);
    
    // If texts are identical, use direct 1:1 mapping
    if (originalText === alignedText) {
      for (let i = 0; i < originalText.length; i++) {
        mapping.set(i, i);
      }
      console.log(`Identical texts - direct mapping: ${mapping.size} positions mapped`);
      return mapping;
    }
    
    console.log(`Texts differ - using two-pointer character-level mapping`);
    
    // Two-pointer approach: scan character by character, handling differences
    let origPtr = 0;
    let alignedPtr = 0;
    
    while (origPtr < originalText.length && alignedPtr < alignedText.length) {
      const origChar = originalText[origPtr];
      const alignedChar = alignedText[alignedPtr];
      
      if (this.charactersMatch(origChar, alignedChar)) {
        // Characters match - create mapping
        mapping.set(origPtr, alignedPtr);
        origPtr++;
        alignedPtr++;
      } else {
        // Characters don't match - try to advance one pointer to find sync
        let foundSync = false;
        
        // Look ahead in aligned text for matching character
        for (let lookAhead = 1; lookAhead <= 5 && alignedPtr + lookAhead < alignedText.length; lookAhead++) {
          if (this.charactersMatch(origChar, alignedText[alignedPtr + lookAhead])) {
            // Found match - skip aligned characters and sync
            alignedPtr += lookAhead;
            mapping.set(origPtr, alignedPtr);
            origPtr++;
            alignedPtr++;
            foundSync = true;
            break;
          }
        }
        
        if (!foundSync) {
          // Look ahead in original text for matching character
          for (let lookAhead = 1; lookAhead <= 5 && origPtr + lookAhead < originalText.length; lookAhead++) {
            if (this.charactersMatch(originalText[origPtr + lookAhead], alignedChar)) {
              // Found match - skip original characters and sync
              origPtr += lookAhead;
              mapping.set(origPtr, alignedPtr);
              origPtr++;
              alignedPtr++;
              foundSync = true;
              break;
            }
          }
        }
        
        if (!foundSync) {
          // No sync found - advance both pointers and continue
          origPtr++;
          alignedPtr++;
        }
      }
    }
    
    // Fill in missing mappings using proportional mapping
    this.fillMissingMappings(mapping, originalText.length, alignedText.length);
    
    console.log(`Two-pointer mapping: ${mapping.size}/${originalText.length} positions mapped`);
    return mapping;
  }
  
  // Helper: Check if two characters match (handles normalization)
  private charactersMatch(char1: string, char2: string): boolean {
    if (char1 === char2) return true;
    
    // Normalize for comparison (remove diacritics, case insensitive)
    const norm1 = char1.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const norm2 = char2.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    
    return norm1 === norm2;
  }
  
  // Helper: Fill missing character mappings using proportional interpolation
  private fillMissingMappings(mapping: Map<number, number>, origLength: number, alignedLength: number): void {
    for (let i = 0; i < origLength; i++) {
      if (!mapping.has(i)) {
        // Find nearest mapped positions for interpolation
        let beforePos = -1;
        let afterPos = -1;
        
        // Find previous mapped position
        for (let j = i - 1; j >= 0; j--) {
          if (mapping.has(j)) {
            beforePos = j;
            break;
          }
        }
        
        // Find next mapped position
        for (let j = i + 1; j < origLength; j++) {
          if (mapping.has(j)) {
            afterPos = j;
            break;
          }
        }
        
        // Calculate interpolated position
        let mappedPos: number;
        
        if (beforePos === -1 && afterPos === -1) {
          // No mapped positions - use proportional mapping
          mappedPos = Math.round((i / origLength) * alignedLength);
        } else if (beforePos === -1) {
          // Only have after position - extrapolate backwards
          const afterMapped = mapping.get(afterPos)!;
          mappedPos = Math.max(0, afterMapped - (afterPos - i));
        } else if (afterPos === -1) {
          // Only have before position - extrapolate forwards
          const beforeMapped = mapping.get(beforePos)!;
          mappedPos = Math.min(alignedLength - 1, beforeMapped + (i - beforePos));
        } else {
          // Interpolate between before and after
          const beforeMapped = mapping.get(beforePos)!;
          const afterMapped = mapping.get(afterPos)!;
          const ratio = (i - beforePos) / (afterPos - beforePos);
          mappedPos = Math.round(beforeMapped + ratio * (afterMapped - beforeMapped));
        }
        
        mapping.set(i, Math.max(0, Math.min(alignedLength - 1, mappedPos)));
      }
    }
  }


  private createFallbackTimings(text: string): WordTiming[] {
    // Create basic word timings for 0.5-0.7 words/second rate if ElevenLabs timing fails
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const averageWordDuration = 1.5; // 1.5s per word for 0.67 words/second rate

    console.log(`Creating fallback timing for ${words.length} words at 0.67 words/second...`);

    return words.map((word, index) => ({
      text: word,
      startTime: index * averageWordDuration,
      endTime: (index + 1) * averageWordDuration,
      charStart: text.indexOf(word), // Better character positioning
      charEnd: text.indexOf(word) + word.length - 1
    }));
  }

  private calculateTotalDuration(timingData: ElevenLabsTimingData | null): number {
    if (!timingData || !timingData.charStartTimesMs || !timingData.charsDurationsMs) {
      console.warn('No timing data for duration calculation');
      return 0;
    }

    // FIX: NaN-safe duration calculation
    const startTimes = timingData.charStartTimesMs.filter(t => !isNaN(t) && isFinite(t));
    const durations = timingData.charsDurationsMs.filter(d => !isNaN(d) && isFinite(d));
    
    if (startTimes.length === 0 || durations.length === 0) {
      console.warn('No valid timing values for duration calculation');
      return 0;
    }

    // Calculate total duration from last valid character
    const lastStartTime = Math.max(...startTimes);
    const lastDuration = durations[durations.length - 1] || 100; // Fallback 100ms
    
    const totalDurationMs = lastStartTime + lastDuration;
    const totalDurationSec = totalDurationMs / 1000;
    
    if (isNaN(totalDurationSec) || !isFinite(totalDurationSec)) {
      console.warn('Calculated duration is NaN or infinite, using fallback');
      return 5.0; // 5 second fallback
    }
    
    console.log(`Calculated duration: ${totalDurationSec.toFixed(2)}s from ${startTimes.length} valid timing points`);
    return totalDurationSec;
  }

  // Alternative HTTP method for simpler integration
  async generateAudioSimple(text: string, chapterId: string): Promise<AudioGenerationResult> {
    try {
      console.log(`Generating audio for chapter ${chapterId} using HTTP method...`);

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: this.modelId,
          voice_settings: {
            stability: 0.85,        // Higher stability = slower, more consistent speech
            similarity_boost: 0.75, // Slightly lower for natural flow
            style: 0.15,            // Lower style = slower, more deliberate pace
            use_speaker_boost: false // Disable for more natural pacing
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const audioUrl = this.saveAudioFile(audioBuffer, chapterId);

      // Create fallback timing data since HTTP method doesn't provide it
      const wordTimings = this.createFallbackTimings(text);

      return {
        audioUrl,
        timingData: {
          words: wordTimings,
          totalDuration: wordTimings.length * 0.75, // Estimate for slower 0.75 pace
          charAlignment: { chars: [], charStartTimesMs: [], charsDurationsMs: [] }
        }
      };

    } catch (error) {
      console.error('Error with simple audio generation:', error);
      throw error;
    }
  }
}