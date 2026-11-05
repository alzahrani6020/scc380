/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  transpilePackages: ['@scc/ui', '@scc/utils'],
  // تتبّع الملفات من جذر المونوريبو — ضروري لأن مخزن pnpm (node_modules/.pnpm)
  // يقع خارج apps/web؛ بدون هذا ينكسر تغليف Vercel بمسار /node_modules من جذر النظام (ENOENT styled-jsx)
  outputFileTracingRoot: path.join(__dirname, '../..'),
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
