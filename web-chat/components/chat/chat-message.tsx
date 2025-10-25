"use client"

import { cn } from "@/lib/utils"
import { sanitizeMessageText } from "@/lib/utils/text-sanitizer"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Download, X, Forward, ChevronDown, Reply, Copy, Trash2, Star, Pencil, Ban, Check, Image as ImageIcon, Video, FileText, Phone, PhoneCall, PhoneMissed, PhoneOff, PhoneIncoming, PhoneOutgoing } from "lucide-react"
import download from "downloadjs"
import { MessageStatusIcon } from "./message-status-icon"
import { MessageStatus } from "@/types/models"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { LinkPreviewCard } from "./link-preview-card"
import { linkifyText } from "@/lib/utils/linkify"

type Base = {
  id: string
  senderId: string
  senderName: string
  senderAvatar?: string
  timestamp: string
  editedAt?: string
  status?: MessageStatus
  error?: string
  isDeleted?: boolean
  isForwarded?: boolean
  replyTo?: {
    messageId: string
    senderId: string
    senderName: string
    text: string
    type: string
    mediaUrl?: string | null
  } | null
  linkPreview?: {
    url: string
    title?: string
    description?: string
    image?: string
    siteName?: string
    favicon?: string
  } | null
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
type CallMsg = Base & {
  type: "voice_call" | "video_call"
  callMetadata: {
    callId: string
    duration: number
    callType: "voice" | "video"
    status: "completed" | "missed" | "declined" | "cancelled"
  }
}

export type ChatMessageUnion = TextMsg | ImageMsg | VideoMsg | DocMsg | CallMsg

// Type guard to check if message is a call message
function isCallMessage(data: ChatMessageUnion): data is CallMsg {
  return data.type === "voice_call" || data.type === "video_call";
}

export function ChatMessage({
  data,
  isMe,
  isGroupChat,
  onRetry,
  onForward,
  onDelete,
  onEdit,
  onAvatarClick,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPress,
  onReply,
  onReplyClick,
  isDeletedUser = false,
  userCache,
}: {
  data: ChatMessageUnion
  userCache?: Map<string, string>
  isMe: boolean
  isGroupChat: boolean
  onRetry?: (messageId: string) => void
  onForward?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  onEdit?: (messageId: string, newText: string) => void
  onAvatarClick?: (userId: string) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (messageId: string) => void
  onLongPress?: (messageId: string) => void
  onReply?: (messageId: string) => void
  onReplyClick?: (messageId: string) => void
  isDeletedUser?: boolean
}) {
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [showVideoPreview, setShowVideoPreview] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editText, setEditText] = useState("")
  const previousImageUrl = useRef<string>('')

  // Character limit for "Read More" functionality
  const CHAR_LIMIT = 300

  // Reset imageLoaded only when image URL actually changes
  useEffect(() => {
    if (data.type === 'image' && 'content' in data) {
      const currentUrl = data.content || ''

      // Only reset if URL changed
      if (currentUrl !== previousImageUrl.current) {
        setImageLoaded(false)
        previousImageUrl.current = currentUrl
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const handleCopy = async () => {
    if (data.type === 'text') {
      try {
        await navigator.clipboard.writeText(data.content)
        toast.success('Teks berhasil disalin')
      } catch (err) {
        console.error('Failed to copy text:', err)
        toast.error('Gagal menyalin teks')
      }
    }
  }

  const handleEdit = () => {
    if (data.type === 'text') {
      setEditText(data.content)
      setShowEditDialog(true)
    }
  }

  const handleEditSubmit = () => {
    if (editText.trim() && onEdit) {
      onEdit(data.id, editText.trim())
      setShowEditDialog(false)
    }
  }

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
    "inline-flex flex-col gap-2 text-sm shadow-sm relative",
    // align and shape
    isMe
      ? "ml-auto bg-primary text-primary-foreground rounded-tl-lg rounded-tr-lg rounded-bl-lg items-end"
      : "mr-auto bg-gray-100 text-secondary-foreground rounded-tl-lg rounded-tr-lg rounded-br-lg items-start",
    // padding varies by type
    data.type === 'doc'
      ? 'px-3 py-3'
      : data.type === 'image' || data.type === 'video'
      ? 'p-1.5'  // 6px padding for media
      : 'px-3 py-2'
  )

  const maxWidthStyle = data.type === 'text'
    ? { maxWidth: '640px' }
    : data.type === 'image'
    ? { maxWidth: '640px' }
    : data.type === 'video'
    ? {} // Video has its own max-width constraints
    : { maxWidth: '640px' }

  return (
    <>
      <div className={cn("flex w-full gap-2 group/message", isMe ? "justify-end" : "justify-start")}>
        {/* Checkbox for selection mode */}
        {selectionMode && (
          <button
            onClick={() => onToggleSelect?.(data.id)}
            className="shrink-0 mt-0.5"
            aria-label="Select message"
          >
            <div className={cn(
              "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
              isSelected
                ? "bg-green-500 border-green-500"
                : "bg-white border-gray-300"
            )}>
              {isSelected && <Check className="h-3 w-3 text-white" />}
            </div>
          </button>
        )}

        {/* Avatar for group chat messages from others */}
        {isGroupChat && !isMe && !selectionMode ? (
          <button
            onClick={() => onAvatarClick?.(data.senderId)}
            className="shrink-0 mt-0.5 cursor-pointer"
            aria-label={`View ${data.senderName} profile`}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={data.senderAvatar || '/placeholder-user.jpg'} alt={data.senderName} />
              <AvatarFallback className="text-xs">
                {data.senderName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
        ) : null}

        <div className="relative">
          <div onClick={() => selectionMode && onToggleSelect?.(data.id)}>
          <div className={bubble} style={maxWidthStyle}>
          {/* Dropdown menu - appears on hover (hide for deleted messages, selection mode, and video) */}
          {!selectionMode && !data.isDeleted && data.type !== 'video' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "absolute top-1 p-1 opacity-0 group-hover/message:opacity-100 data-[state=open]:opacity-100 transition-opacity rounded-full backdrop-blur-sm",
                    isMe ? "left-1" : "right-1"
                  )}
                  style={{
                    backgroundColor: isMe ? '#5a8f5a' : '#f6f3f4'
                  }}
                  aria-label="Message options"
                >
                  <ChevronDown className={cn("h-4 w-4", isMe ? "text-white" : "text-gray-800")} />
                </button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align={isMe ? "start" : "end"}>
              {/* Balas */}
              {onReply && (
                <DropdownMenuItem className="flex items-center gap-2" onClick={() => onReply(data.id)}>
                  <Reply className="h-4 w-4" />
                  <span>Balas</span>
                </DropdownMenuItem>
              )}

              {/* Salin - hanya untuk text */}
              {data.type === 'text' && (
                <DropdownMenuItem className="flex items-center gap-2" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                  <span>Salin</span>
                </DropdownMenuItem>
              )}

              {/* Unduh - untuk media dan dokumen */}
              {(data.type === 'image' || data.type === 'doc') && (
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  onClick={() => {
                    const filename = data.type === 'doc' ? (data as DocMsg).fileName : `${data.type}-${data.id}`
                    const mimeType = data.type === 'doc'
                      ? (data as DocMsg).mimeType
                      : undefined
                    handleDownload(data.content, filename, mimeType)
                  }}
                >
                  <Download className="h-4 w-4" />
                  <span>Unduh</span>
                </DropdownMenuItem>
              )}

              {/* Edit - hanya untuk text dan pesan sendiri */}
              {isMe && data.type === 'text' && (
                <DropdownMenuItem className="flex items-center gap-2" onClick={handleEdit}>
                  <Pencil className="h-4 w-4" />
                  <span>Edit</span>
                </DropdownMenuItem>
              )}

              {/* Hapus - untuk semua user (akan trigger delete dialog) */}
              <DropdownMenuItem
                className="flex items-center gap-2 text-destructive"
                onClick={() => onLongPress?.(data.id)}
              >
                <Trash2 className="h-4 w-4" />
                <span>Hapus</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}

          {/* Sender name inside bubble only for group chat and other users */}
          {isGroupChat && !isMe ? (() => {
            // Try to get displayName from userCache first
            const cachedDisplayName = userCache?.get(data.senderId)

            // Determine if user is deleted
            // User is deleted if:
            // 1. Explicitly marked as deleted (isDeletedUser prop)
            // 2. OR senderName is "Deleted User" AND no cached name available
            const isDeleted = isDeletedUser || (data.senderName === "Deleted User" && !cachedDisplayName)

            let displayName = "Deleted User"

            if (isDeleted) {
              // If name exists and is not "Deleted User", show "Name (Deleted User)"
              if (data.senderName && data.senderName.trim() && data.senderName !== "Deleted User") {
                displayName = `${data.senderName} (Deleted User)`
              }
            } else {
              // Use cached name if available, otherwise use senderName
              displayName = cachedDisplayName || data.senderName || "Unknown User"
            }

            return (
              <span
                className={cn(
                  "text-xs font-bold",
                  isDeleted ? "text-red-500" : "text-primary" // Red 500 for deleted users
                )}
              >
                {sanitizeMessageText(displayName)}
              </span>
            )
          })() : null}

          {/* Forwarded indicator */}
          {data.isForwarded && (
            <div className="flex items-center gap-1.5 mb-1 opacity-80">
              <Forward className="h-3 w-3" />
              <span className="text-xs italic">Diteruskan</span>
            </div>
          )}

          {/* Quoted section - shows the message being replied to */}
          {data.replyTo && (
            <div
              onClick={() => onReplyClick?.(data.replyTo!.messageId)}
              className={cn(
                "flex items-start gap-2 p-2 rounded-lg mb-2 cursor-pointer",
                "transition-colors max-w-[620px] w-full",
                isMe
                  ? "bg-deeper-green border-white/60 border-l-[0px]"
                  : "bg-deeper-gray border-primary"
              )}
            >
              {/* Vertical indicator bar */}
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-xs font-semibold mb-0.5",
                  (() => {
                    // Check if user is actually deleted by checking both senderName and cache
                    const replyToName = data.replyTo!.senderName
                    const cachedName = userCache?.get(data.replyTo!.senderId)

                    // User is deleted only if senderName is "Deleted User" AND no cached name
                    const isReplyUserDeleted = replyToName === "Deleted User" && !cachedName

                    if (isReplyUserDeleted) {
                      return "text-red-500"
                    }
                    // Better contrast for isMe bubble (green background)
                    return isMe ? "text-white/90" : "text-primary"
                  })()
                )}>
                  {(() => {
                    const replyToName = data.replyTo!.senderName
                    // Try to get name from cache if senderName is empty or "Deleted User"
                    if (!replyToName || replyToName.trim() === '' || replyToName === "Deleted User") {
                      const cachedName = userCache?.get(data.replyTo!.senderId)
                      if (cachedName) {
                        return cachedName
                      }
                      return "Deleted User"
                    }
                    return replyToName
                  })()}
                </div>
                <div className={cn(
                  "text-xs italic truncate flex items-center gap-1",
                  isMe ? "opacity-80 text-white/80" : "opacity-70"
                )}>
                  {data.replyTo.type === 'IMAGE' && <ImageIcon className="h-3 w-3" />}
                  {data.replyTo.type === 'VIDEO' && <Video className="h-3 w-3" />}
                  {data.replyTo.type === 'DOCUMENT' && <FileText className="h-3 w-3" />}
                  <span className="truncate line-clamp-2">{data.replyTo.text}</span>
                </div>
              </div>
              {/* Media thumbnail */}
              {data.replyTo.mediaUrl && data.replyTo.type !== 'DOCUMENT' && (
                <>
                  {data.replyTo.type === 'VIDEO' ? (
                    // For video, show thumbnail or first frame
                    <video
                      src={data.replyTo.mediaUrl}
                      className="w-12 h-12 rounded object-cover shrink-0"
                      preload="metadata"
                      muted
                    />
                  ) : (
                    // For images
                    <Image
                      src={data.replyTo.mediaUrl}
                      alt="Reply preview"
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                  )}
                </>
              )}
            </div>
          )}

          {data.type === "text" && (
            <>
              {data.isDeleted ? (
                <div className="flex items-center gap-2 opacity-70">
                  <div className="relative h-5 w-5 shrink-0">
                    <div className="absolute inset-0 rounded-full border border-current opacity-40" />
                    <Ban className="h-5 w-5 fill-current" />
                  </div>
                  <span className="italic text-sm">
                    {isMe ? "Anda menghapus pesan ini" : "Pesan ini dihapus"}
                  </span>
                </div>
              ) : (
                <div className="text-pretty leading-relaxed break-words max-w-[610px] overflow-hidden chat-text-safe">
                  {data.content.length > CHAR_LIMIT && !isExpanded ? (
                    <>
                      <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere chat-text-safe">
                        {linkifyText(sanitizeMessageText(data.content.slice(0, CHAR_LIMIT)), isMe)}...
                      </p>
                      <button
                        onClick={() => setIsExpanded(true)}
                        className={cn(
                          "text-xs mt-1 font-medium underline",
                          isMe ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-primary hover:text-primary/80"
                        )}
                      >
                        Read more
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere chat-text-safe">
                        {linkifyText(sanitizeMessageText(data.content), isMe)}
                      </p>
                      {data.content.length > CHAR_LIMIT && (
                        <button
                          onClick={() => setIsExpanded(false)}
                          className={cn(
                            "text-xs mt-1 font-medium underline",
                            isMe ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-primary hover:text-primary/80"
                          )}
                        >
                          Read less
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Link Preview Card */}
              {!data.isDeleted && data.linkPreview && (
                <LinkPreviewCard preview={data.linkPreview} isMe={isMe} />
              )}
            </>
          )}

          {(data.type === "voice_call" || data.type === "video_call") && (data as CallMsg).callMetadata && (
            <div className="flex items-center gap-3 py-1">
              {/* Call Icon */}
              <div className="shrink-0">
                {(() => {
                  const callData = (data as CallMsg).callMetadata
                  if (!callData) return <Phone className="h-5 w-5" />

                  const status = callData.status
                  const callType = callData.callType
                  const iconSize = "h-5 w-5"

                  if (status === "missed") {
                    return <PhoneMissed className={`${iconSize} ${isMe ? 'text-white' : 'text-red-500'}`} />
                  } else if (status === "declined") {
                    return <PhoneOff className={`${iconSize} ${isMe ? 'text-white' : 'text-red-500'}`} />
                  } else if (status === "cancelled") {
                    return <PhoneOff className={`${iconSize} text-muted-foreground`} />
                  } else if (status === "completed") {
                    if (callType === "video") {
                      return <Video className={`${iconSize} text-primary`} />
                    } else if (isMe) {
                      return <PhoneOutgoing className={`${iconSize} text-primary`} />
                    } else {
                      return <PhoneIncoming className={`${iconSize} text-primary`} />
                    }
                  }
                  return <Phone className={`${iconSize}`} />
                })()}
              </div>

              {/* Call Status Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm",
                    (data as CallMsg).callMetadata?.status === "missed" || (data as CallMsg).callMetadata?.status === "declined"
                      ? isMe ? "text-white" : "text-red-500"
                      : (data as CallMsg).callMetadata?.status === "cancelled"
                      ? "text-muted-foreground"
                      : ""
                  )}>
                    {(() => {
                      const callData = (data as CallMsg).callMetadata
                      if (!callData) return "Panggilan"

                      const status = callData.status

                      if (status === "missed") return "Panggilan tidak terjawab"
                      if (status === "declined") return "Panggilan ditolak"
                      if (status === "cancelled") return "Panggilan dibatalkan"
                      if (status === "completed") {
                        return isMe ? "Panggilan keluar" : "Panggilan masuk"
                      }
                      return "Panggilan"
                    })()}
                  </span>

                  {/* Duration for completed calls */}
                  {(data as CallMsg).callMetadata?.status === "completed" && (
                    <span className="text-sm text-muted-foreground">
                      {(() => {
                        const callData = (data as CallMsg).callMetadata
                        if (!callData) return ""

                        const duration = callData.duration
                        const minutes = Math.floor(duration / 60)
                        const seconds = duration % 60
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`
                      })()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {data.type === "image" && (
            <div className="relative group">
              <div
                className="cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  maxWidth: '330px',
                  maxHeight: '330px',
                  minWidth: '200px',
                  minHeight: '200px',
                  position: 'relative',
                }}
                onClick={() => setShowImagePreview(true)}
              >
                {data.content && (data.content.startsWith('http://') || data.content.startsWith('https://')) ? (
                  <>
                    {/* Skeleton loader - only show when valid URL but not loaded yet */}
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
                    <Image
                      src={data.content}
                      alt="Shared image"
                      fill
                      sizes="(max-width: 330px) 100vw, 330px"
                      className="object-contain rounded-md transition-opacity duration-200"
                      style={{ opacity: imageLoaded ? 1 : 0 }}
                      loading="lazy"
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                      priority={false}
                      unoptimized={false}
                    />
                  </>
                ) : (
                  <div className="relative flex flex-col items-center justify-center h-full text-muted-foreground bg-muted rounded-md">
                    {data.status === 'SENDING' ? (
                      <>
                        {/* Upload/Compress indicator */}
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative">
                            {/* Spinner */}
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-primary" />
                            {/* Upload icon in center */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg
                                className="h-6 w-6 text-primary"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                              </svg>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">
                            Uploading image...
                          </div>
                        </div>
                      </>
                    ) : (
                      <ImageIcon className="h-12 w-12" />
                    )}
                  </div>
                )}
              </div>
              {/* Download button - appears on hover */}
              {imageLoaded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(data.content, `image-${data.id}.jpg`, 'image/jpeg')
                  }}
                  disabled={downloading}
                  className={cn(
                    "absolute top-2 right-2 p-2 rounded-full backdrop-blur-sm transition-opacity opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  )}
                  style={{
                    backgroundColor: isMe ? '#5a8f5a' : '#f6f3f4'
                  }}
                  aria-label="Download image"
                >
                  {downloading ? (
                    <div className={cn(
                      "h-4 w-4 animate-spin rounded-full border-2 border-t-transparent",
                      isMe ? "border-white" : "border-gray-800"
                    )} />
                  ) : (
                    <Download className={cn("h-4 w-4", isMe ? "text-white" : "text-gray-800")} />
                  )}
                </button>
              )}
            </div>
          )}

          {data.type === "video" && (
            <div
              className="relative cursor-pointer group max-w-[320px] sm:max-w-[450px]"
              onClick={() => setShowVideoPreview(true)}
              style={{
                minWidth: '200px',
              }}
            >
              {data.content && (data.content.startsWith('http://') || data.content.startsWith('https://')) ? (
                <>
                  <video
                    className="h-auto w-full rounded-md pointer-events-none"
                    style={{
                      maxHeight: '500px',
                      objectFit: 'contain',
                    }}
                    preload="metadata"
                  >
                    <source src={data.content} type={data.mimeType || 'video/mp4'} />
                    Your browser does not support the video tag.
                  </video>

                  {/* Play button overlay - only show when NOT uploading */}
                  {data.status !== 'SENDING' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <svg
                          className="w-8 h-8 text-green-600 ml-1"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="relative flex flex-col items-center justify-center h-[200px] w-full rounded-md bg-muted">
                  {data.status === 'SENDING' ? (
                    <>
                      {/* Upload/Compress indicator */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          {/* Spinner */}
                          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-primary" />
                          {/* Icon in center - different for compress vs upload */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            {'content' in data && data.content.includes('Compressing') ? (
                              // Compress icon (gear/settings)
                              <svg
                                className="h-6 w-6 text-primary"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            ) : (
                              // Upload icon
                              <svg
                                className="h-6 w-6 text-primary"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                              </svg>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">
                          {'content' in data ? data.content.replace('🎥 ', '') : 'Uploading video...'}
                        </div>
                      </div>
                    </>
                  ) : (
                    <Video className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
              )}

              {/* Options menu button - top right */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    className={cn(
                      "absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-opacity opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    )}
                    style={{
                      backgroundColor: isMe ? '#5a8f5a' : '#f6f3f4'
                    }}
                    aria-label="Message options"
                  >
                    <ChevronDown className={cn("h-4 w-4", isMe ? "text-white" : "text-gray-800")} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {/* Forward - hide for call messages */}
                  {!isCallMessage(data) && (
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        onForward?.(data.id)
                      }}
                    >
                      <Forward className="h-4 w-4" />
                      <span>Teruskan</span>
                    </DropdownMenuItem>
                  )}

                  {/* Reply */}
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReply?.(data.id)
                    }}
                  >
                    <Reply className="h-4 w-4" />
                    <span>Balas</span>
                  </DropdownMenuItem>

                  {/* Download */}
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      const filename = `video-${data.id}.mp4`
                      handleDownload(data.content, filename, (data as VideoMsg).mimeType)
                    }}
                  >
                    <Download className="h-4 w-4" />
                    <span>Unduh</span>
                  </DropdownMenuItem>

                  {/* Delete */}
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onLongPress?.(data.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Hapus</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Play overlay - only show when NOT uploading */}
              {data.status !== 'SENDING' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors rounded-md pointer-events-none">
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
              )}
            </div>
          )}

          {data.type === "doc" && (
            <div className="flex items-start gap-3 min-w-[200px] max-w-[280px]">
              {/* Document icon or upload indicator */}
              {data.status === 'SENDING' ? (
                <div className="mt-1 h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                </div>
              ) : (
                <svg
                  aria-hidden
                  className="mt-1 h-10 w-10 flex-shrink-0 p-2 rounded-lg bg-white/10"
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
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div>
                  <p className="text-sm font-medium leading-tight break-words line-clamp-2">{sanitizeMessageText(data.fileName || "Document")}</p>
                  {data.fileSize && <p className="text-xs opacity-70 mt-1">{data.fileSize}</p>}
                </div>
                {data.status === 'SENDING' ? (
                  <div className="text-xs opacity-70 mt-2">Uploading...</div>
                ) : (
                  <Button
                    size="sm"
                    variant={isMe ? "secondary" : "default"}
                    className="w-full mt-2 rounded-md"
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
                )}
              </div>
            </div>
          )}
          <div className={cn("flex items-center gap-1", isMe ? "self-end flex-row-reverse" : "self-start")}>
            <span className={cn("text-[11px]", isMe ? "text-right" : "text-left text-muted-foreground")}>
              {data.editedAt && "Diedit "}{data.timestamp}
            </span>
            {isMe && data.status && (
              <MessageStatusIcon status={data.status} className={isMe ? "text-primary-foreground/70" : ""} />
            )}
            {isMe && data.status === MessageStatus.FAILED && onRetry && (
              <button
                onClick={() => onRetry(data.id)}
                className="text-[10px] text-red-400 hover:text-red-300 underline ml-1"
              >
                Retry
              </button>
            )}
          </div>
          </div>

          </div>

          {/* Forward button - appears on hover (hide for deleted messages, call messages, and selection mode) */}
          {onForward && !selectionMode && !data.isDeleted && !isCallMessage(data) && (
            <button
              onClick={() => onForward(data.id)}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                [isMe ? 'right' : 'left']: '100%',
                [isMe ? 'marginRight' : 'marginLeft']: '4px'
              }}
              className={cn(
                "p-1.5 rounded-full bg-background/90 shadow-md hover:bg-background transition-all opacity-0 group-hover/message:opacity-100 z-10"
              )}
              aria-label="Forward message"
            >
              <Forward className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Image Preview Dialog */}
      {data.type === "image" && (
        <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <DialogTitle asChild>
              <VisuallyHidden>Image Preview</VisuallyHidden>
            </DialogTitle>
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
            <div className="relative w-full h-[80vh] flex items-center justify-center bg-black">
              <Image
                src={data.content}
                alt="Preview"
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Video Preview Dialog */}
      {data.type === "video" && (
        <Dialog open={showVideoPreview} onOpenChange={setShowVideoPreview}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <DialogTitle asChild>
              <VisuallyHidden>Video Preview</VisuallyHidden>
            </DialogTitle>
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

      {/* Edit Message Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pesan</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Ketik pesan..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              Batal
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!editText.trim()}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
