/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for Cloudflare Pages
  images: {
    unoptimized: true,
  },
  // Enable standalone output for Docker deployment
  output: 'standalone',
};

module.exports = nextConfig;
