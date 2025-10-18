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
import { ChatType, User, UserStatus } from "@/types/models"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut, Loader2, Users } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GroupInfoDialog } from "./group-info-dialog"
import { ForwardMessageDialog } from "./forward-message-dialog"
import { MessageRepository } from "@/lib/repositories/message.repository"
import { toast } from "sonner"

const userRepository = new UserRepository()
const chatRepository = new ChatRepository()
const messageRepository = new MessageRepository()

export function ChatRoom({
  chatId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isGroupChat,
  onLeaveGroup,
  onChatSelect,
}: {
  chatId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar?: string
  isGroupChat: boolean
  onLeaveGroup?: () => void
  onChatSelect?: (chatId: string, isGroup: boolean) => void
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
    retryMessage,
    deleteMessage,
    editMessage,
  } = useMessages(chatId, isGroupChat, currentUserId)

  const [roomTitle, setRoomTitle] = useState<string>('Chat')
  const [roomAvatar, setRoomAvatar] = useState<string>('')
  const [groupMembers, setGroupMembers] = useState<User[]>([])
  const [groupAdmins, setGroupAdmins] = useState<string[]>([])
  const [showGroupInfoDialog, setShowGroupInfoDialog] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [isDeletedUser, setIsDeletedUser] = useState(false)
  const [showForwardDialog, setShowForwardDialog] = useState(false)
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load room title and group members
  useEffect(() => {
    async function loadRoomInfo() {
      if (isGroupChat) {
        // For group chats, fetch group info
        const groupResult = await chatRepository.getGroupChat(chatId)
        if (groupResult.status === 'success') {
          setRoomTitle(groupResult.data.name)
          setRoomAvatar(groupResult.data.avatar || groupResult.data.avatarUrl || '')
          setGroupAdmins(groupResult.data.admins || [])

          // Fetch all group members
          const memberPromises = groupResult.data.participants.map(userId =>
            userRepository.getUserById(userId)
          )
          const memberResults = await Promise.all(memberPromises)
          const members = memberResults.map((r, index) => {
            if (r.status === 'success') {
              // If displayName is missing, set to "Deleted User"
              if (!r.data.displayName || r.data.displayName.trim() === '') {
                return {
                  ...r.data,
                  displayName: 'Deleted User',
                  email: r.data.email || 'deleted@user.com'
                }
              }
              return r.data
            } else {
              // If user not found, create placeholder
              return {
                userId: groupResult.data.participants[index],
                displayName: 'Deleted User',
                email: 'deleted@user.com',
                status: UserStatus.OFFLINE,
                isActive: false
              } as User
            }
          })
          setGroupMembers(members)
        }
        // Reset for group chats
        setIsDeletedUser(false)
      } else {
        // For direct chats, get the other user's name
        const parts = chatId.replace('direct_', '').split('_')
        const otherUserId = parts.find(id => id !== currentUserId)

        if (otherUserId) {
          const result = await userRepository.getUserById(otherUserId)
          if (result.status === 'success') {
            // Handle deleted user or missing displayName
            const displayName = result.data.displayName && result.data.displayName.trim() !== ''
              ? result.data.displayName
              : 'Deleted User'
            setRoomTitle(displayName)
            setRoomAvatar(result.data.imageURL || result.data.imageUrl || '')
            setIsDeletedUser(displayName === 'Deleted User')
          } else {
            // User not found
            setRoomTitle('Deleted User')
            setRoomAvatar('')
            setIsDeletedUser(true)
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

  // Handle leave group
  const handleLeaveGroup = async () => {
    setLeaving(true)
    const result = await chatRepository.leaveGroupChat(currentUserId, chatId)
    setLeaving(false)

    if (result.status === 'success') {
      setShowLeaveDialog(false)
      onLeaveGroup?.()
    } else if (result.status === 'error') {
      alert(`Failed to leave group: ${result.message}`)
    }
  }

  // Handle members update
  const handleMembersUpdate = (members: User[]) => {
    setGroupMembers(members)
  }

  // Handle avatar update
  const handleAvatarUpdate = (avatarUrl: string) => {
    setRoomAvatar(avatarUrl)
  }

  // Handle forward message
  const handleForwardClick = (messageId: string) => {
    setForwardMessageId(messageId)
    setShowForwardDialog(true)
  }

  const handleForwardMessage = async (targetChatId: string, isGroup: boolean) => {
    if (!forwardMessageId) return

    const message = messages.find(m => m.messageId === forwardMessageId)
    if (!message) {
      toast.error('Message not found')
      return
    }

    // Immediately switch to target chat
    if (onChatSelect) {
      onChatSelect(targetChatId, isGroup)
    }

    // Forward message in background
    try {
      const result = await messageRepository.forwardMessage(
        forwardMessageId,
        chatId,
        targetChatId,
        currentUserId
      )

      if (result.status === 'error') {
        toast.error(result.message || 'Failed to forward message')
      }
      // Don't show success toast - user will see the message appear in the chat
    } catch (error) {
      console.error('Forward error:', error)
      toast.error('Failed to forward message')
    }
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 shadow-sm z-10" style={{ backgroundColor: '#fafafa' }}>
        <button
          onClick={() => {
            if (isGroupChat) {
              setShowGroupInfoDialog(true)
            }
          }}
          className="flex items-center gap-3 flex-1 min-w-0 hover:bg-muted/50 transition-colors rounded-lg px-2 py-1 -ml-2 disabled:hover:bg-transparent"
          disabled={!isGroupChat}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={roomAvatar || "/placeholder-user.jpg"} alt="" />
            <AvatarFallback className={isGroupChat ? "bg-muted border border-border" : ""}>
              {isGroupChat ? (
                <Users className="h-5 w-5 text-muted-foreground fill-muted-foreground" />
              ) : (
                roomTitle.slice(0, 2).toUpperCase()
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <h1 className="text-balance text-base font-semibold truncate">{roomTitle}</h1>
            {isGroupChat && groupMembers.length > 0 ? (
              <p className="text-xs text-muted-foreground truncate">
                {getMemberNamesDisplay()}
              </p>
            ) : !isGroupChat ? (
              <p className="text-xs text-muted-foreground">Messages are end-to-end encrypted</p>
            ) : null}
          </div>
        </button>
        {isGroupChat && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLeaveDialog(true)}
            className="ml-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </header>
      <ScrollArea className="flex-1 min-h-0" style={{ backgroundImage: 'url(/tile-pattern.png)', backgroundRepeat: 'repeat' }}>
        {loading ? (
          <div className="mx-auto w-full space-y-3 p-4">
            {/* Message skeleton loader */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex w-full ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col gap-2 rounded-xl px-3 py-2 ${i % 2 === 0 ? 'max-w-[80%] ml-auto items-end' : 'max-w-[80%] mr-auto items-start'}`}>
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
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

                  // Handle deleted user - fallback senderName
                  const senderName = m.senderName && m.senderName.trim() !== ''
                    ? m.senderName
                    : 'Deleted User'

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
                          senderName: senderName,
                          senderAvatar: m.senderAvatar,
                          timestamp: timeStr,
                          status: m.status,
                          error: m.error,
                        }}
                        isMe={m.senderId === currentUserId}
                        isGroupChat={isGroupChat}
                        onRetry={retryMessage}
                        onForward={handleForwardClick}
                        onDelete={deleteMessage}
                        onEdit={editMessage}
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
      <div className="relative">
        {isDeletedUser ? (
          <div className="flex items-center justify-center px-4 py-3 bg-muted">
            <p className="text-sm text-muted-foreground">
              You can't send messages to this user
            </p>
          </div>
        ) : (
          <MessageComposer
            onSendText={(text) => sendTextMessage(currentUserId, currentUserName, text, currentUserAvatar)}
            onSendImage={(file, shouldCompress) => sendImage(currentUserId, currentUserName, file, shouldCompress, currentUserAvatar)}
            onSendVideo={(file) => sendVideo(currentUserId, currentUserName, file, currentUserAvatar)}
            onSendDocument={(file) => sendDocument(currentUserId, currentUserName, file, currentUserAvatar)}
            disabled={sending}
            uploading={uploading}
          />
        )}
      </div>

      {/* Group Info Dialog */}
      {isGroupChat && (
        <GroupInfoDialog
          open={showGroupInfoDialog}
          onOpenChange={setShowGroupInfoDialog}
          chatId={chatId}
          groupName={roomTitle}
          groupAvatar={roomAvatar}
          groupMembers={groupMembers}
          groupAdmins={groupAdmins}
          currentUserId={currentUserId}
          onMembersUpdate={handleMembersUpdate}
          onAvatarUpdate={handleAvatarUpdate}
        />
      )}

      {/* Leave Group Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {roomTitle}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this group? You will no longer receive messages from this group and will need to be re-added by a member to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleLeaveGroup()
              }}
              disabled={leaving}
              className="bg-red-400 text-white hover:bg-red-500 disabled:bg-red-400/50"
            >
              {leaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Leaving...
                </>
              ) : (
                "Leave Group"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        open={showForwardDialog}
        onOpenChange={setShowForwardDialog}
        onForward={handleForwardMessage}
        currentUserId={currentUserId}
      />
    </div>
  )
}
