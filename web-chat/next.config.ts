import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow images from Firebase Storage and Chatku Asset Server
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'chatku-asset.treonstudio.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'bc-asset.chatbcs.com',
        pathname: '**',
      },
    ],
    // Optimize images with better caching
    minimumCacheTTL: 31536000, // Cache for 1 year (images are immutable with Firebase Storage URLs)
    formats: ['image/webp', 'image/avif'], // Use modern formats for better compression
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840], // Responsive breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // Common image sizes (avatars, thumbnails)
  },
  // Add cache headers for static assets
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        locale: false,
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
