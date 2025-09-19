import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';

// Initialize OpenAI client with the integration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

interface GenerateMatchingRequest {
  bookId: string;
  chapterId: string;
  numPairs?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface MatchingPair {
  id: string;
  spanish: string;
  english: string;
}

interface MatchingActivity {
  id: string;
  title: string;
  instructions: string;
  pairs: MatchingPair[];
}

async function fetchChapterContent(chapterId: string, authToken: string) {
  try {
    // First get chapter info from backend
    const chapterResponse = await fetch(`${BACKEND_URL}/api/admin/chapters/${chapterId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!chapterResponse.ok) {
      throw new Error(`Failed to fetch chapter: ${chapterResponse.status}`);
    }

    const chapter = await chapterResponse.json();
    
    if (!chapter.jsonUrl) {
      throw new Error('Chapter has no content URL');
    }

    // Fetch the actual chapter content from the JSON URL
    const contentResponse = await fetch(chapter.jsonUrl);
    if (!contentResponse.ok) {
      throw new Error(`Failed to fetch chapter content: ${contentResponse.status}`);
    }

    const content = await contentResponse.json();
    
    // Extract text content from the chapter data
    let textContent = '';
    
    // Handle different chapter content formats
    if (content.content?.paragraphs && Array.isArray(content.content.paragraphs)) {
      textContent = content.content.paragraphs
        .map((p: any) => p.text || '')
        .join('\n\n');
    } else if (content.content && Array.isArray(content.content)) {
      textContent = content.content
        .map((item: any) => item.text || item.word || '')
        .join(' ');
    } else if (typeof content === 'string') {
      textContent = content;
    } else {
      throw new Error('Unsupported chapter content format');
    }

    return {
      title: chapter.title || content.title || 'Chapter',
      content: textContent,
      chapterInfo: chapter
    };
  } catch (error) {
    console.error('Error fetching chapter content:', error);
    throw error;
  }
}

async function generateMatchingPairs(chapterContent: string, title: string, numPairs: number = 6, difficulty: string = 'medium'): Promise<MatchingActivity> {
  const systemPrompt = `You are an expert Spanish literacy tutor creating matching activities for language learners.

Create a matching activity with ${numPairs} pairs based on the provided Spanish chapter content.

REQUIREMENTS:
- Extract key Spanish words, phrases, or concepts from the chapter
- Provide clear English translations or definitions
- Focus on important vocabulary, character names, places, or key concepts
- Pairs should be directly relevant to the chapter content
- Spanish terms should be exactly as they appear in the text
- English translations should be clear and accurate
- Difficulty level: ${difficulty}

Return ONLY a valid JSON object with this exact structure:
{
  "title": "Match the Spanish terms with their English meanings",
  "instructions": "Drag the Spanish terms to match them with their correct English translations",
  "pairs": [
    {
      "spanish": "Spanish word or phrase from the chapter",
      "english": "English translation or definition"
    }
  ]
}

Focus on vocabulary and concepts that are central to understanding the chapter.`;

  const userPrompt = `Chapter Title: ${title}

Chapter Content:
${chapterContent}

Generate ${numPairs} matching pairs based on this content.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response - strip code fences and extra text
    const cleanResponse = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const activityData = JSON.parse(cleanResponse);
    
    // Add IDs and validate structure
    const pairs = activityData.pairs.map((pair: any, index: number) => ({
      id: `ai_matching_${Date.now()}_${index}`,
      spanish: pair.spanish || '',
      english: pair.english || ''
    }));

    return {
      id: `ai_matching_activity_${Date.now()}`,
      title: activityData.title || 'Match the Spanish terms with their English meanings',
      instructions: activityData.instructions || 'Drag the Spanish terms to match them with their correct English translations',
      pairs
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate matching activity with AI');
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get JWT token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify JWT token
    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body: GenerateMatchingRequest = await request.json();
    const { bookId, chapterId, numPairs = 6, difficulty = 'medium' } = body;

    // Validate required parameters
    if (!bookId || !chapterId) {
      return NextResponse.json({ 
        error: 'Missing required parameters: bookId, chapterId' 
      }, { status: 400 });
    }

    // Fetch chapter content
    let chapterData;
    try {
      chapterData = await fetchChapterContent(chapterId, token);
    } catch (error) {
      console.error('Error fetching chapter:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch chapter content. Please ensure the chapter exists and has content.' 
      }, { status: 404 });
    }

    if (!chapterData.content || chapterData.content.trim().length < 50) {
      return NextResponse.json({ 
        error: 'Chapter content is too short or empty for AI generation' 
      }, { status: 400 });
    }

    // Generate matching activity
    const generatedActivity = await generateMatchingPairs(
      chapterData.content, 
      chapterData.title, 
      numPairs, 
      difficulty
    );

    return NextResponse.json({
      success: true,
      chapterId,
      chapterTitle: chapterData.title,
      pairs: generatedActivity.pairs,
      metadata: {
        contentLength: chapterData.content.length,
        generatedAt: new Date().toISOString(),
        difficulty,
        numPairs
      }
    });

  } catch (error) {
    console.error('Matching generation API error:', error);
    
    // More specific error messages
    if (error instanceof SyntaxError) {
      return NextResponse.json({ 
        error: 'Failed to parse AI response. Please try again.' 
      }, { status: 500 });
    }
    
    if (error instanceof Error && error.message?.includes('OpenAI')) {
      return NextResponse.json({ 
        error: 'AI service temporarily unavailable. Please try again later.' 
      }, { status: 503 });
    }

    return NextResponse.json({
      error: 'Failed to generate matching activity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}