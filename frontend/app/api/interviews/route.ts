import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const response = await fetch(`${BACKEND_URL}/interviews`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': auth,
            },
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

export async function POST(request: NextRequest) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const body = await request.json();
        const response = await fetch(`${BACKEND_URL}/interviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': auth,
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

