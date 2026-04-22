import { NextRequest, NextResponse } from 'next/server';
import { jsonError, requireAdmin } from '@/lib/api/admin';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const upstream = await fetch(url, {
      // Pass through headers that may help with content negotiation
      headers: {
        'Accept': 'application/zip,application/octet-stream,*/*'
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream error: ${upstream.status}` }, { status: 502 });
    }

    // Stream back to the client with a safe same-origin response
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length') || undefined;

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const authError = jsonError(err);
    if (authError.status !== 500) {
      return authError;
    }

    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}


