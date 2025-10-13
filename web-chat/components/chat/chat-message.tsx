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
          <>
            <img
              src={data.content || "/placeholder.svg?height=320&width=480&query=pastel%20green%20chat%20image"}
              alt="Shared image"
              className="h-auto w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
              onClick={() => setShowImagePreview(true)}
            />
          </>
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
              <a href={data.content} download={data.fileName}>
                <Button size="sm" variant={isMe ? "secondary" : "default"} className="w-full">
                  Download
                </Button>
              </a>
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
              <a
                href={data.content}
                download
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              >
                <Download className="h-5 w-5 text-white" />
              </a>
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
              <a
                href={data.content}
                download
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              >
                <Download className="h-5 w-5 text-white" />
              </a>
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
