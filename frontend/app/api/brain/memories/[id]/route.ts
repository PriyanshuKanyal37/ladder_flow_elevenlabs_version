import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id === 'undefined') {
      return NextResponse.json({ error: 'Invalid memory id' }, { status: 400 });
    }

    const body = await req.json();
    const response = await fetch(`${BACKEND_URL}/brain/memories/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: req.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id === 'undefined') {
      return NextResponse.json({ error: 'Invalid memory id' }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/brain/memories/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}
