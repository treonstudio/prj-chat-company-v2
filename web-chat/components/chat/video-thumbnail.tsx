"use client"

import { useState } from 'react'

interface VideoThumbnailProps {
  src: string
  mimeType?: string
  className?: string
  onClick?: () => void
}

/**
 * Video thumbnail component - WhatsApp-like approach
 * Shows video element with preload="none" to avoid downloading until user clicks
 * Browser handles streaming naturally when user plays
 */
export function VideoThumbnail({
  src,
  mimeType = 'video/mp4',
  className = '',
  onClick,
}: VideoThumbnailProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-md ${className}`}>
        <div className="flex flex-col items-center gap-2 text-destructive p-8">
          <svg
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm">Failed to load video</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <video
        className={className}
        preload="none"
        playsInline
        onClick={onClick}
        onError={() => setHasError(true)}
        style={{
          maxHeight: '500px',
          objectFit: 'contain',
        }}
      >
        <source src={src} type={mimeType} />
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
