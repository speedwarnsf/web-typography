import { NextRequest, NextResponse } from 'next/server';
import { FetchRefused, safeFetch } from '@/lib/safe-fetch';

// Fetches a public page for /audit and /dna, which render it inert. The
// fetch itself is guarded in src/lib/safe-fetch.ts (no private addresses,
// checked redirects, streamed byte cap).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Per-client rate limit: 12 fetches per minute. The window lives in this
// server instance's memory, so it bounds bursts, not a distributed abuser;
// the Vercel firewall is the outer limit.
const WINDOW_MS = 60_000;
const LIMIT = 12;
const recent = new Map<string, number[]>();
let lastSweep = 0;

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown').trim();
}

function rateLimited(key: string, now = Date.now()): boolean {
  const hits = (recent.get(key) ?? []).filter(t => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  // Forget clients whose last request is older than the window, at most once
  // a window, so no address is held for more than two minutes (/privacy).
  if (now - lastSweep > WINDOW_MS) {
    lastSweep = now;
    for (const [k, v] of recent) if (now - v[v.length - 1] > WINDOW_MS) recent.delete(k);
  }
  return hits.length > LIMIT;
}

export async function GET(req: NextRequest) {
  if (rateLimited(clientKey(req))) {
    return NextResponse.json({ error: 'Too many requests; try again in a minute' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }
  try {
    const response = await safeFetch(url);
    if (response.status < 200 || response.status >= 300) {
      return NextResponse.json({ error: `Site returned ${response.status}` }, { status: 502 });
    }
    if (!response.contentType.includes('text/html') && !response.contentType.includes('application/xhtml')) {
      return NextResponse.json({ error: 'URL did not return HTML' }, { status: 400 });
    }
    return NextResponse.json({ html: response.body, truncated: response.truncated }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof FetchRefused) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : 'Failed to fetch URL';
    return NextResponse.json({ error: /ENOTFOUND|EAI_AGAIN/.test(message) ? 'Host not found' : 'Failed to fetch URL' }, { status: 502 });
  }
}
