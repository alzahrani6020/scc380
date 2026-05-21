/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@scc/ui', '@scc/utils'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: (process.env.BACKEND_URL || 'http://localhost:3001') + '/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
