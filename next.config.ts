import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve already-published pins without advertising the withdrawn beta.
  async headers() {
    return [{
      source: '/releases/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    }];
  },
};

export default nextConfig;
