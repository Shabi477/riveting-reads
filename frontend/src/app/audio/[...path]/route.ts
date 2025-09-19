import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const audioUrl = `${BACKEND_URL}/audio/${path}`;
    
    console.log('Proxying audio request to:', audioUrl);
    
    const response = await fetch(audioUrl);
    
    if (!response.ok) {
      console.error('Audio proxy error:', response.status, response.statusText);
      return new Response('Audio file not found', { status: 404 });
    }
    
    const audioBuffer = await response.arrayBuffer();
    
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Audio proxy error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}