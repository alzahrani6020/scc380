/** @type {import('next').NextConfig} */
const path = require('path');

// In production, serve browser API requests through the same-origin Next.js
// reverse proxy. NestJS mounts controllers at /auth, /crm, etc. (without
// a global /api prefix), while the browser uses the /api namespace.
const apiOrigin = (
  process.env.API_INTERNAL_URL?.match(/^https?:\/\//)?.[0] && process.env.API_INTERNAL_URL
  || (process.env.NEXT_PUBLIC_API_URL?.match(/^https?:\/\//)?.[0] && process.env.NEXT_PUBLIC_API_URL)
  || (process.env.NODE_ENV === 'production' ? 'https://scc380-api.onrender.com' : 'http://localhost:3001')
).replace(/\/+$/, '').replace(/\/api$/, '');

const nextConfig = {
  async rewrites() {
    // afterFiles rewrites preserve the local /api/auth/session handler.
    return { afterFiles: [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }] };
  },
  transpilePackages: ['@scc/ui', '@scc/utils'],
  // Next.js 14: monorepo tracing remains experimental.
  experimental: {
    // تتبّع الملفات من جذر المونوريبو — ضروري لأن مخزن pnpm (node_modules/.pnpm)
    // يقع خارج apps/web؛ بدون هذا ينكسر تغليف Vercel بمسار /node_modules من جذر النظام (ENOENT styled-jsx)
    outputFileTracingRoot: path.join(__dirname, '../..'),
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'),
  },
};

module.exports = nextConfig;
