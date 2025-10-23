"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ChatMessage } from "./chat-message"
import { MessageComposer } from "./message-composer"
import { useMessages } from "@/lib/hooks/use-messages"
import { useUserStatus } from "@/lib/hooks/use-user-status"
import { UserRepository } from "@/lib/repositories/user.repository"
import { ChatRepository } from "@/lib/repositories/chat.repository"
import { format } from "date-fns"
import { useState } from "react"
import { ChatType, User, UserStatus, Message } from "@/types/models"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut, Loader2, Users, Trash2, X, MoreVertical, Info, Eraser } from "lucide-react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
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
import { UserProfileDialog } from "./user-profile-dialog"
import { DeleteMessageDialog } from "./delete-message-dialog"
import { ReplyPreviewBar } from "./reply-preview-bar"
import { MessageRepository } from "@/lib/repositories/message.repository"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  onCloseChat,
}: {
  chatId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar?: string
  isGroupChat: boolean
  onLeaveGroup?: () => void
  onChatSelect?: (chatId: string, isGroup: boolean) => void
  onCloseChat?: () => void
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
  const [otherUserId, setOtherUserId] = useState<string | null>(null)
  const [groupMembers, setGroupMembers] = useState<User[]>([])
  const [groupAdmins, setGroupAdmins] = useState<string[]>([])
  const [showGroupInfoDialog, setShowGroupInfoDialog] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showDeleteChatDialog, setShowDeleteChatDialog] = useState(false)
  const [deletingChat, setDeletingChat] = useState(false)
  const [showDeleteHistoryDialog, setShowDeleteHistoryDialog] = useState(false)
  const [deletingHistory, setDeletingHistory] = useState(false)
  const [isDeletedUser, setIsDeletedUser] = useState(false)
  const [showForwardDialog, setShowForwardDialog] = useState(false)
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null)
  const [isParticipant, setIsParticipant] = useState(true)
  const [leftAt, setLeftAt] = useState<Date | null>(null)
  const [showUserProfileDialog, setShowUserProfileDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Selection mode for delete
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Reply mode
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)

  // User cache for looking up sender names
  const [userCache, setUserCache] = useState<Map<string, string>>(new Map())

  // Monitor other user's status (for direct chat only)
  const { status: otherUserStatus, lastSeenText } = useUserStatus(
    !isGroupChat ? otherUserId : null
  )

  // Reset selection, clear cache and reply when chatId changes
  useEffect(() => {
    setSelectionMode(false)
    setSelectedMessageIds(new Set())
    setUserCache(new Map()) // Clear user cache for new chat
    setReplyingTo(null) // Clear reply preview when switching rooms
  }, [chatId])

  // Lookup missing sender names from users collection
  useEffect(() => {
    const fetchMissingUsers = async () => {
      // Find all unique sender IDs that need lookup (missing or empty senderName)
      const senderIdsToFetch = new Set<string>()

      messages.forEach(m => {
        // Skip system messages
        if (m.senderId === 'system') return

        // Check if senderName is missing or empty and not already in cache
        if ((!m.senderName || m.senderName.trim() === '') && !userCache.has(m.senderId)) {
          senderIdsToFetch.add(m.senderId)
        }

        // Also check replyTo senderName
        if (m.replyTo && (!m.replyTo.senderName || m.replyTo.senderName.trim() === '' || m.replyTo.senderName === 'Deleted User')) {
          if (!userCache.has(m.replyTo.senderId)) {
            senderIdsToFetch.add(m.replyTo.senderId)
          }
        }
      })

      // Fetch user data for missing senders
      if (senderIdsToFetch.size > 0) {
        const newCache = new Map(userCache)

        // Fetch all users in parallel
        const fetchPromises = Array.from(senderIdsToFetch).map(async (userId) => {
          try {
            const result = await userRepository.getUserById(userId)
            if (result.status === 'success' && result.data.displayName) {
              return { userId, name: result.data.displayName }
            } else {
              return { userId, name: 'Deleted User' }
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error)
            return { userId, name: 'Deleted User' }
          }
        })

        // Wait for all fetches to complete
        const results = await Promise.all(fetchPromises)

        // Update cache with all results at once
        results.forEach(({ userId, name }) => {
          newCache.set(userId, name)
        })

        setUserCache(newCache)
      }
    }

    if (messages.length > 0) {
      fetchMissingUsers()
    }
  }, [messages])

  // Handle ESC key to cancel selection
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectionMode) {
        setSelectionMode(false)
        setSelectedMessageIds(new Set())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectionMode])

  // Load room title and group members
  useEffect(() => {
    let unsubscribeDirectUser: (() => void) | null = null
    let unsubscribeGroupMembers: (() => void)[] = []

    async function loadRoomInfo() {
      console.log('[ChatRoom] Loading room info:', { chatId, isGroupChat })

      if (isGroupChat) {
        // For group chats, fetch group info
        const groupResult = await chatRepository.getGroupChat(chatId)
        console.log('[ChatRoom] Group chat result:', groupResult)

        if (groupResult.status === 'success') {
          setRoomTitle(groupResult.data.name)
          setRoomAvatar(groupResult.data.avatar || groupResult.data.avatarUrl || '')
          setGroupAdmins(groupResult.data.admins || [])

          console.log('[ChatRoom] Group info loaded:', {
            name: groupResult.data.name,
            participants: groupResult.data.participants,
            admins: groupResult.data.admins,
          })

          // Check if current user is still a participant
          const isStillParticipant = groupResult.data.participants.includes(currentUserId)
          setIsParticipant(isStillParticipant)

          // Get leftAt timestamp if user has left
          if (!isStillParticipant && groupResult.data.leftMembers?.[currentUserId]) {
            setLeftAt(groupResult.data.leftMembers[currentUserId].toDate())
          } else {
            setLeftAt(null)
          }

          // Fetch all group members initially
          const memberPromises = groupResult.data.participants.map(userId =>
            userRepository.getUserById(userId)
          )
          const memberResults = await Promise.all(memberPromises)
          console.log('[ChatRoom] Member results:', memberResults)

          const members = memberResults.map((r, index) => {
            if (r.status === 'success') {
              // If displayName is missing, set to "Deleted User"
              if (!r.data.displayName || r.data.displayName.trim() === '') {
                console.log('[ChatRoom] Member has no displayName:', r.data.userId)
                return {
                  ...r.data,
                  displayName: 'Deleted User',
                  email: r.data.email || 'deleted@user.com'
                }
              }
              return r.data
            } else {
              // If user not found, create placeholder
              console.log('[ChatRoom] Member not found:', groupResult.data.participants[index])
              return {
                userId: groupResult.data.participants[index],
                displayName: 'Deleted User',
                email: 'deleted@user.com',
                status: UserStatus.OFFLINE,
                isActive: false
              } as User
            }
          })
          console.log('[ChatRoom] All members loaded:', members)
          setGroupMembers(members)

          // Setup real-time listeners for each group member
          console.log('[ChatRoom] Setting up real-time listeners for group members')
          groupResult.data.participants.forEach((userId) => {
            const unsubscribe = userRepository.listenToUser(
              userId,
              (userData: User) => {
                console.log('[ChatRoom] Group member data updated:', {
                  userId: userData.userId,
                  displayName: userData.displayName
                })
                // Update this specific member in the groupMembers array
                setGroupMembers(prevMembers => {
                  const updatedMembers = prevMembers.map(member => {
                    if (member.userId === userId) {
                      // Handle deleted user or missing displayName
                      const displayName = userData.displayName && userData.displayName.trim() !== ''
                        ? userData.displayName
                        : 'Deleted User'
                      return {
                        ...userData,
                        displayName,
                        email: userData.email || 'deleted@user.com'
                      }
                    }
                    return member
                  })
                  return updatedMembers
                })
              },
              (error: string) => {
                console.error('[ChatRoom] Error listening to group member:', error)
                // Mark user as deleted on error
                setGroupMembers(prevMembers => {
                  return prevMembers.map(member => {
                    if (member.userId === userId) {
                      return {
                        ...member,
                        displayName: 'Deleted User',
                        email: 'deleted@user.com'
                      }
                    }
                    return member
                  })
                })
              }
            )
            unsubscribeGroupMembers.push(unsubscribe)
          })
        }
        // Reset for group chats
        setIsDeletedUser(false)
      } else {
        // For direct chats, get the other user's info and listen for changes
        const parts = chatId.replace('direct_', '').split('_')
        const foundOtherUserId = parts.find(id => id !== currentUserId)
        console.log('[ChatRoom] Direct chat - Other user ID:', foundOtherUserId)

        if (foundOtherUserId) {
          setOtherUserId(foundOtherUserId)

          // Setup real-time listener for user data
          unsubscribeDirectUser = userRepository.listenToUser(
            foundOtherUserId,
            (userData: User) => {
              // Handle deleted user or missing displayName
              const displayName = userData.displayName && userData.displayName.trim() !== ''
                ? userData.displayName
                : 'Deleted User'
              console.log('[ChatRoom] Direct chat user data updated:', {
                userId: userData.userId,
                displayName,
                isDeleted: displayName === 'Deleted User'
              })
              setRoomTitle(displayName)
              setRoomAvatar(userData.imageURL || userData.imageUrl || '')
              setIsDeletedUser(displayName === 'Deleted User')
            },
            (error: string) => {
              // User not found or error
              console.error('[ChatRoom] Error listening to user:', error)
              setRoomTitle('Deleted User')
              setRoomAvatar('')
              setIsDeletedUser(true)
            }
          )
        } else {
          console.error('[ChatRoom] Could not find other user ID in chat ID')
          setOtherUserId(null)
        }
      }
    }

    loadRoomInfo()

    return () => {
      if (unsubscribeDirectUser) {
        unsubscribeDirectUser()
      }
      // Cleanup all group member listeners
      unsubscribeGroupMembers.forEach(unsubscribe => {
        if (unsubscribe) {
          unsubscribe()
        }
      })
    }
  }, [chatId, currentUserId, isGroupChat])

  // Real-time detection for removed users and admin changes (group chat only)
  // Based on: LEAVE_GROUP_FEATURE.md - Real-time Updates section
  useEffect(() => {
    if (!isGroupChat) return

    console.log('[ChatRoom] Setting up real-time listener for group:', chatId)

    // Listen to group document for participant changes and admin updates
    const groupRef = doc(db(), 'groupChats', chatId)
    const unsubscribe = onSnapshot(
      groupRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          // Group deleted
          console.log('[ChatRoom] Group deleted:', chatId)
          toast.info('Grup telah dihapus')
          onLeaveGroup?.()
          return
        }

        const groupData = snapshot.data()
        const participantsMap = groupData?.participantsMap || {}
        const participants = groupData?.participants || []
        const admins = groupData?.admins || []

        console.log('[ChatRoom] Real-time group update:', {
          participants,
          admins,
          participantsMap,
          currentUserInParticipants: participants.includes(currentUserId),
          currentUserInParticipantsMap: !!participantsMap[currentUserId]
        })

        // Update admins state in real-time
        setGroupAdmins(admins)

        // Update room title and avatar in real-time
        if (groupData?.name) {
          setRoomTitle(groupData.name)
        }
        if (groupData?.avatar || groupData?.avatarUrl) {
          setRoomAvatar(groupData.avatar || groupData.avatarUrl || '')
        }

        // Check if current user is still in participantsMap
        if (!participantsMap[currentUserId] && !participants.includes(currentUserId)) {
          // User was removed from group
          console.log('[ChatRoom] Current user removed from group')
          toast.info('Anda telah dikeluarkan dari grup ini')
          onLeaveGroup?.()
        }
      },
      (error) => {
        console.error('[ChatRoom] Error listening to group changes:', error)
      }
    )

    return () => unsubscribe()
  }, [chatId, currentUserId, isGroupChat, onLeaveGroup])

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      console.log('[ChatRoom] Messages loaded:', {
        count: messages.length,
        messages: messages.map(m => ({
          messageId: m.messageId,
          senderId: m.senderId,
          senderName: m.senderName,
          type: m.type,
          timestamp: m.timestamp,
          isDeleted: m.isDeleted
        }))
      })
      markAsRead(currentUserId)
    }
  }, [messages.length, loading, currentUserId, markAsRead])

  // Auto-scroll to bottom when new messages arrive
  const prevMessagesLengthRef = useRef(messages.length)
  useEffect(() => {
    // Only scroll if new messages were added (length increased)
    if (messages.length > prevMessagesLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessagesLengthRef.current = messages.length
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
    const result = await chatRepository.leaveGroupChat(currentUserId, chatId, currentUserName)
    setLeaving(false)

    if (result.status === 'success') {
      setShowLeaveDialog(false)
      onLeaveGroup?.()
    } else if (result.status === 'error') {
      alert(`Failed to leave group: ${result.message}`)
    }
  }

  // Handle delete chat
  const handleDeleteChat = async () => {
    setDeletingChat(true)
    const result = await chatRepository.deleteChat(chatId, currentUserId, isGroupChat)
    setDeletingChat(false)

    if (result.status === 'success') {
      toast.success('Chat berhasil dihapus')
      setShowDeleteChatDialog(false)
      if (onCloseChat) {
        onCloseChat()
      }
    } else if (result.status === 'error') {
      toast.error(result.message || 'Gagal menghapus chat')
    }
  }

  // Handle delete history
  const handleDeleteHistory = async () => {
    setDeletingHistory(true)
    const result = await chatRepository.deleteHistory(chatId, currentUserId, isGroupChat)
    setDeletingHistory(false)

    if (result.status === 'success') {
      toast.success('Chat berhasil dibersihkan')
      setShowDeleteHistoryDialog(false)
      if (onCloseChat) {
        onCloseChat()
      }
    } else if (result.status === 'error') {
      toast.error(result.message || 'Gagal menghapus riwayat chat')
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

  // Handle name update
  const handleNameUpdate = (newName: string) => {
    setRoomTitle(newName)
  }

  // Handle admins update
  const handleAdminsUpdate = (admins: string[]) => {
    setGroupAdmins(admins)
  }

  // Handle forward message
  const handleForwardClick = (messageId: string) => {
    // Reset selection mode when opening forward dialog
    setSelectionMode(false)
    setSelectedMessageIds(new Set())
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

  // Handle avatar click to show user profile
  const handleAvatarClick = async (userId: string) => {
    // Don't show profile for system messages or current user
    if (userId === 'system' || userId === currentUserId) return

    // Reset selection mode when opening user profile
    setSelectionMode(false)
    setSelectedMessageIds(new Set())

    try {
      const result = await userRepository.getUserById(userId)
      if (result.status === 'success') {
        // Don't show profile for deleted users (users without displayName)
        const isDeletedUser = !result.data.displayName || result.data.displayName.trim() === ''
        if (isDeletedUser) {
          return // Don't show dialog for deleted users
        }

        setSelectedUser(result.data)
        setShowUserProfileDialog(true)
      } else {
        // User not found in database (deleted user)
        // Don't show any error or dialog
        return
      }
    } catch (error) {
      console.error('Load user profile error:', error)
      // Don't show error toast for deleted users
    }
  }

  // Handle send message from user profile dialog
  const handleSendMessageToUser = async () => {
    if (!selectedUser || !onChatSelect) return

    setShowUserProfileDialog(false)

    // Create or get direct chat with selected user
    const result = await chatRepository.getOrCreateDirectChat(currentUserId, selectedUser.userId)
    if (result.status === 'success') {
      // Switch to the direct chat
      onChatSelect(result.data.chatId, false)
    } else {
      toast.error('Failed to create chat')
    }
  }

  // Selection mode handlers
  const handleLongPress = (messageId: string) => {
    setSelectionMode(true)
    setSelectedMessageIds(new Set([messageId]))
  }

  const handleToggleSelect = (messageId: string) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      // Exit selection mode if no messages selected
      if (newSet.size === 0) {
        setSelectionMode(false)
      }
      return newSet
    })
  }

  const handleCancelSelection = () => {
    setSelectionMode(false)
    setSelectedMessageIds(new Set())
  }

  const handleOpenDeleteDialog = () => {
    if (selectedMessageIds.size === 0) return
    setShowDeleteDialog(true)
  }

  const handleDeleteForMe = async () => {
    try {
      const result = await messageRepository.deleteMessageForMe(
        chatId,
        Array.from(selectedMessageIds),
        currentUserId,
        isGroupChat
      )

      if (result.status === 'success') {
        if (result.data.failedMessages.length > 0) {
          toast.warning(
            `${result.data.successCount} pesan berhasil dihapus. ${result.data.failedMessages.length} pesan gagal (lebih dari 48 jam atau tidak ditemukan)`
          )
        } else {
          toast.success(`${result.data.successCount} pesan berhasil dihapus`)
        }
        handleCancelSelection()
      } else if (result.status === 'error') {
        toast.error(result.message || 'Gagal menghapus pesan')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Gagal menghapus pesan')
    }
  }

  const handleDeleteForEveryone = async () => {
    try {
      const result = await messageRepository.deleteMessageForEveryone(
        chatId,
        Array.from(selectedMessageIds),
        currentUserId,
        isGroupChat
      )

      if (result.status === 'success') {
        if (result.data.failedMessages.length > 0) {
          toast.warning(
            `${result.data.successCount} pesan berhasil dihapus untuk semua orang. ${result.data.failedMessages.length} pesan gagal (bukan pengirim, lebih dari 15 menit, atau tidak ditemukan)`
          )
        } else {
          toast.success(`${result.data.successCount} pesan berhasil dihapus untuk semua orang`)
        }
        handleCancelSelection()
      } else if (result.status === 'error') {
        toast.error(result.message || 'Gagal menghapus pesan')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Gagal menghapus pesan')
    }
  }

  // Get selected messages for delete dialog
  const selectedMessages = messages.filter(msg =>
    selectedMessageIds.has(msg.messageId)
  ) as unknown as Message[]

  // Reply handlers
  const handleReply = (messageId: string) => {
    const message = messages.find(m => m.messageId === messageId)
    if (message) {
      setReplyingTo(message)
    }
  }

  const handleCancelReply = () => {
    setReplyingTo(null)
  }

  const handleReplyClick = (messageId: string) => {
    // Find message index in reversed list and scroll to it
    const reversedMessages = [...messages].reverse()
    const index = reversedMessages.findIndex(m => m.messageId === messageId)

    if (index >= 0) {
      // Scroll to the message
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Handle click on header (name/avatar)
  const handleHeaderClick = async () => {
    // Reset selection mode
    setSelectionMode(false)
    setSelectedMessageIds(new Set())

    if (isGroupChat) {
      // Open group info dialog
      setShowGroupInfoDialog(true)
    } else {
      // Open user profile for direct chat
      if (otherUserId && !isDeletedUser) {
        try {
          const result = await userRepository.getUserById(otherUserId)
          if (result.status === 'success') {
            console.log('[ChatRoom] User data for profile:', {
              userId: result.data.userId,
              displayName: result.data.displayName,
              imageURL: result.data.imageURL,
              imageUrl: result.data.imageUrl,
              hasImage: !!(result.data.imageURL || result.data.imageUrl)
            })
            setSelectedUser(result.data)
            setShowUserProfileDialog(true)
          }
        } catch (error) {
          console.error('Load user profile error:', error)
        }
      }
    }
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col relative">
      <header className="flex items-center justify-between border-b px-4 py-3 shadow-sm z-10" style={{ backgroundColor: '#fafafa' }}>
        <button
          onClick={handleHeaderClick}
          className="flex items-center gap-3 flex-1 min-w-0 hover:bg-muted/50 transition-colors rounded-lg px-2 py-1 -ml-2 disabled:hover:bg-transparent"
          disabled={isDeletedUser}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={roomAvatar || "/placeholder-user.jpg"} alt="" />
            <AvatarFallback className={isGroupChat ? "bg-muted border border-border flex items-center justify-center" : ""}>
              {isGroupChat ? (
                <Users className="h-5 w-5 text-muted-foreground" />
              ) : (
                roomTitle.slice(0, 2).toUpperCase()
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <h1 className="text-base font-semibold break-words line-clamp-2">
              {roomTitle}
            </h1>
            {isGroupChat && groupMembers.length > 0 ? (
              <p className="text-xs text-muted-foreground truncate overflow-hidden whitespace-nowrap text-ellipsis">
                {getMemberNamesDisplay()}
              </p>
            ) : !isGroupChat && lastSeenText ? (
              <p className={`text-xs truncate ${otherUserStatus === UserStatus.ONLINE ? 'text-green-600' : 'text-muted-foreground'}`}>
                {lastSeenText}
              </p>
            ) : null}
          </div>
        </button>

        {/* Three dots menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-10 w-10"
              aria-label="Menu options"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {isGroupChat ? (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectionMode(false)
                    setSelectedMessageIds(new Set())
                    setShowGroupInfoDialog(true)
                  }}
                  className="flex items-center gap-2"
                >
                  <Info className="h-4 w-4" />
                  <span>Info grup</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (onCloseChat) {
                      onCloseChat()
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  <span>Tutup chat</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteHistoryDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Eraser className="h-4 w-4" />
                  <span>Bersihkan chat</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteChatDialog(true)}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Hapus chat</span>
                </DropdownMenuItem>
                {isParticipant && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowLeaveDialog(true)}
                      className="flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Keluar dari grup</span>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    if (onCloseChat) {
                      onCloseChat()
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  <span>Tutup chat</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteHistoryDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Eraser className="h-4 w-4" />
                  <span>Bersihkan chat</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteChatDialog(true)}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Hapus chat</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
                  // Filter messages: if user left, only show messages before leftAt
                  if (leftAt && m.timestamp) {
                    const messageTime = m.timestamp.toDate()
                    if (messageTime > leftAt) {
                      // Skip messages after user left
                      return null
                    }
                  }

                  // Check if this is a system message
                  if (m.senderId === 'system') {
                    return (
                      <div key={m.messageId} className="flex justify-center my-2">
                        <div className="bg-muted/50 px-3 py-1.5 rounded-lg">
                          <p className="text-xs text-muted-foreground">{m.text}</p>
                        </div>
                      </div>
                    )
                  }

                  const timestamp = m.timestamp?.toDate()
                  const timeStr = timestamp ? format(timestamp, 'HH:mm') : ''

                  // Format edited timestamp if exists
                  const editedAt = m.editedAt?.toDate()
                  const editedTimeStr = editedAt ? format(editedAt, 'HH:mm') : undefined

                  // Map message type to ChatMessage type format
                  const messageType = m.type === 'DOCUMENT' ? 'doc'
                    : m.type === 'VOICE_CALL' ? 'voice_call'
                    : m.type === 'VIDEO_CALL' ? 'video_call'
                    : m.type.toLowerCase()

                  // Handle missing senderName - lookup from users collection or use cached value
                  // If senderName is not available and not in cache yet, skip rendering until cache is ready
                  if (!m.senderName || m.senderName.trim() === '') {
                    const cachedName = userCache.get(m.senderId)
                    if (!cachedName) {
                      // Still fetching, don't render this message yet to avoid flicker
                      return null
                    }
                  }

                  const senderName = m.senderName && m.senderName.trim() !== ''
                    ? m.senderName
                    : userCache.get(m.senderId) || 'Deleted User'

                  return (
                    <div key={m.messageId} data-message-id={m.messageId}>
                      <ChatMessage
                        data={{
                          id: m.messageId,
                          type: messageType as any,
                          content: m.mediaUrl || m.text,
                          fileName: m.mediaMetadata?.fileName,
                          fileSize: m.mediaMetadata?.fileSize ? `${(m.mediaMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` : undefined,
                          mimeType: m.mediaMetadata?.mimeType,
                          callMetadata: m.callMetadata,
                          senderId: m.senderId,
                          senderName: senderName,
                          senderAvatar: m.senderAvatar,
                          timestamp: timeStr,
                          editedAt: editedTimeStr,
                          status: m.status,
                          error: m.error,
                          isDeleted: m.isDeleted,
                          isForwarded: m.isForwarded,
                          replyTo: m.replyTo ? {
                            messageId: m.replyTo.messageId,
                            senderId: m.replyTo.senderId,
                            senderName: m.replyTo.senderName,
                            text: m.replyTo.text,
                            type: m.replyTo.type,
                            mediaUrl: m.replyTo.mediaUrl
                          } : null
                        }}
                        isMe={m.senderId === currentUserId}
                        isGroupChat={isGroupChat}
                        userCache={userCache}
                        onRetry={retryMessage}
                        onForward={handleForwardClick}
                        onDelete={deleteMessage}
                        onEdit={editMessage}
                        onAvatarClick={handleAvatarClick}
                        selectionMode={selectionMode}
                        isSelected={selectedMessageIds.has(m.messageId)}
                        onToggleSelect={handleToggleSelect}
                        onLongPress={handleLongPress}
                        onReply={handleReply}
                        onReplyClick={handleReplyClick}
                      />
                    </div>
                  )
                })}

                <div ref={scrollRef} />
              </>
            )}
          </div>
        )}
        <div className="h-16" />
      </ScrollArea>
      <Separator />
      <div className="w-full absolute left-0 right-0 w-full bottom-0">
        {selectionMode ? (
          /* Selection toolbar */
          <div className="flex items-center justify-between border-t px-4 py-3 bg-background shadow-sm">
            <div className="flex items-center gap-3 flex-1">
              <Button variant="ghost" size="icon" onClick={handleCancelSelection}>
                <X className="h-5 w-5" />
              </Button>
              <span className="text-sm font-medium">{selectedMessageIds.size} terpilih</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenDeleteDialog}
              disabled={selectedMessageIds.size === 0}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        ) : isDeletedUser ? (
          <div className="flex items-center justify-center px-4 py-3 bg-muted">
            <p className="text-sm text-muted-foreground">
              You can't send messages to this user
            </p>
          </div>
        ) : isGroupChat && !isParticipant ? (
          <div className="flex items-center justify-center px-4 py-3 bg-muted">
            <p className="text-sm text-muted-foreground">
              You are no longer a participant in this group
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Reply preview bar - mepet dengan message composer */}
            {replyingTo && (
              <div className="px-4">
                <ReplyPreviewBar
                  replyingTo={replyingTo}
                  onCancel={handleCancelReply}
                />
              </div>
            )}
            <MessageComposer
              isReplying={replyingTo !== null}
              chatId={chatId}
              onSendText={(text) => {
                const replyToData = replyingTo ? {
                  messageId: replyingTo.messageId,
                  senderId: replyingTo.senderId,
                  senderName: replyingTo.senderName,
                  text: replyingTo.text.substring(0, 100), // Truncate to 100 chars
                  type: replyingTo.type,
                  mediaUrl: replyingTo.mediaUrl || null
                } : null
                sendTextMessage(currentUserId, currentUserName, text, currentUserAvatar, replyToData)
                setReplyingTo(null) // Clear reply state after sending
              }}
              onSendImage={(file, shouldCompress) => sendImage(currentUserId, currentUserName, file, shouldCompress, currentUserAvatar)}
              onSendVideo={(file) => sendVideo(currentUserId, currentUserName, file, currentUserAvatar)}
              onSendDocument={(file) => sendDocument(currentUserId, currentUserName, file, currentUserAvatar)}
              disabled={false}
              uploading={uploading}
            />
          </div>
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
          onNameUpdate={handleNameUpdate}
          onAdminsUpdate={handleAdminsUpdate}
          onChatSelect={onChatSelect}
          onLeaveGroup={() => {
            setShowGroupInfoDialog(false)
            onLeaveGroup?.()
          }}
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

      {/* User Profile Dialog */}
      <UserProfileDialog
        open={showUserProfileDialog}
        onOpenChange={setShowUserProfileDialog}
        user={selectedUser}
        onSendMessage={handleSendMessageToUser}
      />

      {/* Delete Message Dialog */}
      <DeleteMessageDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedMessages={selectedMessages}
        currentUserId={currentUserId}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
      />

      {/* Delete Chat Dialog */}
      <AlertDialog open={showDeleteChatDialog} onOpenChange={setShowDeleteChatDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              {isGroupChat
                ? 'Apakah Anda yakin ingin menghapus chat grup ini? Semua pesan dalam chat ini akan dihapus dari perangkat Anda.'
                : 'Apakah Anda yakin ingin menghapus chat ini? Semua pesan dalam chat ini akan dihapus dari perangkat Anda.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingChat}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteChat()
              }}
              disabled={deletingChat}
              className="text-white hover:text-white transition-colors"
              style={{ backgroundColor: '#E54C38' }}
              onMouseEnter={(e) => {
                if (!deletingChat) {
                  e.currentTarget.style.backgroundColor = '#D43D28'
                }
              }}
              onMouseLeave={(e) => {
                if (!deletingChat) {
                  e.currentTarget.style.backgroundColor = '#E54C38'
                }
              }}
            >
              {deletingChat ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Hapus"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete History Dialog */}
      <AlertDialog open={showDeleteHistoryDialog} onOpenChange={setShowDeleteHistoryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bersihkan Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua pesan dalam chat ini akan dihapus dari perangkat Anda. Chat akan hilang dari daftar, namun akan muncul kembali jika ada pesan baru. User lain tetap dapat melihat semua pesan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingHistory}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteHistory()
              }}
              disabled={deletingHistory}
              className="text-white hover:text-white transition-colors"
              style={{ backgroundColor: '#E54C38' }}
              onMouseEnter={(e) => {
                if (!deletingHistory) {
                  e.currentTarget.style.backgroundColor = '#D43D28'
                }
              }}
              onMouseLeave={(e) => {
                if (!deletingHistory) {
                  e.currentTarget.style.backgroundColor = '#E54C38'
                }
              }}
            >
              {deletingHistory ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Membersihkan...
                </>
              ) : (
                "Bersihkan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
