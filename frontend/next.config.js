/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Убираем rewrites — nginx проксирует /api напрямую на backend
}

module.exports = nextConfig
