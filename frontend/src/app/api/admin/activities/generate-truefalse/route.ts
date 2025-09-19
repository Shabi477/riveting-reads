import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';

// Initialize OpenAI client with the integration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

interface GenerateTrueFalseRequest {
  bookId: string;
  chapterId: string;
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface TrueFalseQuestion {
  id: string;
  statement: string;
  isTrue: boolean;
  explanation: string;
  hints: string[];
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

async function generateTrueFalseQuestions(chapterContent: string, title: string, numQuestions: number = 5, difficulty: string = 'medium'): Promise<TrueFalseQuestion[]> {
  const systemPrompt = `You are an expert Spanish literacy tutor creating true/false questions for language learners.

Create ${numQuestions} high-quality true/false questions based on the provided Spanish chapter content.

REQUIREMENTS:
- Questions should test understanding of main ideas, details, characters, events, and themes
- Mix of true and false statements (aim for roughly half true, half false)
- Statements should be clear and unambiguous
- False statements should be plausible but clearly incorrect based on the text
- Questions in English about Spanish content
- Include helpful hints that guide without giving away the answer
- Include brief explanations for why the statement is true or false
- Difficulty level: ${difficulty}

Return ONLY a valid JSON object with this exact structure:
{
  "questions": [
    {
      "statement": "Clear statement about the chapter content",
      "isTrue": true | false,
      "explanation": "Brief explanation of why this statement is true or false",
      "hints": ["hint1", "hint2"]
    }
  ]
}

Focus on comprehension and key story elements. Make statements engaging and educational.`;

  const userPrompt = `Chapter Title: ${title}

Chapter Content:
${chapterContent}

Generate ${numQuestions} true/false questions based on this content.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response - strip code fences and extra text
    const cleanResponse = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const data = JSON.parse(cleanResponse);
    const questions = data.questions || data; // Handle both formats
    
    // Validate that questions is an array
    if (!Array.isArray(questions)) {
      throw new Error('AI response does not contain a valid questions array');
    }
    
    // Add IDs and validate structure
    return questions.map((q: any, index: number) => ({
      id: `ai_truefalse_${Date.now()}_${index}`,
      statement: q.statement || '',
      isTrue: Boolean(q.isTrue),
      explanation: q.explanation || '',
      hints: q.hints || []
    }));

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate true/false questions with AI');
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

    const body: GenerateTrueFalseRequest = await request.json();
    const { bookId, chapterId, numQuestions = 5, difficulty = 'medium' } = body;

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

    // Generate true/false questions
    const generatedQuestions = await generateTrueFalseQuestions(
      chapterData.content, 
      chapterData.title, 
      numQuestions, 
      difficulty
    );

    return NextResponse.json({
      success: true,
      chapterId,
      chapterTitle: chapterData.title,
      questions: generatedQuestions,
      metadata: {
        contentLength: chapterData.content.length,
        generatedAt: new Date().toISOString(),
        difficulty,
        numQuestions
      }
    });

  } catch (error) {
    console.error('True/False generation API error:', error);
    
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
      error: 'Failed to generate true/false questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}