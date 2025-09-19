import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:8080';

export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/elevenlabs/generate-spanish-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // TTS generation can take several minutes - set longer timeout
      signal: AbortSignal.timeout(600000), // 10 minutes timeout for TTS
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('TTS generate audio error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}