"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, Download, ZoomIn, ZoomOut } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface MediaPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  mediaUrl: string
  mediaType: "image" | "video"
  fileName?: string
  mimeType?: string
  onDownload?: () => void
  downloading?: boolean
  // For image galleries
  totalImages?: number
  currentImageIndex?: number
  onNavigate?: (direction: "prev" | "next") => void
}

export function MediaPreviewModal({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  fileName,
  mimeType,
  onDownload,
  downloading = false,
  totalImages,
  currentImageIndex,
  onNavigate,
}: MediaPreviewModalProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  // Ensure we're on the client side
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Reset zoom and position when modal opens or media changes
  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
      setImageLoading(true)
      setVideoLoading(true)
      setLoadProgress(0)
      setImageObjectUrl(null)
      setVideoObjectUrl(null)
    }
  }, [isOpen, mediaUrl])

  // Download image with real progress tracking
  useEffect(() => {
    if (!isOpen || mediaType !== 'image') return

    // Clean up previous download
    if (xhrRef.current) {
      xhrRef.current.abort()
    }
    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl)
    }

    setImageLoading(true)
    setLoadProgress(0)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    xhr.open('GET', mediaUrl, true)
    xhr.responseType = 'blob'

    // Track download progress
    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        setLoadProgress(percentComplete)
      }
    }

    // Handle successful download
    xhr.onload = () => {
      if (xhr.status === 200) {
        const blob = xhr.response
        const objectUrl = URL.createObjectURL(blob)
        setImageObjectUrl(objectUrl)
        setLoadProgress(100)
        setImageLoading(false)
      }
    }

    // Handle errors
    xhr.onerror = () => {
      setImageLoading(false)
      setLoadProgress(0)
    }

    xhr.send()

    // Cleanup on unmount or when mediaUrl changes
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort()
      }
      if (imageObjectUrl) {
        URL.revokeObjectURL(imageObjectUrl)
      }
    }
  }, [isOpen, mediaUrl, mediaType])

  // Download video with real progress tracking
  useEffect(() => {
    if (!isOpen || mediaType !== 'video') return

    // Clean up previous download
    if (xhrRef.current) {
      xhrRef.current.abort()
    }
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl)
    }

    setVideoLoading(true)
    setLoadProgress(0)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    xhr.open('GET', mediaUrl, true)
    xhr.responseType = 'blob'

    // Track download progress
    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        setLoadProgress(percentComplete)
      }
    }

    // Handle successful download
    xhr.onload = () => {
      if (xhr.status === 200) {
        const blob = xhr.response
        const objectUrl = URL.createObjectURL(blob)
        setVideoObjectUrl(objectUrl)
        setLoadProgress(100)
        setVideoLoading(false)
      }
    }

    // Handle errors
    xhr.onerror = () => {
      setVideoLoading(false)
      setLoadProgress(0)
    }

    xhr.send()

    // Cleanup on unmount or when mediaUrl changes
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort()
      }
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl)
      }
    }
  }, [isOpen, mediaUrl, mediaType])

  // Handle zoom in/out
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1))
    // Reset position when zooming out to 1
    if (scale <= 1.5) {
      setPosition({ x: 0, y: 0 })
    }
  }

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      handleZoomIn()
    } else {
      handleZoomOut()
    }
  }

  // Handle double click to zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (scale === 1) {
      setScale(2)
    } else {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    }
  }

  // Handle drag move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  // Handle drag end
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Handle touch events for mobile
  const touchStartRef = useRef<{ x: number; y: number; distance: number }>({ x: 0, y: 0, distance: 0 })

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      // Single touch - pan
      setIsDragging(true)
      touchStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
        distance: 0,
      }
    } else if (e.touches.length === 2) {
      // Two touches - pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      touchStartRef.current = { ...touchStartRef.current, distance }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      // Single touch - pan
      setPosition({
        x: e.touches[0].clientX - touchStartRef.current.x,
        y: e.touches[0].clientY - touchStartRef.current.y,
      })
    } else if (e.touches.length === 2) {
      // Two touches - pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const scaleDiff = distance / touchStartRef.current.distance
      setScale((prev) => Math.min(Math.max(prev * scaleDiff, 1), 5))
      touchStartRef.current.distance = distance
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Handle navigation with arrow keys
  const handleNavigate = (direction: "prev" | "next") => {
    if (onNavigate) {
      // Reset zoom and position when navigating
      setScale(1)
      setPosition({ x: 0, y: 0 })
      onNavigate(direction)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn()
      } else if (e.key === "-") {
        handleZoomOut()
      } else if (e.key === "ArrowLeft") {
        handleNavigate("prev")
      } else if (e.key === "ArrowRight") {
        handleNavigate("next")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, onNavigate])

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black">
      {/* Header with controls */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className={cn(
                "p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors",
                scale <= 1 && "opacity-50 cursor-not-allowed"
              )}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5 text-white" />
            </button>
            <span className="text-white text-sm font-medium min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 5}
              className={cn(
                "p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors",
                scale >= 5 && "opacity-50 cursor-not-allowed"
              )}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5 text-white" />
            </button>

            {/* Image counter for galleries */}
            {totalImages && currentImageIndex !== undefined && (
              <div className="ml-4 bg-white/10 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                {currentImageIndex + 1} / {totalImages}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Download button */}
            {onDownload && (
              <button
                onClick={onDownload}
                disabled={downloading}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                aria-label="Download"
              >
                {downloading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Download className="h-5 w-5 text-white" />
                )}
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation buttons for galleries */}
      {onNavigate && totalImages && currentImageIndex !== undefined && (
        <>
          {currentImageIndex > 0 && (
            <button
              onClick={() => handleNavigate("prev")}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Previous image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="white"
                className="w-6 h-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          {currentImageIndex < totalImages - 1 && (
            <button
              onClick={() => handleNavigate("next")}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Next image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="white"
                className="w-6 h-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </>
      )}

      {/* Media container */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
      >
        {mediaType === "image" ? (
          <>
            {/* Loading progress bar */}
            {imageLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
                <div className="w-64 space-y-3">
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300 ease-out"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                  <p className="text-white text-sm text-center">{loadProgress}%</p>
                </div>
              </div>
            )}

            {imageObjectUrl && (
              <div
                className="relative transition-transform duration-200 ease-out"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
              >
                <Image
                  src={imageObjectUrl}
                  alt="Preview"
                  width={1920}
                  height={1080}
                  className="object-contain max-w-[60vw] max-h-[60vh] select-none"
                  draggable={false}
                  unoptimized
                />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Loading progress bar for video */}
            {videoLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
                <div className="w-64 space-y-3">
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300 ease-out"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                  <p className="text-white text-sm text-center">{loadProgress}%</p>
                </div>
              </div>
            )}

            {videoObjectUrl && (
              <video
                src={videoObjectUrl}
                controls
                className="max-w-[60vw] max-h-[60vh]"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                }}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </>
        )}
      </div>

      {/* Instructions overlay (only shown at scale 1) */}
      {scale === 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full pointer-events-none">
          Double click or scroll to zoom
        </div>
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
