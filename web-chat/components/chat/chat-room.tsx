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
import { ChatType, User } from "@/types/models"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const userRepository = new UserRepository()
const chatRepository = new ChatRepository()

export function ChatRoom({
  chatId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isGroupChat,
}: {
  chatId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar?: string
  isGroupChat: boolean
}) {
  const {
    messages,
    loading,
    error,
    sending,
    uploading,
    uploadingMessage,
    sendTextMessage,
    sendImage,
    sendVideo,
    sendDocument,
    markAsRead,
  } = useMessages(chatId, isGroupChat)

  const [roomTitle, setRoomTitle] = useState<string>('Chat')
  const [groupMembers, setGroupMembers] = useState<User[]>([])
  const [showMembersDialog, setShowMembersDialog] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load room title and group members
  useEffect(() => {
    async function loadRoomInfo() {
      if (isGroupChat) {
        // For group chats, fetch group info
        const groupResult = await chatRepository.getGroupChat(chatId)
        if (groupResult.status === 'success') {
          setRoomTitle(groupResult.data.name)

          // Fetch all group members
          const memberPromises = groupResult.data.participants.map(userId =>
            userRepository.getUserById(userId)
          )
          const memberResults = await Promise.all(memberPromises)
          const members = memberResults
            .filter(r => r.status === 'success')
            .map(r => r.data)
          setGroupMembers(members)
        }
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

  // Format member names for display
  const getMemberNamesDisplay = () => {
    if (groupMembers.length === 0) return ''
    const names = groupMembers.map(m => m.displayName)
    if (names.length <= 3) {
      return names.join(', ')
    }
    return `${names.slice(0, 3).join(', ')}, +${names.length - 3}`
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-balance text-base font-semibold">{roomTitle}</h1>
          {isGroupChat && groupMembers.length > 0 ? (
            <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
              <DialogTrigger asChild>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left truncate block max-w-full">
                  {getMemberNamesDisplay()}
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Group Members ({groupMembers.length})</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[400px] pr-4">
                  <div className="space-y-3">
                    {groupMembers.map((member) => (
                      <div key={member.userId} className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.avatarUrl} alt="" />
                          <AvatarFallback>{member.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          ) : !isGroupChat ? (
            <p className="text-xs text-muted-foreground">Messages are end-to-end encrypted</p>
          ) : null}
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

                  // Map message type to ChatMessage type format
                  const messageType = m.type === 'DOCUMENT' ? 'doc' : m.type.toLowerCase()

                  return (
                    <div key={m.messageId}>
                      <ChatMessage
                        data={{
                          id: m.messageId,
                          type: messageType as any,
                          content: m.mediaUrl || m.text,
                          fileName: m.mediaMetadata?.fileName,
                          fileSize: m.mediaMetadata?.fileSize ? `${(m.mediaMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` : undefined,
                          mimeType: m.mediaMetadata?.mimeType,
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

                {/* Uploading message bubble */}
                {uploadingMessage && (
                  <div key="uploading-bubble" className="flex w-full justify-end">
                    <div className="inline-flex flex-col gap-2 rounded-xl px-3 py-2 text-sm ml-auto bg-primary text-primary-foreground rounded-br-none items-end max-w-[40%]">
                      {isGroupChat && (
                        <span className="text-xs font-bold">{uploadingMessage.senderName}</span>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                        <p className="text-sm opacity-80">Uploading...</p>
                      </div>
                      <span className="text-[11px] self-end text-right opacity-70">
                        {format(new Date(), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                )}

                <div ref={scrollRef} />
              </>
            )}
          </div>
        )}
      </ScrollArea>
      <Separator />
      <div className="relative">
        <MessageComposer
          onSendText={(text) => sendTextMessage(currentUserId, currentUserName, text)}
          onSendImage={(file, shouldCompress) => sendImage(currentUserId, currentUserName, file, shouldCompress, currentUserAvatar)}
          onSendVideo={(file) => sendVideo(currentUserId, currentUserName, file, currentUserAvatar)}
          onSendDocument={(file) => sendDocument(currentUserId, currentUserName, file, currentUserAvatar)}
          disabled={sending}
          uploading={uploading}
        />
      </div>
    </div>
  )
}
