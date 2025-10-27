/**
 * useStaticAsset Hook
 *
 * Loads and caches static assets (logos, icons, background patterns)
 * Returns blob URL for use in img src, background-image, etc.
 *
 * Usage:
 * ```tsx
 * const logoUrl = useStaticAsset('/logo-chatku.png', '1.0')
 * <div style={{ backgroundImage: `url(${logoUrl})` }} />
 * ```
 */

'use client'

import { useEffect, useState } from 'react'
import { getStaticAsset } from '@/lib/utils/static-asset-cache'

export function useStaticAsset(
  src: string,
  version?: string
): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadAsset() {
      try {
        const url = await getStaticAsset(src, version)
        if (mounted) {
          setBlobUrl(url)
        } else {
          // Cleanup blob URL if component unmounted before loading completed
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url)
          }
        }
      } catch (err) {
        console.error('Failed to load static asset:', err)
        if (mounted) {
          setBlobUrl(src) // Fallback to original URL
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

  return blobUrl
}
