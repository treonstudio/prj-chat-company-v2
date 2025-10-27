/**
 * Media Cache Utility using IndexedDB
 * Caches downloaded media files (images/videos) to avoid re-downloading
 *
 * Features:
 * - Automatic cache eviction when storage limit reached
 * - LRU (Least Recently Used) cleanup policy
 * - 7-day expiration for stale entries
 * - Storage quota monitoring
 */

const DB_NAME = 'chatku-media-cache';
const STORE_NAME = 'media';
const DB_VERSION = 2; // Updated for lastAccessed field

// Cache expiration: 7 days
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Maximum cache size: 500MB (prevent IndexedDB from getting full)
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

// Cleanup threshold: when cache reaches 80% of max size, cleanup to 60%
const CLEANUP_THRESHOLD = 0.8; // 80%
const CLEANUP_TARGET = 0.6; // 60%

interface MediaCacheEntry {
  url: string;
  blob: Blob;
  mimeType: string;
  timestamp: number; // When first cached
  lastAccessed: number; // When last accessed (for LRU)
  size: number;
}

class MediaCacheDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        } else if (oldVersion < 2) {
          // Upgrade from v1 to v2: add lastAccessed index
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const store = transaction.objectStore(STORE_NAME);
            if (!store.indexNames.contains('lastAccessed')) {
              store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
            }
          }
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get cached media from IndexedDB
   * Updates lastAccessed timestamp for LRU tracking
   */
  async get(url: string): Promise<Blob | null> {
    try {
      const db = await this.init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(url);

        request.onsuccess = () => {
          const entry = request.result as MediaCacheEntry | undefined;

          if (!entry) {
            resolve(null);
            return;
          }

          // Check if cache is expired
          const now = Date.now();
          if (now - entry.timestamp > CACHE_DURATION) {
            // Cache expired, delete it
            this.delete(url);
            resolve(null);
            return;
          }

          // Update lastAccessed for LRU tracking
          entry.lastAccessed = now;
          const updateRequest = store.put(entry);
          updateRequest.onerror = () => {
            console.error('Failed to update lastAccessed:', updateRequest.error);
          };

          resolve(entry.blob);
        };

        request.onerror = () => {
          console.error('Failed to get media from cache:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('Error getting cached media:', error);
      return null;
    }
  }

  /**
   * Save media to IndexedDB cache
   * Automatically cleans up old entries if storage limit reached
   */
  async set(url: string, blob: Blob, mimeType: string): Promise<void> {
    try {
      // Check if we need to cleanup before adding new entry
      const cacheInfo = await this.getCacheInfo();
      const newSize = cacheInfo.totalSize + blob.size;

      // If adding this would exceed threshold, cleanup first
      if (newSize > MAX_CACHE_SIZE * CLEANUP_THRESHOLD) {
        console.log('Cache threshold reached, cleaning up...');
        await this.cleanupLRU();
      }

      const db = await this.init();
      const now = Date.now();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const entry: MediaCacheEntry = {
          url,
          blob,
          mimeType,
          timestamp: now,
          lastAccessed: now,
          size: blob.size,
        };

        const request = store.put(entry);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to save media to cache:', request.error);
          reject(request.error);
        };

        transaction.oncomplete = () => {
          // Clean up expired entries after successful save
          this.cleanupOldEntries();
        };
      });
    } catch (error) {
      console.error('Error saving media to cache:', error);
    }
  }

  /**
   * Delete a cached media entry
   */
  async delete(url: string): Promise<void> {
    try {
      const db = await this.init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(url);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to delete media from cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error deleting cached media:', error);
    }
  }

  /**
   * Clear all cached media
   */
  async clear(): Promise<void> {
    try {
      const db = await this.init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to clear media cache:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error clearing media cache:', error);
    }
  }

  /**
   * Get cache size and entry count
   */
  async getCacheInfo(): Promise<{ count: number; totalSize: number }> {
    try {
      const db = await this.init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const entries = request.result as MediaCacheEntry[];
          const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
          resolve({
            count: entries.length,
            totalSize,
          });
        };

        request.onerror = () => {
          console.error('Failed to get cache info:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error getting cache info:', error);
      return { count: 0, totalSize: 0 };
    }
  }

  /**
   * Clean up least recently used entries to free up space
   * Uses LRU (Least Recently Used) eviction policy
   */
  private async cleanupLRU(): Promise<void> {
    try {
      const db = await this.init();

      // Get all entries sorted by lastAccessed (oldest first)
      const entries = await new Promise<MediaCacheEntry[]>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('lastAccessed');
        const request = index.getAll();

        request.onsuccess = () => {
          resolve(request.result as MediaCacheEntry[]);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });

      // Calculate current total size
      let totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
      const targetSize = MAX_CACHE_SIZE * CLEANUP_TARGET;

      // Delete oldest entries until we reach target size
      const toDelete: string[] = [];
      let deletedSize = 0;

      for (const entry of entries) {
        if (totalSize - deletedSize <= targetSize) {
          break;
        }

        toDelete.push(entry.url);
        deletedSize += entry.size;
      }

      if (toDelete.length > 0) {
        console.log(`Cleaning up ${toDelete.length} LRU entries (${(deletedSize / 1024 / 1024).toFixed(2)}MB)`);

        // Delete the entries
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        for (const url of toDelete) {
          store.delete(url);
        }

        await new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });

        console.log('LRU cleanup completed');
      }
    } catch (error) {
      console.error('Error during LRU cleanup:', error);
    }
  }

  /**
   * Clean up expired entries
   */
  private async cleanupOldEntries(): Promise<void> {
    try {
      const db = await this.init();
      const now = Date.now();

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry = cursor.value as MediaCacheEntry;

          // Delete if expired
          if (now - entry.timestamp > CACHE_DURATION) {
            cursor.delete();
          }

          cursor.continue();
        }
      };
    } catch (error) {
      console.error('Error cleaning up old entries:', error);
    }
  }
}

