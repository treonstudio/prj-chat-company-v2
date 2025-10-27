/**
 * Video Thumbnail Generator
 * Extract first frame from video as thumbnail image
 *
 * This should ideally run on the SERVER during upload,
 * but can also run client-side if needed
 */

/**
 * Extract thumbnail from video file
 * Returns blob URL of the thumbnail image
 */
export async function extractVideoThumbnail(
  videoFile: File | Blob,
  options?: {
    timeOffset?: number  // Seconds into video to capture (default: 1s)
    width?: number       // Thumbnail width (default: 320px)
    quality?: number     // JPEG quality 0-1 (default: 0.7)
  }
): Promise<string> {
  const { timeOffset = 1, width = 320, quality = 0.7 } = options || {}

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    // Create blob URL for video
    const videoBlobUrl = URL.createObjectURL(videoFile)
    video.src = videoBlobUrl
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true

    // When video metadata loaded
    video.addEventListener('loadedmetadata', () => {
      // Set time to capture
      video.currentTime = Math.min(timeOffset, video.duration)
    })

    // When seeked to the time
    video.addEventListener('seeked', () => {
      try {
        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = video.videoHeight / video.videoWidth
        const height = Math.round(width * aspectRatio)

        canvas.width = width
        canvas.height = height

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, width, height)

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const thumbnailUrl = URL.createObjectURL(blob)

              // Cleanup
              URL.revokeObjectURL(videoBlobUrl)
              video.remove()
              canvas.remove()

              resolve(thumbnailUrl)
            } else {
              reject(new Error('Failed to create thumbnail blob'))
            }
          },
          'image/jpeg',
          quality
        )
      } catch (error) {
        URL.revokeObjectURL(videoBlobUrl)
        reject(error)
      }
    })

    video.addEventListener('error', (e) => {
      URL.revokeObjectURL(videoBlobUrl)
      reject(new Error(`Failed to load video: ${e}`))
    })

    // Start loading
    video.load()
  })
}

/**
 * Extract thumbnail and upload to server
 * Returns thumbnail URL from server
 */
export async function uploadVideoThumbnail(
  videoFile: File,
  uploadEndpoint: string = '/api/upload-thumbnail'
): Promise<string> {
  // Extract thumbnail
  const thumbnailBlobUrl = await extractVideoThumbnail(videoFile)

  // Convert blob URL to File
  const response = await fetch(thumbnailBlobUrl)
  const blob = await response.blob()
  const thumbnailFile = new File(
    [blob],
    `thumbnail-${Date.now()}.jpg`,
    { type: 'image/jpeg' }
  )

  // Upload thumbnail
  const formData = new FormData()
  formData.append('file', thumbnailFile)

  const uploadResponse = await fetch(uploadEndpoint, {
    method: 'POST',
    body: formData,
  })

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload thumbnail')
  }

  const result = await uploadResponse.json()

  // Cleanup
  URL.revokeObjectURL(thumbnailBlobUrl)

  return result.url
}

/**
 * Process video for upload: compress + generate thumbnail
 * Returns both video URL and thumbnail URL
 */
export async function processVideoForUpload(
  videoFile: File,
  options?: {
    compressVideo?: boolean
    generateThumbnail?: boolean
    uploadEndpoint?: string
  }
): Promise<{
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}> {
  const {
    compressVideo = true,
    generateThumbnail = true,
    uploadEndpoint = '/api/upload',
  } = options || {}

  try {
    const results: {
      videoUrl?: string
      thumbnailUrl?: string
    } = {}

    // Generate thumbnail if requested
    if (generateThumbnail) {
      try {
        results.thumbnailUrl = await uploadVideoThumbnail(videoFile, uploadEndpoint)
      } catch (error) {
        console.warn('Failed to generate thumbnail, continuing without it:', error)
      }
    }

    // Upload video (with or without compression)
    // This part integrates with existing file-upload.utils.ts
    // For now, just return the structure

    return results
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
