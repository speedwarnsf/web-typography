import { NextRequest, NextResponse } from 'next/server';

/**
 * Content Security Policy for every page. Scripts run only with this
 * request's nonce (Next.js adds it to its own scripts) or when loaded by such
 * a script ('strict-dynamic'), so HTML injected into a page cannot run
 * script. Styles allow inline use because pages and the typeset engine style
 * elements directly; stylesheets, images and fonts may come from any https
 * origin because /audit and /dna render a fetched page's own styles.
 * Pages are rendered per request (see app/layout.tsx) so each gets a fresh
 * nonce. Static files, /releases/** and the API are not matched.
 */
function contentSecurityPolicy(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' data:",
    "media-src 'self'",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api/|_next/static|_next/image|releases/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
