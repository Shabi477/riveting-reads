import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';

// Initialize OpenAI client with the integration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

interface GenerateComprehensionRequest {
  bookId: string;
  chapterId: string;
  mode: 'auto' | 'custom';
  questions?: string[];
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface ComprehensionQuestion {
  id: string;
  question: string;
  type: 'multiple_choice';
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  hints?: string[];
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

async function generateAutoQuestions(chapterContent: string, title: string, numQuestions: number = 5, difficulty: string = 'medium'): Promise<ComprehensionQuestion[]> {
  const systemPrompt = `You are an expert Spanish literacy tutor creating multiple choice comprehension questions for language learners.

Create ${numQuestions} high-quality multiple choice questions based on the provided Spanish chapter content.

REQUIREMENTS:
- Questions should test understanding of main ideas, details, characters, and themes
- Each question must have exactly 4 answer options (A, B, C, D)
- Only ONE option should be correct, the other 3 should be plausible distractors
- Questions in English, answer options can be Spanish or English as appropriate
- Include helpful hints that guide without giving away the correct answer
- Include brief explanations for why the correct answer is right
- Difficulty level: ${difficulty}

Return ONLY a valid JSON array of questions with this exact structure:
[
  {
    "question": "string",
    "type": "multiple_choice",
    "options": {
      "A": "first option",
      "B": "second option", 
      "C": "third option",
      "D": "fourth option"
    },
    "correctAnswer": "A" | "B" | "C" | "D",
    "explanation": "Brief explanation of why this answer is correct",
    "hints": ["hint1", "hint2"]
  }
]

Focus on comprehension over memorization. Make questions engaging and educational.`;

  const userPrompt = `Chapter Title: ${title}

Chapter Content:
${chapterContent}

Generate ${numQuestions} comprehension questions based on this content.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const questions = JSON.parse(response);
    
    // Add IDs and validate structure
    return questions.map((q: any, index: number) => ({
      id: `ai_generated_${Date.now()}_${index}`,
      question: q.question,
      type: 'multiple_choice' as const,
      options: {
        A: q.options?.A || 'Option A',
        B: q.options?.B || 'Option B',
        C: q.options?.C || 'Option C',
        D: q.options?.D || 'Option D'
      },
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || '',
      hints: q.hints || []
    }));

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate questions with AI');
  }
}

async function generateCustomAnswers(chapterContent: string, title: string, customQuestions: string[], difficulty: string = 'medium'): Promise<ComprehensionQuestion[]> {
  const systemPrompt = `You are an expert Spanish literacy tutor creating multiple choice questions based on chapter content.

For each question provided, create a complete multiple choice question with 4 answer options based strictly on the chapter content provided.

REQUIREMENTS:
- Answer based only on information in the chapter content
- Each question must have exactly 4 answer options (A, B, C, D)
- Only ONE option should be correct, the other 3 should be plausible distractors
- Include helpful hints that guide students without giving away the correct answer
- Include brief explanations for why the correct answer is right
- If a question cannot be answered from the content, indicate this clearly
- Difficulty level: ${difficulty}

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question": "original question text",
    "type": "multiple_choice",
    "options": {
      "A": "first option",
      "B": "second option",
      "C": "third option", 
      "D": "fourth option"
    },
    "correctAnswer": "A" | "B" | "C" | "D",
    "explanation": "Brief explanation of why this answer is correct",
    "hints": ["hint1", "hint2"],
    "canAnswerFromContent": boolean
  }
]`;

  const userPrompt = `Chapter Title: ${title}

Chapter Content:
${chapterContent}

Questions to Answer:
${customQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Generate answers for these questions based on the chapter content.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent answers
      max_tokens: 2000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const questions = JSON.parse(response);
    
    // Add IDs and validate structure
    return questions.map((q: any, index: number) => ({
      id: `ai_custom_${Date.now()}_${index}`,
      question: q.question,
      type: 'multiple_choice' as const,
      options: {
        A: q.options?.A || 'Option A',
        B: q.options?.B || 'Option B',
        C: q.options?.C || 'Option C',
        D: q.options?.D || 'Option D'
      },
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || '',
      hints: q.hints || [],
      canAnswerFromContent: q.canAnswerFromContent !== false // Default to true
    }));

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate answers with AI');
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

    const body: GenerateComprehensionRequest = await request.json();
    const { bookId, chapterId, mode, questions, numQuestions = 5, difficulty = 'medium' } = body;

    // Validate required parameters
    if (!bookId || !chapterId || !mode) {
      return NextResponse.json({ 
        error: 'Missing required parameters: bookId, chapterId, mode' 
      }, { status: 400 });
    }

    if (mode === 'custom' && (!questions || questions.length === 0)) {
      return NextResponse.json({ 
        error: 'Custom mode requires questions array' 
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

    // Generate questions based on mode
    let generatedQuestions: ComprehensionQuestion[];
    
    if (mode === 'auto') {
      generatedQuestions = await generateAutoQuestions(
        chapterData.content, 
        chapterData.title, 
        numQuestions, 
        difficulty
      );
    } else {
      generatedQuestions = await generateCustomAnswers(
        chapterData.content, 
        chapterData.title, 
        questions!, 
        difficulty
      );
    }

    return NextResponse.json({
      success: true,
      mode,
      chapterId,
      chapterTitle: chapterData.title,
      questions: generatedQuestions,
      metadata: {
        contentLength: chapterData.content.length,
        generatedAt: new Date().toISOString(),
        difficulty,
        ...(mode === 'auto' && { numQuestions }),
        ...(mode === 'custom' && { numCustomQuestions: questions!.length })
      }
    });

  } catch (error) {
    console.error('Comprehension generation API error:', error);
    
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
      error: 'Failed to generate comprehension questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}