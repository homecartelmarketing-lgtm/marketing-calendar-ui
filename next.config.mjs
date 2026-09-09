/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    '192.168.0.195',
    '192.168.0.195:3000',
    'localhost:3000',
    '*.trycloudflare.com',
    'trycloudflare.com',
  ],
}

export default nextConfig
