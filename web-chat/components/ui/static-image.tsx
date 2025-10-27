/**
 * StaticImage Component
 *
 * Caches static assets (logos, icons, background patterns) in IndexedDB
 * for instant loading on subsequent visits.
 *
 * Usage:
 * ```tsx
 * <StaticImage src="/logo-chatku.png" alt="Logo" version="1.0" />
 * ```
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { getStaticAsset } from '@/lib/utils/static-asset-cache'

interface StaticImageProps {
  src: string
  alt?: string
  className?: string
  width?: number
  height?: number
  version?: string
  style?: React.CSSProperties
  onLoad?: () => void
  onError?: () => void
}

export function StaticImage({
  src,
  alt = '',
  className = '',
  width,
  height,
  version,
  style,
  onLoad,
  onError,
}: StaticImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  // Use refs to avoid re-running effect when callbacks change
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onLoadRef.current = onLoad
    onErrorRef.current = onError
  }, [onLoad, onError])

  useEffect(() => {
    let mounted = true

    async function loadAsset() {
      setIsLoading(true)

      try {
        const url = await getStaticAsset(src, version)
        if (mounted) {
          setBlobUrl(url)
          setError(false)
        } else {
          // Cleanup blob URL if component unmounted before loading completed
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url)
          }
        }
      } catch (err) {
        console.error('Failed to load static asset:', err)
        if (mounted) {
          setError(true)
          setBlobUrl(src) // Fallback to original URL
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadAsset()

    return () => {
      mounted = false
      // Cleanup blob URL on unmount
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [src, version])

  // Call onLoad/onError callbacks
  useEffect(() => {
    if (!isLoading) {
      if (error) {
        onErrorRef.current?.()
      } else {
        onLoadRef.current?.()
      }
    }
  }, [isLoading, error])

  if (!blobUrl) {
    return (
      <div
        className={className}
        style={{
          ...style,
          width: width ? `${width}px` : style?.width,
          height: height ? `${height}px` : style?.height,
          backgroundColor: '#f0f2f5',
        }}
      />
    )
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      width={width}
      height={height}
      style={style}
    />
  )
}
