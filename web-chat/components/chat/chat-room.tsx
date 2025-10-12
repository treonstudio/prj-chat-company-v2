"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ChatMessage } from "./chat-message"
import { MessageComposer } from "./message-composer"
import { useMessages } from "@/lib/hooks/use-messages"
import { UserRepository } from "@/lib/repositories/user.repository"
import { ChatRepository } from "@/lib/repositories/chat.repository"
import { format } from "date-fns"
import { useState } from "react"
import { ChatType } from "@/types/models"

const userRepository = new UserRepository()
const chatRepository = new ChatRepository()

export function ChatRoom({
  chatId,
  currentUserId,
  currentUserName,
  isGroupChat,
}: {
  chatId: string
  currentUserId: string
  currentUserName: string
  isGroupChat: boolean
}) {
  const {
    messages,
    loading,
    error,
    sending,
    sendTextMessage,
    markAsRead,
  } = useMessages(chatId, isGroupChat)

  const [roomTitle, setRoomTitle] = useState<string>('Chat')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load room title
  useEffect(() => {
    async function loadRoomInfo() {
      if (isGroupChat) {
        // For group chats, we'd need to fetch group info
        // For now, just use chatId
        setRoomTitle('Group Chat')
      } else {
        // For direct chats, get the other user's name
        const parts = chatId.replace('direct_', '').split('_')
        const otherUserId = parts.find(id => id !== currentUserId)

        if (otherUserId) {
          const result = await userRepository.getUserById(otherUserId)
          if (result.status === 'success') {
            setRoomTitle(result.data.displayName)
          }
        }
      }
    }

    loadRoomInfo()
  }, [chatId, currentUserId, isGroupChat])

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      markAsRead(currentUserId)
    }
  }, [messages.length, loading, currentUserId, markAsRead])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-balance text-base font-semibold">{roomTitle}</h1>
          <p className="text-xs text-muted-foreground">Messages are end-to-end encrypted</p>
        </div>
      </header>
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <div className="mx-auto w-full space-y-3 p-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <>
                {[...messages].reverse().map((m) => {
                  const timestamp = m.timestamp?.toDate()
                  const timeStr = timestamp ? format(timestamp, 'HH:mm') : ''

                  return (
                    <div key={m.messageId}>
                      <ChatMessage
                        data={{
                          id: m.messageId,
                          type: m.type.toLowerCase() as any,
                          content: m.mediaUrl || m.text,
                          fileName: m.mediaMetadata?.fileName,
                          fileSize: m.mediaMetadata?.fileSize ? `${(m.mediaMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` : undefined,
                          senderId: m.senderId,
                          senderName: m.senderName,
                          timestamp: timeStr,
                        }}
                        isMe={m.senderId === currentUserId}
                        isGroupChat={isGroupChat}
                      />
                    </div>
                  )
                })}
                <div ref={scrollRef} />
              </>
            )}
          </div>
        )}
      </ScrollArea>
      <Separator />
      <MessageComposer
        onSendText={(text) => sendTextMessage(currentUserId, currentUserName, text)}
        disabled={sending}
      />
    </div>
  )
}
