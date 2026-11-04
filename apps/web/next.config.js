/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  transpilePackages: ['@scc/ui', '@scc/utils'],
  // تتبّع الملفات من جذر التطبيق نفسه — يمنع مسارات nft النسبية التي تكسر تغليف Vercel في المونوريبو (pnpm)
  outputFileTracingRoot: path.join(__dirname),
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
