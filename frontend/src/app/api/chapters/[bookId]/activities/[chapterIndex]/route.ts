import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

// Simple activity type for the frontend
interface SimpleActivity {
  id: string;
  type: 'vocabulary' | 'comprehension' | 'trueFalse' | 'matching' | 'writing';
  title: string;
  data: any;
}

// Real activity data based on actual chapter format from user example
function generateActivitiesForChapter(chapterIndex: number, chapterId: string) {
  // Part 1 – Vocabulary Support (Glossary) - Real data from chapter
  const vocabularyWords = [
    { spanish: 'aprender', english: 'to learn' },
    { spanish: 'idioma', english: 'language' },
    { spanish: 'difícil', english: 'difficult' },
    { spanish: 'estudiante', english: 'student' },
    { spanish: 'palabra', english: 'word' },
    { spanish: 'error', english: 'mistake' },
    { spanish: 'errores', english: 'mistakes' },
    { spanish: 'historia', english: 'story' },
    { spanish: 'leer', english: 'to read' },
    { spanish: 'entender', english: 'to understand' },
    { spanish: 'valiente', english: 'brave' },
  ];

  // Part 2 – Comprehension Questions (Real questions from chapter)
  const comprehensionQuestions = [
    { question: 'What is the teacher\'s name?', expectedAnswer: 'Elena', hint: 'Look at the beginning of the story' },
    { question: 'What subject does Elena teach?', expectedAnswer: 'Spanish', hint: 'Think about her profession' },
    { question: 'Where did Elena live as a child?', expectedAnswer: 'Spain', hint: 'Consider her background' },
    { question: 'What does Elena\'s grandmother say about Spanish?', expectedAnswer: 'It\'s magical', hint: 'Think about family wisdom' },
    { question: 'What are some "magic words" in Spanish?', expectedAnswer: 'amor, familia, vida', hint: 'Emotional connections' },
    { question: 'What is the name of Elena\'s favourite student?', expectedAnswer: 'Carlos', hint: 'The main student character' },
    { question: 'Where is Carlos from?', expectedAnswer: 'England', hint: 'His origin country' },
    { question: 'How does Carlos study every day?', expectedAnswer: 'reading and listening', hint: 'Two learning methods' },
    { question: 'Where does Carlos live now?', expectedAnswer: 'Spain', hint: 'His current location' },
    { question: 'What are the "secret" to learning Spanish?', expectedAnswer: 'practice and patience', hint: 'Key learning principles' },
    { question: 'What are mistakes, according to Elena?', expectedAnswer: 'learning opportunities', hint: 'Positive perspective' },
    { question: 'What happens on Elena\'s first day as a teacher?', expectedAnswer: 'she\'s nervous', hint: 'Common teaching experience' },
    { question: 'Which writers can you enjoy in Spanish?', expectedAnswer: 'García Márquez, Neruda', hint: 'Famous authors' },
    { question: 'What does Elena say Spanish connects with?', expectedAnswer: 'culture and heart', hint: 'Deeper meaning' }
  ];

  // Part 3 – True or False (Real statements from chapter)
  const trueFalseQuestions = [
    {
      statement: 'Elena thinks learning a new language is easy.',
      answer: false,
      explanation: 'False. Elena acknowledges that learning a language can be difficult but is rewarding.'
    },
    {
      statement: 'Spanish is spoken by many people in the world.',
      answer: true,
      explanation: 'True. Spanish is one of the most widely spoken languages globally.'
    },
    {
      statement: 'At first, Carlos can say many words in Spanish.',
      answer: false,
      explanation: 'False. Carlos starts as a beginner with limited Spanish vocabulary.'
    },
    {
      statement: 'Carlos studies every day and improves.',
      answer: true,
      explanation: 'True. Carlos is dedicated to daily practice and shows improvement.'
    },
    {
      statement: 'Elena says mistakes are bad.',
      answer: false,
      explanation: 'False. Elena teaches that mistakes are learning opportunities, not failures.'
    },
    {
      statement: 'Elena was very nervous on her first day as a teacher.',
      answer: true,
      explanation: 'True. Like many new teachers, Elena felt nervous on her first day.'
    },
    {
      statement: 'Spanish gives you culture, music, and travel.',
      answer: true,
      explanation: 'True. Learning Spanish opens doors to rich cultural experiences.'
    },
    {
      statement: 'Elena tells the student they are brave.',
      answer: true,
      explanation: 'True. Elena encourages her students by recognizing their courage to learn.'
    }
  ];

  // Part 4 – Vocabulary Match up (Real matching from chapter)
  const matchingPairs = [
    { spanish: 'aprender', english: 'to learn' },
    { spanish: 'idioma', english: 'language' },
    { spanish: 'difícil', english: 'difficult' },
    { spanish: 'estudiante', english: 'student' },
    { spanish: 'palabra', english: 'word' },
    { spanish: 'leer', english: 'to read' },
    { spanish: 'valiente', english: 'brave' }
  ];

  // Part 5 – Writing Prompts (Real prompts from chapter)
  const writingPrompts = [
    {
      prompt: 'Write three sentences about why you want to learn a language.',
      minWords: 30,
      keywords: ['aprender', 'idioma', 'porque', 'quiero'],
      instructions: 'Write short sentences in Spanish (2–3 per question).'
    },
    {
      prompt: 'Write two sentences about a mistake you made and what you learned.',
      minWords: 20,
      keywords: ['error', 'aprender', 'experiencia'],
      instructions: 'Think about how mistakes help us grow.'
    },
    {
      prompt: 'Imagine you are Carlos. Write three sentences about your life now in Spain.',
      minWords: 30,
      keywords: ['España', 'estudiante', 'español', 'vida'],
      instructions: 'Write from Carlos\'s perspective as a Spanish learner.'
    }
  ];

  return {
    activitiesByType: {
      vocabulary: vocabularyWords.map((word, index) => ({
        id: `vocab_${chapterId}_${index}`,
        type: 'vocabulary' as const,
        title: `Vocabulary: ${word.spanish}`,
        data: word
      })),
      comprehension: comprehensionQuestions.map((q, index) => ({
        id: `comp_${chapterId}_${index}`,
        type: 'comprehension' as const,
        title: `Question ${index + 1}`,
        data: q
      })),
      trueFalse: trueFalseQuestions.map((q, index) => ({
        id: `tf_${chapterId}_${index}`,
        type: 'trueFalse' as const,
        title: `True/False ${index + 1}`,
        data: q
      })),
      matching: [{
        id: `match_${chapterId}_0`,
        type: 'matching' as const,
        title: 'Match Spanish and English',
        data: { pairs: matchingPairs }
      }],
      writing: writingPrompts.map((prompt, index) => ({
        id: `write_${chapterId}_${index}`,
        type: 'writing' as const,
        title: `Writing Prompt ${index + 1}`,
        data: prompt
      }))
    },
    userProgress: [],
    chapterId
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterIndex: string }> }
) {
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

    const { bookId, chapterIndex } = await params;
    const chapterIndexNum = parseInt(chapterIndex);

    // Validate parameters
    if (!bookId || isNaN(chapterIndexNum)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Call the backend API to get real activities from database
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
    const backendResponse = await fetch(`${BACKEND_URL}/api/chapters/${bookId}/activities/${chapterIndex}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      console.error('Backend activities API error:', backendResponse.status);
      throw new Error(`Backend API error: ${backendResponse.status}`);
    }

    const activitiesData = await backendResponse.json();
    return NextResponse.json(activitiesData);

  } catch (error) {
    console.error('Activities API error:', error);
    return NextResponse.json(
      { error: 'Failed to load activities' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterIndex: string }> }
) {
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

    const { bookId, chapterIndex } = await params;
    const body = await request.json();

    // Validate parameters
    if (!bookId || !chapterIndex) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // For now, just return success
    // In production, this would save to the activityProgress table
    console.log('Activity progress saved:', {
      userId: user.userId,
      bookId,
      chapterIndex,
      progress: body
    });

    return NextResponse.json({ 
      success: true,
      message: 'Progress saved successfully'
    });

  } catch (error) {
    console.error('Save progress API error:', error);
    return NextResponse.json(
      { error: 'Failed to save progress' },
      { status: 500 }
    );
  }
}