import { NextResponse } from 'next/server';

// Server-side only - these won't be exposed to the browser
const BACKEND_URL =
  process.env.BACKEND_URL ||
  'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/ready`, {
      cache: 'no-store',
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Health check API route error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Backend unreachable' },
      { status: 503 }
    );
  }
}

