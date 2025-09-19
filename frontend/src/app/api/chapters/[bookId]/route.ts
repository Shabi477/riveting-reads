import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value;

    console.log(`🔍 Chapters API: bookId=${bookId}`);
    console.log(`🔍 Auth token exists: ${!!authToken}`);

    if (!authToken) {
      console.log('❌ No auth token found in cookies');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 Fetching from: ${BACKEND_URL}/api/chapters/${bookId}`);
    
    const response = await fetch(`${BACKEND_URL}/api/chapters/${bookId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 Backend response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Backend error for book ${bookId}:`, errorText);
      return NextResponse.json(
        { error: 'Backend error', details: errorText }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched ${data.chapters?.length || 0} chapters`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Chapters API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}