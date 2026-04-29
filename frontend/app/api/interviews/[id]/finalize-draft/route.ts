import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = request.headers.get('Authorization') || '';
    // beforeunload sends via sendBeacon — body may be a Blob with content-type text/plain.
    // We forward the raw body verbatim; backend accepts optional JSON fields.
    const body = await request.text();
    const response = await fetch(`${BACKEND_URL}/interviews/${id}/finalize-draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: body || '{}',
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
