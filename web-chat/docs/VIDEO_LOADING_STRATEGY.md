# Video Loading Strategy

Guide untuk handling video di chat application tanpa membebani bandwidth.

---

## 🎯 Problem

**Sebelumnya:**
```
User buka chat dengan 10 video (@ 20MB)
→ Auto-download 200MB
→ Network penuh
→ Chat hang 1-2 menit
→ UX buruk
```

**Sekarang:**
```
User buka chat dengan 10 video
→ Download 0MB (placeholder only)
→ Network idle
→ Chat instant
→ UX smooth
```

---

## 📋 Implementation

### Current Approach: Placeholder

**File:** `components/chat/chat-message.tsx`

```tsx
{/* Video placeholder - no download until user clicks */}
<div className="video-placeholder">
  {/* Video icon */}
  <svg>...</svg>
  <span>Video</span>

  {/* Play button */}
  <button onClick={() => openVideoPreview()}>
    <PlayIcon />
  </button>
</div>
```

**Flow:**
```
1. Chat loads → Show placeholder (0 bytes)
2. User sees video icon + play button
3. User clicks → Open preview dialog
4. Preview dialog → Load & stream video
5. Browser cache → Cache for replay
```

---

## 🔧 Why Not `preload="metadata"`?

### Expected Behavior:
```html
<video preload="metadata" src="video.mp4" />

Should:
- Download ~50KB metadata
- Show first frame as thumbnail
- Full video loads on play
```

### Actual Behavior:
```
Server: Chatku Asset (https://chatku-asset.treonstudio.com)
Problem: No HTTP Range Request support

Request:
GET /video/abc123
Range: bytes=0-65536  ← Request metadata only

Response:
HTTP/1.1 200 OK  ← Should be 206!
Content-Length: 2865000  ← Full file!
[...full 2.8MB video data...]
```

**Result:** Full video downloaded bahkan dengan `preload="metadata"`! ❌

---

## ✅ Solutions

### Option 1: Placeholder (Current) ⭐ Implemented

**Pros:**
- ✅ 0 bytes bandwidth
- ✅ Instant chat load
- ✅ No server changes needed
- ✅ Works immediately

**Cons:**
- ⚠️ No video preview (generic icon)
- ⚠️ User doesn't see video content

**When to use:**
- Quick fix needed
- Server can't be changed
- Bandwidth critical

---

### Option 2: Client Thumbnail Generation ⭐ Recommended

**Implementation:**

```typescript
import { extractVideoThumbnail } from '@/lib/utils/video-thumbnail-generator'

async function uploadVideo(videoFile: File) {
  // 1. Extract thumbnail (client-side)
  const thumbnailBlob = await extractVideoThumbnail(videoFile, {
    timeOffset: 1,     // 1 second into video
    width: 320,        // 320px wide
    quality: 0.7       // 70% quality
  })

  // 2. Upload thumbnail (20KB)
  const thumbnailUrl = await uploadToServer(thumbnailBlob)

  // 3. Upload video
  const videoUrl = await uploadToServer(videoFile)

  // 4. Save both
  return { videoUrl, thumbnailUrl }
}
```

**Display:**
```tsx
<VideoWithThumbnail
  thumbnailUrl={message.thumbnailUrl}  // 20KB
  videoUrl={message.videoUrl}          // 0KB until play
  onClick={() => playVideo()}
/>
```

**Pros:**
- ✅ 20KB thumbnail (not 2.8MB!)
- ✅ User sees video preview
- ✅ No server changes
- ✅ Professional UX

**Cons:**
- ⚠️ Slightly slower upload
- ⚠️ Client processing needed
- ⚠️ Extra storage for thumbnails

**When to use:**
- Production apps
- Good UX priority
- Can't change server

---

### Option 3: Fix Server (Best) ⭐⭐⭐

**Backend Implementation:**

```javascript
// Express.js example
app.get('/video/:id', (req, res) => {
  const range = req.headers.range
  const videoPath = getVideoPath(req.params.id)
  const stat = fs.statSync(videoPath)
  const fileSize = stat.size

  if (range) {
    // Parse Range header
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = (end - start) + 1

    // Send partial content (206)
    const file = fs.createReadStream(videoPath, { start, end })
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    })
    file.pipe(res)
  } else {
    // Send full file
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    })
    fs.createReadStream(videoPath).pipe(res)
  }
})
```

**Frontend:**
```tsx
{/* Now preload="metadata" works correctly! */}
<video preload="metadata" src={videoUrl} />
```

**Pros:**
- ✅ Perfect browser integration
- ✅ Automatic thumbnail
- ✅ Progressive streaming
- ✅ Industry standard

**Cons:**
- ⚠️ Backend changes required
- ⚠️ Need server access

**When to use:**
- Have backend access
- Long-term solution
- Professional platform

---

## 📊 Comparison

