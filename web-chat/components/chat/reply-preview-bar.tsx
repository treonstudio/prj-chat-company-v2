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
    <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-t">
      {/* Vertical indicator bar */}
      <div className="w-1 h-10 bg-primary rounded-full shrink-0" />

      {/* Reply info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-primary mb-0.5">
          Membalas {replyingTo.senderName}
        </div>
        <div className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
          <MediaIcon />
          <span className="truncate">{getPreviewText()}</span>
        </div>
      </div>

      {/* Thumbnail for media messages */}
      {replyingTo.mediaUrl && replyingTo.type !== MessageType.DOCUMENT && (
        <img
          src={replyingTo.mediaUrl}
          alt="Preview"
          className="w-10 h-10 rounded object-cover shrink-0"
        />
      )}

      {/* Cancel button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="shrink-0 h-8 w-8"
        aria-label="Cancel reply"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
