/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL_INTERNAL || 'http://backend:8000'}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig