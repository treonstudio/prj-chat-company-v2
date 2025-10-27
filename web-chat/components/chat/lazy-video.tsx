"use client"

import { useEffect, useRef, useState } from 'react'
import { fetchMediaWithCache } from '@/lib/utils/media-cache'

interface LazyVideoProps {
  src: string
  mimeType?: string
  className?: string
  controls?: boolean
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  playsInline?: boolean
  poster?: string
  onLoadStart?: () => void
  onLoadEnd?: () => void
}

/**
 * Lazy-loaded video component with caching
 * Only loads video when near viewport to prevent network congestion
 */
export function LazyVideo({
  src,
  mimeType = 'video/mp4',
  className = '',
  controls = true,
  autoPlay = false,
  loop = false,
  muted = false,
  playsInline = true,
  poster,
  onLoadStart,
  onLoadEnd,
}: LazyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)

  // Use refs to avoid re-running effect when callbacks change
  const onLoadStartRef = useRef(onLoadStart)
  const onLoadEndRef = useRef(onLoadEnd)

  // Update refs when callbacks change
  useEffect(() => {
    onLoadStartRef.current = onLoadStart
    onLoadEndRef.current = onLoadEnd
  }, [onLoadStart, onLoadEnd])

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true)
            // Once visible, keep it loaded even if scrolled away
            observer.disconnect()
          }
        })
      },
      {
        // Load when video is 200px away from viewport
        rootMargin: '200px',
        threshold: 0,
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  // Load video when intersecting
  useEffect(() => {
    if (!isIntersecting || blobUrl || isLoading) return

    let mounted = true

    async function loadVideo() {
      setIsLoading(true)
      onLoadStartRef.current?.()

      try {
        const url = await fetchMediaWithCache(src)

        if (mounted) {
          setBlobUrl(url)
          setError(false)
        } else {
          // Component unmounted before load completed, revoke blob URL
          URL.revokeObjectURL(url)
        }
      } catch (err) {
        console.error('Failed to load video:', err)
        if (mounted) {
          setError(true)
          // Fallback to original URL
          setBlobUrl(src)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
          onLoadEndRef.current?.()
        }
      }
    }

    loadVideo()

    return () => {
      mounted = false
    }
  }, [isIntersecting, src, blobUrl, isLoading])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  return (
    <div ref={containerRef} className="relative">
      {!blobUrl && !error && (
        <div
          className={`flex items-center justify-center bg-muted rounded-md ${className}`}
          style={{ minHeight: '200px' }}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Loading video...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg
                className="h-12 w-12 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-muted-foreground">Video</span>
            </div>
          )}
        </div>
      )}

      {blobUrl && (
        <video
          ref={videoRef}
          className={className}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          playsInline={playsInline}
          poster={poster}
          preload="metadata"
        >
          <source src={blobUrl} type={mimeType} />
          Your browser does not support the video tag.
        </video>
      )}

      {error && (
        <div
          className={`flex items-center justify-center bg-destructive/10 rounded-md ${className}`}
          style={{ minHeight: '200px' }}
        >
          <div className="flex flex-col items-center gap-2 text-destructive">
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
      )}
    </div>
  )
}
