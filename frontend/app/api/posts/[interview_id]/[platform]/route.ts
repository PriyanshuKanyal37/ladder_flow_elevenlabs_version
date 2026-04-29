import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ interview_id: string; platform: string }> }
) {
  try {
    const { interview_id, platform } = await params;
    const auth = request.headers.get('Authorization') || '';
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/posts/${interview_id}/${platform}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ interview_id: string; platform: string }> }
) {
  try {
    const { interview_id, platform } = await params;
    const auth = request.headers.get('Authorization') || '';
    const response = await fetch(`${BACKEND_URL}/posts/${interview_id}/${platform}`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });

    if (!response.ok && response.status !== 204) {
      return NextResponse.json({ error: `Failed: ${response.status}` }, { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
