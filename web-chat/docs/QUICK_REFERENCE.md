# Quick Reference Guide

Fast lookup untuk common tasks dan troubleshooting.

---

## 🚀 Quick Fixes

### Chat Terasa Lag

```typescript
// 1. Check re-renders
// Open React DevTools → Profiler
// Record interaction → Check "Ranked" view

// 2. Verify memo applied
// File: components/chat/chat-message.tsx
export const ChatMessage = memo(...) // ✅ Should exist

// 3. Check callbacks stable
// File: components/chat/chat-room.tsx
const handleClick = useCallback(...) // ✅ Should use useCallback
```

**Expected FPS:** 50-60 FPS
**If < 30 FPS:** Performance issue!

---

### Video Download Semua

```bash
# Check Network tab
DevTools → Network → Filter: Media

Expected:
- No video requests on chat load
- Video only loads when clicked

Actual problem:
- Multiple video requests
- Large file sizes (2-3MB)

Fix:
- Already implemented (placeholder approach)
- If still downloading: Check video element has no preload attribute
```

---

### Image Tidak Ke-cache

```typescript
// 1. Check IndexedDB
// DevTools → Application → IndexedDB → chatku-media-cache

// 2. Verify cache enabled
const info = await getMediaCacheInfo()
console.log(info) // Should show cached images

// 3. Check CORS
// Console should not show CORS errors

// 4. Verify component usage
<LazyImage src={url} /> // ✅ Correct
<img src={url} />        // ❌ Wrong (not cached)
```

---

### Storage Penuh

```typescript
// Check storage
const stats = await getStorageStats()
console.log('Usage:', stats.usagePercent, '%')

// If > 80%: Should auto-cleanup
// Manual cleanup:
await clearMediaCache()
```

---

## 📊 Performance Checks

### Quick Performance Test

```typescript
// 1. Chat Load Time
const start = performance.now()
// ... load chat
const end = performance.now()
console.log('Load time:', end - start, 'ms')

Target: < 500ms
Alert if: > 2000ms
```

### Network Usage

```bash
# Open Network tab
# Load chat with 10 videos

Expected:
- 0-50 KB total (images only)
- 0 KB videos (placeholder)

Alert if:
- > 10 MB (videos auto-downloading)
```

### FPS Check

```typescript
// Use Chrome DevTools Performance
// Record 5 seconds of scrolling
// Check FPS chart

Target: 55-60 FPS
OK: 45-55 FPS
Bad: < 30 FPS
```

---

## 🔧 Common Commands

### Clear Cache

```typescript
// Clear media cache (images)
import { clearMediaCache } from '@/lib/utils/media-cache'
await clearMediaCache()

// Clear static cache (logos, icons, backgrounds)
import { clearStaticCache } from '@/lib/utils/static-asset-cache'
await clearStaticCache()
```

### Check Cache Stats

```typescript
// Media cache info (images from messages)
const info = await getMediaCacheInfo()
console.log(`${info.count} items, ${formatBytes(info.totalSize)}`)

// Detailed stats
const stats = await getStorageStats()
console.log('Cache:', formatBytes(stats.cacheSize))
console.log('Usage:', stats.usagePercent.toFixed(1) + '%')

// Static assets are cached separately in 'chatku-static-assets' database
```

### Force Cleanup

```typescript
// Trigger LRU cleanup manually
const mediaCacheDB = new MediaCacheDB()
await mediaCacheDB.cleanupLRU()
```

---

## 📝 Code Snippets

### Optimize Component

```typescript
// Before
export function MyComponent({ data, onClick }) {
  return <div onClick={() => onClick(data.id)}>...</div>
}

// After
export const MyComponent = memo(function MyComponent({ data, onClick }) {
  return <div onClick={onClick}>...</div>
}, (prev, next) => prev.data.id === next.data.id)

// Parent
const handleClick = useCallback((id) => {
  doSomething(id)
}, [])
```

### Add Image Caching

```typescript
// Before
<img src={imageUrl} alt="Image" />

// After (for message images)
import { LazyImage } from '@/components/chat/lazy-image'

<LazyImage src={imageUrl} alt="Image" fill />
```

### Static Asset Caching

```typescript
// For logos, icons, backgrounds (img tag)
import { StaticImage } from '@/components/ui/static-image'

<StaticImage
  src="/logo-chatku.png"
  alt="Logo"
  version="1.0"
  width={160}
  height={60}
/>

// For background images (CSS)
import { useStaticAsset } from '@/lib/hooks/use-static-asset'

const bgUrl = useStaticAsset('/tile-pattern.png', '1.0')
<div style={{ backgroundImage: `url(${bgUrl})` }} />

// Preload on app init
import { preloadStaticAssets } from '@/lib/utils/static-asset-cache'

useEffect(() => {
  preloadStaticAssets()
}, [])
```

### Video with Thumbnail

```typescript
// Upload
import { extractVideoThumbnail } from '@/lib/utils/video-thumbnail-generator'

const thumbnailBlob = await extractVideoThumbnail(videoFile)
const thumbnailUrl = await uploadToServer(thumbnailBlob)

// Display
import { VideoWithThumbnail } from '@/components/chat/video-with-thumbnail'

<VideoWithThumbnail
  videoUrl={videoUrl}
  thumbnailUrl={thumbnailUrl}
  onClick={playVideo}
/>
```

---

## 🐛 Debug Checklist

### Chat Load Slow

- [ ] Check Network tab (< 1MB initial load)
- [ ] Check React Profiler (< 500ms render)
- [ ] Verify memo applied to ChatMessage
- [ ] Check for inline functions
- [ ] Verify useCallback for handlers

### Videos Auto-Downloading

- [ ] Check video element has no src in chat list
- [ ] Verify placeholder showing
- [ ] Check Network tab for video requests
- [ ] Verify preview dialog loads on click

### Images Not Showing

- [ ] Check IndexedDB has entries
- [ ] Verify LazyImage component used
- [ ] Check console for errors
- [ ] Test with Disable Cache off

### High Memory Usage

- [ ] Check IndexedDB size (< 500MB)
- [ ] Verify blob URLs revoked
- [ ] Check for memory leaks
- [ ] Clear cache if needed

---

## 📈 Metrics Targets

| Metric | Target | Alert If |
|--------|--------|----------|
| Chat Load | < 500ms | > 2s |
| Scroll FPS | > 50 | < 30 |
| Initial Bandwidth | < 1MB | > 10MB |
| Cache Hit Rate | > 80% | < 50% |
| Memory Usage | < 200MB | > 500MB |

---

## 🔗 Quick Links

- [Full Documentation](./PERFORMANCE_OPTIMIZATION.md)
- [Video Strategy](./VIDEO_LOADING_STRATEGY.md)
- [React Memo Docs](https://react.dev/reference/react/memo)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

## 💡 Tips

### Development
```bash
# Always test with Disable Cache OFF
# Use React DevTools Profiler
# Monitor Network tab
# Check IndexedDB regularly
```

### Production
```bash
# Monitor performance metrics
# Track cache hit rate
# Alert on high bandwidth
# Review error logs
```

### Optimization Priority
```
1. Fix critical lag (React.memo)
2. Reduce bandwidth (video strategy)
3. Add caching (IndexedDB)
4. Fine-tune (advanced optimizations)
```

---

**Last Updated:** 2025-01-28
