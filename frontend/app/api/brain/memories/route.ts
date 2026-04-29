import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/brain/memories`, {
      method: 'GET',
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}
