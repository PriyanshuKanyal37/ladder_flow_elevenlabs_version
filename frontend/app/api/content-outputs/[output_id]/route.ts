import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ output_id: string }> }
) {
  try {
    const { output_id: outputId } = await params;
    const auth = request.headers.get('Authorization') || '';
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/content-outputs/${outputId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Content output update proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ output_id: string }> }
) {
  try {
    const { output_id: outputId } = await params;
    const auth = request.headers.get('Authorization') || '';

    const response = await fetch(`${BACKEND_URL}/content-outputs/${outputId}`, {
      method: 'DELETE',
      headers: {
        Authorization: auth,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Content output archive proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
