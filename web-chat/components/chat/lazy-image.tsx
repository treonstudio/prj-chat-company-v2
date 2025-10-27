"use client"

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { fetchMediaWithCache } from '@/lib/utils/media-cache'

interface LazyImageProps {
  src: string
  alt?: string
  className?: string
  width?: number
  height?: number
  fill?: boolean
  priority?: boolean
  onLoadStart?: () => void
  onLoadEnd?: () => void
}

/**
 * Lazy-loaded image component with caching
 * Uses IndexedDB cache to avoid re-downloading images
 */
export function LazyImage({
  src,
  alt = '',
  className = '',
  width,
  height,
  fill = false,
  priority = false,
  onLoadStart,
  onLoadEnd,
}: LazyImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  // Use refs to avoid re-running effect when callbacks change
  const onLoadStartRef = useRef(onLoadStart)
  const onLoadEndRef = useRef(onLoadEnd)

  // Update refs when callbacks change
  useEffect(() => {
    onLoadStartRef.current = onLoadStart
    onLoadEndRef.current = onLoadEnd
  }, [onLoadStart, onLoadEnd])

  useEffect(() => {
    let mounted = true

    async function loadImage() {
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
        console.error('Failed to load image:', err)
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

    loadImage()

    return () => {
      mounted = false
    }
  }, [src])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  if (!blobUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-md ${className}`}
        style={width && height ? { width, height } : { minHeight: '200px' }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="text-sm text-muted-foreground">Loading image...</span>
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
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm text-muted-foreground">Image</span>
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-destructive/10 rounded-md ${className}`}
        style={width && height ? { width, height } : { minHeight: '200px' }}
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
          <span className="text-sm">Failed to load image</span>
        </div>
      </div>
    )
  }

  return (
    <Image
      src={blobUrl}
      alt={alt}
      className={className}
      width={width}
      height={height}
      fill={fill}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      unoptimized // Using blob URLs, Next.js optimization not needed
    />
  )
}
