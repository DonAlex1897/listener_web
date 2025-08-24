/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable HTTPS for localhost development to access microphone
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://localhost:5183/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