// Singleton instance
const mediaCacheDB = new MediaCacheDB();

/**
 * Fetch media with caching support
 * Returns blob URL that should be revoked when no longer needed
 *
 * NOTE: Only caches images. Videos are too large and browser HTTP cache handles them better.
 */
export async function fetchMediaWithCache(url: string): Promise<string> {
  try {
    // Try to get from cache first
    const cachedBlob = await mediaCacheDB.get(url);

    if (cachedBlob) {
      return URL.createObjectURL(cachedBlob);
    }

    // Not in cache, fetch from network
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.status}`);
    }

    const blob = await response.blob();
    const mimeType = response.headers.get('content-type') || blob.type;

    // Only cache images (not videos - too large, browser HTTP cache is better)
    if (mimeType.startsWith('image/')) {
      // Save to cache (async, don't wait)
      mediaCacheDB.set(url, blob, mimeType).catch(error => {
        console.error('Failed to cache media:', error);
      });
    }

    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error fetching media:', error);
    // Fallback to original URL
    return url;
  }
}

/**
 * Download media with caching support
 *
 * NOTE: Only caches images. Videos are not cached (too large, let browser handle it).
 */
export async function downloadMediaWithCache(
  url: string,
  filename?: string,
  mimeType?: string
): Promise<Blob> {
  // Try to get from cache first (will only have images)
  const cachedBlob = await mediaCacheDB.get(url);

  if (cachedBlob) {
    return cachedBlob;
  }

  // Not in cache, fetch from network
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  const blob = await response.blob();
  const detectedMimeType = response.headers.get('content-type') || blob.type;

  // Only cache images (not videos - too large)
  if (detectedMimeType.startsWith('image/')) {
    // Save to cache (async, don't wait)
    mediaCacheDB.set(url, blob, detectedMimeType).catch(error => {
      console.error('Failed to cache media:', error);
    });
  }

  return blob;
}

/**
 * Preload media into cache (for prefetching)
 */
export async function preloadMediaToCache(url: string): Promise<void> {
  try {
    // Check if already cached
    const cached = await mediaCacheDB.get(url);
    if (cached) return;

    // Fetch and cache
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) return;

    const blob = await response.blob();
    const mimeType = response.headers.get('content-type') || blob.type;

    await mediaCacheDB.set(url, blob, mimeType);
  } catch (error) {
    console.error('Error preloading media:', error);
  }
}

/**
 * Clear all media cache
 */
export async function clearMediaCache(): Promise<void> {
  return mediaCacheDB.clear();
}

/**
 * Get media cache statistics
 */
export async function getMediaCacheInfo(): Promise<{ count: number; totalSize: number }> {
  return mediaCacheDB.getCacheInfo();
}

/**
 * Get detailed storage statistics including browser quota
 */
export async function getStorageStats(): Promise<{
  cacheSize: number;
  cacheCount: number;
  maxCacheSize: number;
  usagePercent: number;
  browserQuota?: {
    usage: number;
    quota: number;
    usagePercent: number;
  };
}> {
  const cacheInfo = await mediaCacheDB.getCacheInfo();

  const stats = {
    cacheSize: cacheInfo.totalSize,
    cacheCount: cacheInfo.count,
    maxCacheSize: MAX_CACHE_SIZE,
    usagePercent: (cacheInfo.totalSize / MAX_CACHE_SIZE) * 100,
  };

  // Try to get browser storage quota (may not be available in all browsers)
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage !== undefined && estimate.quota !== undefined) {
        return {
          ...stats,
          browserQuota: {
            usage: estimate.usage,
            quota: estimate.quota,
            usagePercent: (estimate.usage / estimate.quota) * 100,
          },
        };
      }
    } catch (error) {
      console.error('Failed to get storage estimate:', error);
    }
  }

  return stats;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