| Feature | Placeholder | Thumbnail | Server Fix |
|---------|------------|-----------|------------|
| **Bandwidth** | 0 KB | 20 KB | 10-50 KB |
| **UX** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Setup** | Done ✅ | 2-4 hours | 4-8 hours |
| **Preview** | Icon only | Thumbnail | First frame |
| **Backend** | No change | No change | Must change |
| **Best for** | Quick fix | Production | Long-term |

---

## 🚀 Implementation Guide

### Step 1: Current (Placeholder)

Already implemented! ✅

**Test:**
```bash
1. Open chat with videos
2. Check Network tab
3. Verify: 0 bytes downloaded
4. Click video → Opens preview → Streams
```

---

### Step 2: Add Thumbnail (Optional)

**Time:** 2-4 hours

**Changes needed:**

1. **Update upload logic:**
```typescript
// File: lib/utils/file-upload.utils.ts

import { extractVideoThumbnail } from './video-thumbnail-generator'

export async function uploadVideo(file: File) {
  // Extract thumbnail
  const thumbnailBlob = await extractVideoThumbnail(file)

  // Upload both
  const [thumbnailUrl, videoUrl] = await Promise.all([
    uploadFileToChatkuAPI(thumbnailBlob),
    uploadFileToChatkuAPI(file)
  ])

  return { thumbnailUrl, videoUrl }
}
```

2. **Update message schema:**
```typescript
// Add thumbnailUrl field
interface VideoMessage {
  type: 'video'
  content: string        // videoUrl
  thumbnailUrl?: string  // NEW
  mimeType?: string
}
```

3. **Update UI:**
```tsx
// File: components/chat/chat-message.tsx

{data.type === 'video' && (
  <VideoWithThumbnail
    videoUrl={data.content}
    thumbnailUrl={data.thumbnailUrl}
    onClick={() => setShowVideoPreview(true)}
  />
)}
```

**Test:**
```bash
1. Upload new video
2. Verify thumbnail uploaded
3. Check message has thumbnailUrl
4. Verify thumbnail shows (not placeholder)
5. Click → Video plays
```

---

### Step 3: Fix Server (Future)

**Time:** 4-8 hours + deployment

**Backend changes:**

1. Add Range request support
2. Test with curl:
```bash
curl -H "Range: bytes=0-1023" \
  https://chatku-asset.treonstudio.com/video/abc123

Expected:
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/2865000
Content-Length: 1024
```

3. Update frontend:
```tsx
// Can now use preload="metadata"
<video preload="metadata" src={videoUrl} />
```

**Test:**
```bash
1. Load chat
2. Network tab: Status should be 206
3. Size should be ~50KB (not full video)
4. Video should show first frame
5. Click play → Smooth playback
```

---

## 🐛 Troubleshooting

### Video Downloads Full File

**Check:**
```bash
DevTools → Network → Filter: Media
Click on video request
Check:
- Status: Should be 206 (currently 200)
- Size: Should be ~50KB (currently 2.8MB)
```

**Solution:**
- Using placeholder approach (correct for now)
- Future: Fix server or add thumbnails

---

### Thumbnail Not Showing

**Check:**
```typescript
console.log('Message:', message)
// Should have: { thumbnailUrl: "https://..." }
```

**Common issues:**
- thumbnailUrl not saved to database
- Upload failed silently
- CORS issues

**Solution:**
```typescript
// Add error handling
try {
  const thumbnailUrl = await uploadThumbnail(blob)
  console.log('Thumbnail uploaded:', thumbnailUrl)
} catch (error) {
  console.error('Thumbnail upload failed:', error)
  // Continue with video only
}
```

---

## 📱 WhatsApp Comparison

### WhatsApp Approach:

```
1. Upload:
   - Generate thumbnail server-side
   - Store video + thumbnail

2. Display:
   - Show thumbnail (20KB)
   - Click → Stream video

3. Technology:
   - Server supports Range requests
   - Progressive streaming
   - Smart caching
```

### Chatku Current:

```
1. Upload:
   - Store video only

2. Display:
   - Show placeholder (0KB)
   - Click → Stream video

3. Technology:
   - Server no Range support
   - Placeholder approach
   - Browser caching
```

### Chatku Future (with thumbnails):

```
1. Upload:
   - Generate thumbnail client-side
   - Store video + thumbnail

2. Display:
   - Show thumbnail (20KB)
   - Click → Stream video

3. Technology:
   - Same as WhatsApp UX
   - No server changes
   - Client processing
```

---

## 💡 Best Practices

### Do:
- ✅ Use placeholder for now (0 bandwidth)
- ✅ Add thumbnails when ready (better UX)
- ✅ Monitor bandwidth in Network tab
- ✅ Test with large videos (20MB+)
- ✅ Handle upload errors gracefully

### Don't:
- ❌ Use `preload="auto"` in chat list
- ❌ Download videos on mount
- ❌ Ignore server capabilities
- ❌ Assume metadata works everywhere
- ❌ Skip error handling

---

## 📚 References

- [HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
- [Video Preload Attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#preload)
- [Canvas API (Thumbnail Extraction)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

---

**Last Updated:** 2025-01-28
**Status:** Placeholder approach implemented ✅
**Next:** Add thumbnail generation (optional)
