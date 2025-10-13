"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download, X } from "lucide-react"
import download from "downloadjs"

type Base = {
  id: string
  senderId: string
  senderName: string
  timestamp: string
}

type TextMsg = Base & { type: "text"; content: string }
type ImageMsg = Base & { type: "image"; content: string }
type VideoMsg = Base & { type: "video"; content: string; mimeType?: string }
type DocMsg = Base & {
  type: "doc"
  content: string
  fileName?: string
  fileSize?: string
  mimeType?: string
}

export type ChatMessageUnion = TextMsg | ImageMsg | VideoMsg | DocMsg

export function ChatMessage({
  data,
  isMe,
  isGroupChat,
}: {
  data: ChatMessageUnion
  isMe: boolean
  isGroupChat: boolean
}) {
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [showVideoPreview, setShowVideoPreview] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async (url: string, filename?: string, mimeType?: string) => {
    setDownloading(true)
    try {
      // Fetch the file as blob
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()

      // Use downloadjs to trigger download
      download(blob, filename || `download-${Date.now()}`, mimeType || blob.type)

      // Small delay before resetting downloading state
      setTimeout(() => {
        setDownloading(false)
      }, 1000)
    } catch (error) {
      console.error('Download failed, trying alternative method:', error)

      // Try alternative download method using blob URL
      try {
        const response = await fetch(url)
        const blob = await response.blob()

        // Create object URL and download
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = filename || `download-${Date.now()}`
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Clean up blob URL
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl)
          setDownloading(false)
        }, 100)
      } catch (fallbackError) {
        console.error('All download methods failed:', fallbackError)
        setDownloading(false)
        alert('Download gagal. Silakan coba lagi atau hubungi administrator.')
      }
    }
  }

  const bubble = cn(
    "inline-flex flex-col gap-2 rounded-xl text-sm",
    // align and shape
    isMe
      ? "ml-auto bg-primary text-primary-foreground rounded-br-none items-end"
      : "mr-auto bg-gray-100 text-secondary-foreground rounded-bl-none items-start",
    // padding varies by type
    data.type === 'doc' ? 'px-3 py-3' : 'px-3 py-2',
    // width
    data.type == 'text' ? 'max-w-[80%]' : 'max-w-[40%]'
  )

  return (
    <>
      <div className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
        <div className={bubble}>
          {/* Sender name inside bubble only for group chat and other users */}
          {isGroupChat && !isMe ? (
            <span className="text-xs font-bold text-primary">{data.senderName}</span>
          ) : null}

          {data.type === "text" && <p className="text-pretty leading-relaxed">{data.content}</p>}

          {data.type === "image" && (
            <div className="relative min-h-[200px] group">
              {/* Skeleton loader */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted rounded-md animate-pulse flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-muted-foreground/30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
              <img
                src={data.content || "/placeholder.svg?height=320&width=480&query=pastel%20green%20chat%20image"}
                alt="Shared image"
                className={cn(
                  "h-auto w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity",
                  !imageLoaded && "opacity-0"
                )}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onClick={() => setShowImagePreview(true)}
              />
              {/* Download button - appears on hover */}
              {imageLoaded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(data.content, `image-${data.id}.jpg`, 'image/jpeg')
                  }}
                  disabled={downloading}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  aria-label="Download image"
                >
                  {downloading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Download className="h-4 w-4 text-white" />
                  )}
                </button>
              )}
            </div>
          )}

          {data.type === "video" && (
            <div
              className="relative cursor-pointer group"
              onClick={() => setShowVideoPreview(true)}
            >
              <video
                className="h-auto w-full rounded-md pointer-events-none"
                preload="metadata"
              >
                <source src={data.content} type={data.mimeType || 'video/mp4'} />
                Your browser does not support the video tag.
              </video>
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors rounded-md">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-primary ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {data.type === "doc" && (
            <div className="flex items-start gap-2.5 min-w-[240px] max-w-[120px]">
              {/* simple inline doc icon */}
              <svg
                aria-hidden
                className="mt-0.5 h-5 w-5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H8a2 2 0 0 0-2 2v16.5a1.5 1.5 0 0 0 1.5 1.5H16a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium leading-snug break-words">{data.fileName || "Document"}</p>
                  {data.fileSize ? <p className="text-xs opacity-70 mt-0.5">{data.fileSize}</p> : null}
                </div>
                <Button
                  size="sm"
                  variant={isMe ? "secondary" : "default"}
                  className="w-full"
                  onClick={() => handleDownload(data.content, data.fileName, data.mimeType)}
                  disabled={downloading}
                >
                  {downloading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Downloading...</span>
                    </div>
                  ) : (
                    "Download"
                  )}
                </Button>
              </div>
            </div>
          )}
          <span className={cn("text-[11px]", isMe ? "self-end text-right" : "self-start text-left text-muted-foreground")}>
            {data.timestamp}
          </span>
        </div>
      </div>

      {/* Image Preview Dialog */}
      {data.type === "image" && (
        <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <DialogHeader className="absolute top-0 right-0 z-10 p-4 bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(data.content, `image-${data.id}.jpg`, 'image/jpeg')
                  }}
                  disabled={downloading}
                  className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
                >
                  {downloading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Download className="h-5 w-5 text-white" />
                  )}
                </button>
                <button
                  onClick={() => setShowImagePreview(false)}
                  className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </DialogHeader>
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={data.content}
                alt="Preview"
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Video Preview Dialog */}
      {data.type === "video" && (
        <Dialog open={showVideoPreview} onOpenChange={setShowVideoPreview}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <DialogHeader className="absolute top-0 right-0 z-10 p-4 bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(data.content, `video-${data.id}.mp4`, data.mimeType || 'video/mp4')
                  }}
                  disabled={downloading}
                  className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
                >
                  {downloading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Download className="h-5 w-5 text-white" />
                  )}
                </button>
                <button
                  onClick={() => setShowVideoPreview(false)}
                  className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </DialogHeader>
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                controls
                autoPlay
                className="max-w-full max-h-[80vh] object-contain"
              >
                <source src={data.content} type={data.mimeType || 'video/mp4'} />
                Your browser does not support the video tag.
              </video>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
