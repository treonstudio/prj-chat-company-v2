'use client'

import { X, Image as ImageIcon, Video, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Message, MessageType } from '@/types/models'
import { cn } from '@/lib/utils'

interface ReplyPreviewBarProps {
  replyingTo: Message
  onCancel: () => void
}

export function ReplyPreviewBar({ replyingTo, onCancel }: ReplyPreviewBarProps) {
  // Determine preview text based on message type
  const getPreviewText = () => {
    switch (replyingTo.type) {
      case MessageType.IMAGE:
        return '🖼️ Photo'
      case MessageType.VIDEO:
        return '🎥 Video'
      case MessageType.DOCUMENT:
        return `📄 ${replyingTo.mediaMetadata?.fileName || 'Document'}`
      default:
        return replyingTo.text || 'Message'
    }
  }

  // Get icon for media type
  const MediaIcon = () => {
    switch (replyingTo.type) {
      case MessageType.IMAGE:
        return <ImageIcon className="h-4 w-4" />
      case MessageType.VIDEO:
        return <Video className="h-4 w-4" />
      case MessageType.DOCUMENT:
        return <FileText className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <div className="bg-white p-4 rounded-t-[1.6rem]">
    <div className="flex items-start gap-2 px-4 py-3 bg-deeper-gray border-l-4 border-l-primary">
      {/* Reply info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-primary mb-1">
          {replyingTo.senderName}
        </div>
        <div className="text-sm text-foreground/70 line-clamp-2 flex items-start gap-1.5">
          <span className="line-clamp-2">{getPreviewText()}</span>
        </div>
      </div>

      {/* Thumbnail for media messages */}
      {replyingTo.mediaUrl && replyingTo.type !== MessageType.DOCUMENT && (
        <>
          {replyingTo.type === MessageType.VIDEO ? (
            // For video, show thumbnail or first frame
            replyingTo.mediaMetadata?.thumbnailUrl ? (
              <img
                src={replyingTo.mediaMetadata.thumbnailUrl}
                alt="Video preview"
                className="w-12 h-12 rounded object-cover shrink-0"
              />
            ) : (
              <video
                src={replyingTo.mediaUrl}
                className="w-12 h-12 rounded object-cover shrink-0"
                preload="metadata"
                muted
              />
            )
          ) : (
            // For images
            <img
              src={replyingTo.mediaUrl}
              alt="Preview"
              className="w-12 h-12 rounded object-cover shrink-0"
            />
          )}
        </>
      )}

      {/* Cancel button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="shrink-0 h-8 w-8 -mt-1"
        aria-label="Cancel reply"
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
    </div>
  )
}
