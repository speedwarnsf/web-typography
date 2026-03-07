import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Typeset.us Type Audit/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Site returned ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return NextResponse.json(
        { error: 'URL did not return HTML' },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Cap at 500KB to prevent abuse
    if (html.length > 500_000) {
      return NextResponse.json(
        { html: html.slice(0, 500_000) },
        { status: 200 }
      );
    }

    return NextResponse.json({ html }, { status: 200 });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out (10s)' }, { status: 504 });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to fetch URL' },
      { status: 502 }
    );
  }
}
