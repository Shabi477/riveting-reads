import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    
    // Forward the request to the backend object storage endpoint
    const response = await fetch(`${BACKEND_URL}/api/admin/objects/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend object storage error:', errorText);
      return NextResponse.json({ error: 'Failed to get upload URL' }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({
      uploadURL: data.uploadURL
    });
  } catch (error) {
    console.error('Cover upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}