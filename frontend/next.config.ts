import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Configure for Replit web hosting
  experimental: {
    forceSwcTransforms: true,
  },
  // Allow all hosts for Replit environment
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
  // Proxy API calls to backend server
  async rewrites() {
    return [
      // Commented out chapters proxy - using custom API route for auth
      // {
      //   source: '/api/chapters/:path*',
      //   destination: 'http://localhost:8080/api/chapters/:path*',
      // },
      {
        source: '/api/progress',
        destination: 'http://localhost:8080/api/progress',
      },
      {
        source: '/api/books/:path*',
        destination: 'http://localhost:8080/api/books/:path*',
      },
    ];
  },
};

export default nextConfig;
