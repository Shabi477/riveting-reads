import { Router } from 'express';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();

// Initialize Google TTS client with API key authentication
let ttsClient: TextToSpeechClient | null = null;

function initializeTTSClient() {
  if (!ttsClient) {
    if (process.env.GOOGLE_CLOUD_API_KEY) {
      ttsClient = new TextToSpeechClient({
        apiKey: process.env.GOOGLE_CLOUD_API_KEY,
      });
    } else {
      console.error('Google Cloud API key not found in environment');
    }
  }
  return ttsClient;
}

// Function to split text into chunks under the byte limit
function chunkText(text: string, maxByteSize: number = 4000): string[] {
  const chunks: string[] = [];
  
  // Helper function to get byte length
  const getByteLength = (str: string) => Buffer.byteLength(str, 'utf8');
  
  // If text is already short enough, return as single chunk
  if (getByteLength(text) <= maxByteSize) {
    return [text];
  }
  
  // Split by sentences first to avoid breaking mid-sentence
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const testChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    
    // If adding this sentence would exceed the byte limit
    if (getByteLength(testChunk) > maxByteSize) {
      // If we have content in current chunk, save it
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If single sentence is too long, force split by words
      if (getByteLength(sentence) > maxByteSize) {
        const words = sentence.split(' ');
        for (const word of words) {
          const testWordChunk = currentChunk ? currentChunk + ' ' + word : word;
          if (getByteLength(testWordChunk) > maxByteSize) {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
          }
          currentChunk = currentChunk ? currentChunk + ' ' + word : word;
        }
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk = testChunk;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

// Generate Spanish audio from text using Google TTS
router.post('/generate-spanish-audio', requireAdmin, async (req, res) => {
  try {
    const { text, bookId, chapterId } = req.body;

    if (!text || !bookId || !chapterId) {
      return res.status(400).json({
        error: 'Text, bookId, and chapterId are required'
      });
    }

    const client = initializeTTSClient();
    if (!client) {
      return res.status(500).json({
        error: 'Google TTS service not configured. Please add GOOGLE_CLOUD_API_KEY to environment variables.'
      });
    }

    console.log('Generating Spanish TTS for chapter:', chapterId);
    console.log('Text length:', text.length, 'characters');
    
    // Split text into chunks if needed (4000 bytes to stay safely under 5000 byte limit)
    const textChunks = chunkText(text, 4000);
    console.log('Split into', textChunks.length, 'chunks');
    
    const audioChunks: Buffer[] = [];
    
    // Generate audio for each chunk
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      console.log(`Generating TTS for chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);
      
      const request = {
        input: { text: chunk },
        voice: {
          languageCode: 'es-ES', // Spanish (Spain) for native pronunciation
          name: 'es-ES-Neural2-A', // High-quality neural voice
          ssmlGender: 'FEMALE' as const,
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: 0.9, // Slightly slower for learning
          pitch: 0.0,
          volumeGainDb: 0.0,
        },
      };

      const [response] = await client.synthesizeSpeech(request);
      
      if (!response.audioContent) {
        throw new Error(`No audio content received for chunk ${i + 1}`);
      }
      
      audioChunks.push(response.audioContent as Buffer);
    }

    // Create audio directory if it doesn't exist
    const audioDir = path.join(process.cwd(), 'public', 'audio', bookId);
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    // For multiple chunks, we'll save them as separate files and return the first one
    // In the future, you could concatenate MP3 files using ffmpeg
    const audioFilename = `${chapterId}.mp3`;
    const audioPath = path.join(audioDir, audioFilename);
    
    if (audioChunks.length === 1) {
      // Single chunk - save directly
      fs.writeFileSync(audioPath, audioChunks[0]);
    } else {
      // Multiple chunks - save first chunk as main file
      // Save additional chunks with numbered suffixes
      fs.writeFileSync(audioPath, audioChunks[0]);
      
      for (let i = 1; i < audioChunks.length; i++) {
        const chunkFilename = `${chapterId}_part${i + 1}.mp3`;
        const chunkPath = path.join(audioDir, chunkFilename);
        fs.writeFileSync(chunkPath, audioChunks[i]);
      }
      
      console.log(`Generated ${audioChunks.length} audio files for long content`);
    }

    // Calculate approximate duration (rough estimate based on text length)
    const estimatedDuration = Math.round(text.length / 12); // ~12 chars per second of speech

    // Return the public URL for the audio
    const audioUrl = `audio/${bookId}/${audioFilename}`;
    
    console.log(`Spanish TTS audio generated successfully: ${audioUrl}`);
    
    res.json({
      success: true,
      audioUrl: audioUrl,
      duration: estimatedDuration,
      chunksGenerated: audioChunks.length,
      message: `Spanish audio generated successfully with native pronunciation! ${audioChunks.length > 1 ? `(Split into ${audioChunks.length} parts due to length)` : ''}`
    });

  } catch (error: any) {
    console.error('TTS generation error:', error);
    
    // Handle specific Google TTS errors
    if (error.code === 3) { // INVALID_ARGUMENT
      return res.status(400).json({
        error: 'Invalid text content for TTS generation'
      });
    } else if (error.code === 16) { // UNAUTHENTICATED
      return res.status(401).json({
        error: 'Google Cloud API authentication failed. Please check your API key.'
      });
    } else if (error.code === 8) { // RESOURCE_EXHAUSTED
      return res.status(429).json({
        error: 'Google Cloud TTS quota exceeded. Please try again later.'
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate audio: ' + (error.message || 'Unknown error')
    });
  }
});

export default router;