"use client"

import { useState } from 'react'
import Image from 'next/image'

interface VideoWithThumbnailProps {
  videoUrl: string
  thumbnailUrl?: string
  mimeType?: string
  className?: string
  onClick?: () => void
}

/**
 * WhatsApp-style video display
 * Shows thumbnail image (no download), streams video only when user clicks
 *
 * Approach:
 * 1. Show thumbnail image (20KB) - instant load
 * 2. User clicks → Open video in dialog OR start streaming
 * 3. No bandwidth wasted on videos user doesn't watch
 */
export function VideoWithThumbnail({
  videoUrl,
  thumbnailUrl,
  mimeType = 'video/mp4',
  className = '',
  onClick,
}: VideoWithThumbnailProps) {
  const [imageError, setImageError] = useState(false)

  // If no thumbnail, fallback to video poster (but still preload="none")
  if (!thumbnailUrl || imageError) {
    return (
      <div className="relative">
        <video
          className={className}
          preload="none"
          playsInline
          onClick={onClick}
          style={{
            maxHeight: '500px',
            objectFit: 'contain',
          }}
        >
          <source src={videoUrl} type={mimeType} />
          Your browser does not support the video tag.
        </video>

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <svg
              className="w-8 h-8 text-green-600 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  // Show thumbnail image with play button
  return (
    <div
      className="relative cursor-pointer group"
      onClick={onClick}
    >
      {/* Thumbnail image - ONLY THIS LOADS (20KB instead of 20MB!) */}
      <Image
        src={thumbnailUrl}
        alt="Video thumbnail"
        width={450}
        height={300}
        className={`${className} rounded-md`}
        style={{
          maxHeight: '500px',
          objectFit: 'cover',
        }}
        loading="lazy"
        onError={() => setImageError(true)}
        unoptimized
      />

      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:bg-white transition-colors">
          <svg
            className="w-8 h-8 text-green-600 ml-1"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* Video duration badge (optional - if you track it) */}
      <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs">
        <svg
          className="w-3 h-3 inline mr-1"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Video
      </div>
    </div>
  )
}
