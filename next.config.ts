import type { NextConfig } from "next";

// Files other sites load from typeset.us. Versioned files never change, so
// they are cached for a year; aliases and indexes change at each release and
// are revalidated after five minutes. All of them are readable cross-origin.
const IMMUTABLE = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
];
const REVALIDATED = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Cache-Control', value: 'public, max-age=300, must-revalidate' },
];

// Every response: no MIME sniffing, no framing by other sites, and no full
// URLs in Referer. Pages also get a nonce-based CSP from src/proxy.ts.
const SECURITY = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [{ source: '/releases/:version', destination: '/releases/:version/index.html' }];
  },
  // Preserve already-published pins without advertising the withdrawn beta.
  // Later entries override earlier ones for the same header.
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY },
      { source: '/go@:version(\\d+\\.\\d+\\.\\d+).js', headers: IMMUTABLE },
      { source: '/typeset@:version(\\d+\\.\\d+\\.\\d+).:kind(min|esm).js', headers: IMMUTABLE },
      { source: '/releases/:path*', headers: IMMUTABLE },
      // The ledger is appended at every release.
      { source: '/releases/published.json', headers: REVALIDATED },
      // go@4.js follows 4.x; go.js and the other aliases follow 4.x only.
      { source: '/go@:major(\\d+).js', headers: REVALIDATED },
      { source: '/:file(go\\.js|typeset\\.min\\.js|typeset\\.esm\\.js|typeset\\.css|typeset\\.global\\.js\\.map|sri\\.json|release\\.json|for-agents\\.md|capabilities\\.json|llms\\.txt)', headers: REVALIDATED },
    ];
  },
};

export default nextConfig;
