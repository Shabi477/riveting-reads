import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../middleware/admin';
import { ElevenLabsService } from '../services/elevenLabsService';
import { db } from '../db/index';
import { chapters } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Initialize Eleven Labs client
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io';

// High-quality Spanish voices from Eleven Labs
const SPANISH_VOICES = {
  // Native Spanish speakers with excellent pronunciation
  'Isabel': 'EXAVITQu4vr4xnSDxMaL', // Female, warm and clear
  'Diego': 'GBv7mTt0atIp3Br8iCZE', // Male, professional and clear
  'Lola': 'pFZP5JQG7iQjIQuC4Bku', // Female, expressive and engaging
  'Carlos': 'IKne3meq5aSn9XLyUdCD', // Male, deep and authoritative
};

// Function to split text into chunks for Eleven Labs (5000 char limit)
function chunkText(text: string, maxChars: number = 4500): string[] {
  const chunks: string[] = [];
  
  // If text is already short enough, return as single chunk
  if (text.length <= maxChars) {
    return [text];
  }
  
  // Split by sentences first to avoid breaking mid-sentence
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const testChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    
    // If adding this sentence would exceed the char limit
    if (testChunk.length > maxChars) {
      // If we have content in current chunk, save it
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If single sentence is too long, force split by words
      if (sentence.length > maxChars) {
        const words = sentence.split(' ');
        for (const word of words) {
          const testWordChunk = currentChunk ? currentChunk + ' ' + word : word;
          if (testWordChunk.length > maxChars) {
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

// Generate Spanish audio with perfect timing using WebSocket TTS (no special permissions needed)
router.post('/generate-spanish-audio', requireAdmin, async (req, res) => {
  try {
    const { text, bookId, chapterId, voice = 'Isabel' } = req.body;

    if (!text || !bookId || !chapterId) {
      return res.status(400).json({
        error: 'Text, bookId, and chapterId are required'
      });
    }

    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({
        error: 'Eleven Labs API key not configured. Please add ELEVENLABS_API_KEY to environment variables.'
      });
    }

    const voiceId = SPANISH_VOICES[voice as keyof typeof SPANISH_VOICES] || SPANISH_VOICES.Isabel;
    
    console.log('Generating Spanish TTS with WebSocket timing for chapter:', chapterId);
    console.log('Text length:', text.length, 'characters');
    console.log('Using Spanish voice:', voice, 'ID:', voiceId);
    
    // Use exact text for perfect alignment (no normalization to avoid timing mismatches)
    const exactText = text;
    
    // Use the working ElevenLabs WebSocket service with specified voice
    const elevenLabsService = new ElevenLabsService();
    elevenLabsService.setVoiceId(voiceId);
    
    let result;
    try {
      // Primary: WebSocket TTS with timing data
      result = await elevenLabsService.generateAudioWithTiming(exactText, chapterId);
      console.log('WebSocket TTS successful with timing data');
    } catch (wsError) {
      console.log('WebSocket TTS failed, falling back to simple TTS:', wsError);
      
      // Fallback: Simple TTS with heuristic timing
      result = await elevenLabsService.generateAudioSimple(exactText, chapterId);
      console.log('Fallback TTS successful');
    }
    
    // Process timing data for consistent frontend consumption
    const words = result.timingData?.words?.map((word: any) => ({
      text: word.text,
      start: word.startTime || word.start, // Handle both formats
      end: word.endTime || word.end
    })) || [];
    
    // Add timestamp for cache busting
    const timestamp = Date.now();
    const audioUrl = `/${result.audioUrl}?v=${timestamp}`;
    
    // Store timing data in database with consistent format, including projectId for native player
    const timingData = {
      words: words,
      totalDuration: result.timingData?.totalDuration || 0,
      ttsText: exactText,
      voiceId: voiceId,
      projectId: (result as any).projectId, // Add projectId for ElevenLabs Native Player
      generatedAt: new Date().toISOString()
    };
    
    await db.update(chapters)
      .set({
        audioUrl: audioUrl,
        elevenLabsTimingData: timingData
      })
      .where(eq(chapters.id, chapterId));
    
    console.log('Audio saved with timing data');
    console.log('Public URL:', audioUrl);
    console.log('Duration:', result.timingData?.totalDuration || 0, 'seconds');
    console.log('Words with timing:', words.length);
    
    // Log native player info if available
    const hasProjectId = !!(result as any).projectId;
    if (hasProjectId) {
      console.log('🎯 ElevenLabs Native Player projectId:', (result as any).projectId);
      console.log('✅ Perfect timing synchronization enabled');
    }

    res.json({
      success: true,
      audioUrl: audioUrl,
      duration: result.timingData?.totalDuration || 0,
      message: `Spanish audio generated successfully using Eleven Labs (${voice} voice)${hasProjectId ? ' with perfect timing' : ' with enhanced speech'}`,
      voice: voice,
      words: words.length,
      method: hasProjectId ? 'Projects API with perfect timing' : (result.timingData?.words ? 'WebSocket with timing' : 'Simple TTS with fallback'),
      projectId: (result as any).projectId,
      nativePlayerEnabled: hasProjectId
    });

  } catch (error: any) {
    console.error('Eleven Labs TTS generation error:', error);
    
    // Better error handling for permissions
    if (error.message.includes('missing_permissions')) {
      return res.status(401).json({
        error: 'ElevenLabs API key lacks required permissions. Using alternative TTS method.'
      });
    }
    
    if (error.message.includes('401')) {
      return res.status(401).json({
        error: 'Invalid Eleven Labs API key. Please check your ELEVENLABS_API_KEY.'
      });
    }
    
    if (error.message.includes('429')) {
      return res.status(429).json({
        error: 'Eleven Labs API rate limit exceeded. Please try again in a few minutes.'
      });
    }
    
    return res.status(500).json({
      error: `Failed to generate audio: ${error.message}`
    });
  }
});

// Get available Spanish voices
router.get('/voices', requireAdmin, async (req, res) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({
        error: 'Eleven Labs API key not configured.'
      });
    }

    // Return our curated list of Spanish voices
    res.json({
      voices: Object.entries(SPANISH_VOICES).map(([name, id]) => ({
        name,
        id,
        language: 'Spanish',
        recommended: name === 'Isabel' // Default voice
      }))
    });

  } catch (error: any) {
    console.error('Error fetching voices:', error);
    res.status(500).json({
      error: 'Failed to fetch voices: ' + (error.message || 'Unknown error')
    });
  }
});

export default router;