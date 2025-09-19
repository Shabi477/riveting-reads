import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ word: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { word } = await params;
    
    if (!word) {
      return NextResponse.json(
        { message: 'Word parameter is required' },
        { status: 400 }
      );
    }

    // Decode URL-encoded word (handles special characters like ñ, á, etc.)
    const decodedWord = decodeURIComponent(word);

    const response = await fetch(`${BACKEND_URL}/api/words/translate/${encodeURIComponent(decodedWord)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}