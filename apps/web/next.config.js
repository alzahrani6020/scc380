/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@scc/ui', '@scc/utils'],
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
