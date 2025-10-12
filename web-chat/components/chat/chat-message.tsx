"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Base = {
  id: string
  senderId: string
  senderName: string
  timestamp: string
}

type TextMsg = Base & { type: "text"; content: string }
type ImageMsg = Base & { type: "image"; content: string }
type VideoMsg = Base & { type: "video"; content: string }
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
  const bubble = cn(
    "inline-flex flex-col gap-2 rounded-xl px-3 py-2 text-sm",
    // align and shape
    isMe
      ? "ml-auto bg-primary text-primary-foreground rounded-br-none items-end"
      : "mr-auto bg-gray-100 text-secondary-foreground rounded-bl-none items-start",
    data.type == 'text' ? 'max-w-[80%]' : 'max-w-[40%]'
  )

  return (
    <div className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
      <div className={bubble}>
        {/* Sender name inside bubble only for group chat and other users */}
        {isGroupChat && !isMe ? (
          <span className="text-xs font-bold text-primary">{data.senderName}</span>
        ) : null}

        {data.type === "text" && <p className="text-pretty leading-relaxed">{data.content}</p>}

        {data.type === "image" && (
          <img
            src={data.content || "/placeholder.svg?height=320&width=480&query=pastel%20green%20chat%20image"} // safe placeholder
            alt="Shared image"
            className="h-auto w-full rounded-md"
            loading="lazy"
          />
        )}

        {data.type === "video" && (
          <video controls className="h-auto w-full rounded-md" preload="metadata" crossOrigin="anonymous">
            <source src={data.content} />
            Your browser does not support the video tag.
          </video>
        )}

        {data.type === "doc" && (
          <div className="flex items-start gap-3">
            {/* simple inline doc icon */}
            <svg
              aria-hidden
              className="mt-1 h-5 w-5 text-foreground/80"
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
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{data.fileName || "Document"}</p>
              {data.fileSize ? <p className="text-xs text-muted-foreground">{data.fileSize}</p> : null}
              <div className="mt-2">
                <a href={data.content} target="_blank" rel="noreferrer">
                  <Button size="sm" variant={isMe ? "secondary" : "default"}>
                    View document
                  </Button>
                </a>
              </div>
            </div>
          </div>
        )}
        <span className={cn("text-[11px]", isMe ? "self-end text-right" : "self-start text-left text-muted-foreground")}>
          {data.timestamp}
        </span>
      </div>

    </div>
  )
}
