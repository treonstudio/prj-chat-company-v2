/**
 * Static Asset Cache
 * Cache untuk logo, icons, background patterns yang tidak berubah
 *
 * Strategy:
 * - Cache static assets di IndexedDB
 * - Long-term cache (30 days)
 * - Preload on app init
 */

const STATIC_CACHE_DB = 'chatku-static-assets'
const STATIC_CACHE_STORE = 'assets'
const STATIC_CACHE_VERSION = 1

// Cache duration: 30 days (static assets rarely change)
const STATIC_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000

interface StaticAssetEntry {
  url: string
  blob: Blob
  mimeType: string
  timestamp: number
  version: string // Asset version for cache busting
}

class StaticAssetCache {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(STATIC_CACHE_DB, STATIC_CACHE_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STATIC_CACHE_STORE)) {
          const store = db.createObjectStore(STATIC_CACHE_STORE, { keyPath: 'url' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  async get(url: string, version?: string): Promise<Blob | null> {
    try {
      const db = await this.init()

      return new Promise((resolve) => {
        const transaction = db.transaction([STATIC_CACHE_STORE], 'readonly')
        const store = transaction.objectStore(STATIC_CACHE_STORE)
        const request = store.get(url)

        request.onsuccess = () => {
          const entry = request.result as StaticAssetEntry | undefined

          if (!entry) {
            resolve(null)
            return
          }

          // Check version match
          if (version && entry.version !== version) {
            this.delete(url) // Outdated version
            resolve(null)
            return
          }

          // Check expiration (30 days)
          const now = Date.now()
          if (now - entry.timestamp > STATIC_CACHE_DURATION) {
            this.delete(url)
            resolve(null)
            return
          }

          resolve(entry.blob)
        }

        request.onerror = () => resolve(null)
      })
    } catch (error) {
      console.error('Error getting static asset:', error)
      return null
    }
  }

  async set(url: string, blob: Blob, mimeType: string, version: string = '1.0'): Promise<void> {
    try {
      const db = await this.init()

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STATIC_CACHE_STORE], 'readwrite')
        const store = transaction.objectStore(STATIC_CACHE_STORE)

        const entry: StaticAssetEntry = {
          url,
          blob,
          mimeType,
          timestamp: Date.now(),
          version,
        }

        const request = store.put(entry)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error caching static asset:', error)
    }
  }

  async delete(url: string): Promise<void> {
    try {
      const db = await this.init()

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STATIC_CACHE_STORE], 'readwrite')
        const store = transaction.objectStore(STATIC_CACHE_STORE)
        const request = store.delete(url)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error deleting static asset:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.init()

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STATIC_CACHE_STORE], 'readwrite')
        const store = transaction.objectStore(STATIC_CACHE_STORE)
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error clearing static cache:', error)
    }
  }
}

const staticAssetCache = new StaticAssetCache()

/**
 * Get static asset with caching
 * Returns blob URL for instant display
 */
export async function getStaticAsset(
  url: string,
  version?: string
): Promise<string> {
  try {
    // Try cache first
    const cachedBlob = await staticAssetCache.get(url, version)

    if (cachedBlob) {
      return URL.createObjectURL(cachedBlob)
    }

    // Not in cache, fetch from network
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const blob = await response.blob()
    const mimeType = response.headers.get('content-type') || blob.type

    // Cache for future use (async, don't wait)
    staticAssetCache.set(url, blob, mimeType, version).catch(error => {
      console.error('Failed to cache static asset:', error)
    })

    return URL.createObjectURL(blob)
  } catch (error) {
    console.error('Error loading static asset:', error)
    // Fallback to original URL
    return url
  }
}

/**
 * Preload critical static assets on app init
 * Call this in _app.tsx or root layout
 */
export async function preloadStaticAssets() {
  const criticalAssets = [
    { url: '/logo-chatku.png', version: '1.0' },
    { url: '/tile-pattern.png', version: '1.0' },
    { url: '/illus-start-message.webp', version: '1.0' },
    // Add more critical assets
  ]

  console.log('Preloading static assets...')

  const promises = criticalAssets.map(async ({ url, version }) => {
    try {
      await getStaticAsset(url, version)
      console.log('Preloaded:', url)
    } catch (error) {
      console.warn('Failed to preload:', url, error)
    }
  })

  await Promise.all(promises)
  console.log('Static assets preloaded!')
}

/**
 * Clear static asset cache
 */
export async function clearStaticCache(): Promise<void> {
  return staticAssetCache.clear()
}

/**
 * Version management for cache busting
 * Increment version when assets change
 */
export const ASSET_VERSIONS = {
  logo: '1.0',
  background: '1.0',
  icons: '1.0',
  illustrations: '1.0',
} as const
