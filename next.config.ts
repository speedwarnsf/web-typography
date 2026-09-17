import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [{ source: '/releases/:version', destination: '/releases/:version/index.html' }];
  },
  // Preserve already-published pins without advertising the withdrawn beta.
  async headers() {
    return [{
      source: '/go@:version.js',
      headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }, {
      source: '/releases/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    }];
  },
};

export default nextConfig;
