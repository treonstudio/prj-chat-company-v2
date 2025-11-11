"use client"

import { useEffect, useRef, useMemo, useCallback, useLayoutEffect, startTransition } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ChatMessage } from "./chat-message"
import { MessageComposer } from "./message-composer"
import { useMessages } from "@/lib/hooks/use-messages"
import { useUserStatus } from "@/lib/hooks/use-user-status"
import { useOnlineStatus } from "@/lib/hooks/use-online-status"
import { useStaticAsset } from "@/lib/hooks/use-static-asset"
import { UserRepository } from "@/lib/repositories/user.repository"
import { ChatRepository } from "@/lib/repositories/chat.repository"
import { format } from "date-fns"
import { useState } from "react"
import { ChatType, User, UserStatus, Message, MessageStatus } from "@/types/models"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut, Loader2, Users, Trash2, X, MoreVertical, Info, Eraser, CheckSquare, User as UserIcon, Share2 } from "lucide-react"
import { doc, onSnapshot, getDoc } from "firebase/firestore"
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useUploadManager } from "@/lib/stores/upload-manager.store"

const userRepository = new UserRepository()
const chatRepository = new ChatRepository()
const messageRepository = new MessageRepository()

// Helper function to safely convert timestamp to Date (handles both Firestore Timestamp and plain objects from cache)
function timestampToDate(timestamp: any): Date | null {
  if (!timestamp) return null;

  // If it's a Firestore Timestamp object with toDate method
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }

  // If it's a plain object from cache with seconds property
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
  }

  return null;
}

export function ChatRoom({
  chatId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isGroupChat,
  initialTitle,
  initialAvatar,
  onLeaveGroup,
  onChatSelect,
  onCloseChat,
}: {
  chatId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar?: string
  isGroupChat: boolean
  initialTitle?: string
  initialAvatar?: string
  onLeaveGroup?: () => void
  onChatSelect?: (chatId: string, isGroup: boolean, chatName?: string, chatAvatar?: string) => void
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
    sendImageGroup,
    sendVideo,
    sendDocument,
    markAsRead,
    retryMessage,
    deleteMessage,
    editMessage,
    cancelUpload,
  } = useMessages(chatId, isGroupChat, currentUserId)

  // Global upload manager for persistent progress
  const uploadManager = useUploadManager()

  // Subscribe to uploads map for re-rendering when uploads change
  const uploadsMap = useUploadManager((state) => state.uploads)

  // Get active uploads for this chat (memoized to avoid infinite loops)
  const activeUploadsForThisChat = useMemo(() => {
    return Array.from(uploadsMap.values()).filter(
      (upload) => upload.chatId === chatId && (upload.status === 'uploading' || upload.status === 'pending')
    )
  }, [uploadsMap, chatId])

  // Load tile pattern background from cache
  const tilePatternUrl = useStaticAsset('/tile-pattern.png', '1.0')

  // CRITICAL: Use initialTitle/initialAvatar from props to prevent flicker
  const [roomTitle, setRoomTitle] = useState<string>(initialTitle || 'Chat')
  const [roomAvatar, setRoomAvatar] = useState<string>(initialAvatar || '')
  const [otherUserId, setOtherUserId] = useState<string | null>(null)

  // Sync with initial props when they change (chat switch)
  useEffect(() => {
    if (initialTitle) setRoomTitle(initialTitle)
    if (initialAvatar !== undefined) setRoomAvatar(initialAvatar)
  }, [chatId, initialTitle, initialAvatar])

  // ESC key listener to close chat room
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if ESC key is pressed and no modal is open
      if (event.key === 'Escape' && onCloseChat) {
        // Don't close if user is typing in an input or textarea
        const activeElement = document.activeElement
        const isInputFocused = activeElement?.tagName === 'INPUT' ||
                              activeElement?.tagName === 'TEXTAREA' ||
                              activeElement?.getAttribute('contenteditable') === 'true'

        // Don't close if any dialog/modal is open
        const isDialogOpen = document.querySelector('[role="dialog"]') !== null

        if (!isInputFocused && !isDialogOpen) {
          event.preventDefault()
          onCloseChat()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCloseChat])

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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const isLoadingMore = useRef(false)
  const hasScrolledToBottom = useRef(false) // Track if we've scrolled to bottom for this chatId
  const [visibleMessageCount, setVisibleMessageCount] = useState(50) // Initially show 50 messages (increased)
  const MESSAGES_PER_LOAD = 30 // Load more at once for smoother experience

  // Selection mode for delete
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Header dropdown menu
  const [showDropdownMenu, setShowDropdownMenu] = useState(false)

  // Media viewer (image/video preview)
  const [hasMediaViewerOpen, setHasMediaViewerOpen] = useState(false)

  // Check if any dialog, menu, or media viewer is open - disable context menu when true
  const hasOpenDialog = showGroupInfoDialog ||
    showLeaveDialog ||
    showDeleteChatDialog ||
    showDeleteHistoryDialog ||
    showForwardDialog ||
    showUserProfileDialog ||
    showDeleteDialog ||
    showDropdownMenu ||
    hasMediaViewerOpen

  // Reply mode
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const replyBarRef = useRef<HTMLDivElement>(null)
  const [replyBarHeight, setReplyBarHeight] = useState(0)

  // Measure reply bar height when it appears/disappears
  useLayoutEffect(() => {
    if (replyingTo && replyBarRef.current) {
      const height = replyBarRef.current.offsetHeight
      setReplyBarHeight(height)

      // Auto-scroll to bottom when reply bar appears
      // Multiple scroll attempts to ensure we reach true bottom after padding applied
      const smoothScrollAttempt = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom(false) // Smooth scroll
          })
        })
      }

      const instantScrollAttempt = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom(true) // Instant scroll to guarantee bottom
          })
        })
      }

      // Schedule multiple scrolls with increasing delays
      const timers = [
        setTimeout(smoothScrollAttempt, 100),  // Initial smooth scroll
        setTimeout(smoothScrollAttempt, 300),  // After layout recalculation
        setTimeout(instantScrollAttempt, 600), // Final instant scroll to guarantee true bottom
      ]

      return () => timers.forEach(clearTimeout)
    } else {
      setReplyBarHeight(0)
    }
  }, [replyingTo])

  // User cache for looking up sender names and avatars
  const [userCache, setUserCache] = useState<Map<string, { name: string, avatar?: string }>>(new Map())

  // Monitor other user's status (for direct chat only)
  const { status: otherUserStatus, lastSeenText } = useUserStatus(
    !isGroupChat ? otherUserId : null
  )

  // Monitor online status for reconnect handling
  const { isOnline } = useOnlineStatus()

  // Helper function to compute actual message status based on readBy
  const computeMessageStatus = useCallback((
    message: Message,
    isMe: boolean,
    isGroupChat: boolean,
    otherUserId: string | null,
    groupMembers: User[]
  ): MessageStatus | undefined => {
    // Only compute for messages sent by current user
    if (!isMe) return message.status

    // If message has explicit PENDING, SENDING, or FAILED status, respect it
    // Don't compute based on readBy for these statuses
    if (message.status === MessageStatus.PENDING ||
      message.status === MessageStatus.SENDING ||
      message.status === MessageStatus.FAILED) {
      return message.status
    }

    const readBy = message.readBy || {}
    const deliveredTo = message.deliveredTo || {}
    const readByUserIds = Object.keys(readBy)
    const deliveredToUserIds = Object.keys(deliveredTo)

    if (isGroupChat) {
      // Group chat: READ if all other participants have read it
      const participantIds = groupMembers
        .map(m => m.userId)
        .filter(id => id !== message.senderId) // Exclude sender

      if (participantIds.length === 0) {
        // No other participants, consider as DELIVERED
        return MessageStatus.DELIVERED
      }

      // Check if ALL participants have read it
      const allRead = participantIds.every(id => readByUserIds.includes(id))

      if (allRead) {
        return MessageStatus.READ // Blue double check
      } else if (readByUserIds.length > 0) {
        return MessageStatus.DELIVERED // Gray double check (some read, not all)
      } else if (deliveredToUserIds.length > 0) {
        return MessageStatus.DELIVERED // Gray double check (delivered but not read)
      } else {
        return MessageStatus.SENT // Single check
      }
    } else {
      // Direct chat: READ if other user has read it
      if (otherUserId && readByUserIds.includes(otherUserId)) {
        return MessageStatus.READ // Blue double check
      } else if (readByUserIds.length > 0) {
        return MessageStatus.DELIVERED // Gray double check
      } else if (otherUserId && deliveredToUserIds.includes(otherUserId)) {
        return MessageStatus.DELIVERED // Gray double check (delivered but not read)
      } else {
        return MessageStatus.SENT // Single check
      }
    }
  }, [])

  // Reset selection, clear cache and reply when chatId changes
  useEffect(() => {
    setSelectionMode(false)
    setSelectedMessageIds(new Set())
    setUserCache(new Map()) // Clear user cache for new chat
    setReplyingTo(null) // Clear reply preview when switching rooms
  }, [chatId])

  // Lookup sender names and avatars from users collection
  useEffect(() => {
    const fetchMissingUsers = async () => {
      // Find all unique sender IDs that need lookup (not already in cache)
      const senderIdsToFetch = new Set<string>()

      messages.forEach(m => {
        // Skip system messages
        if (m.senderId === 'system') return

        // Fetch if not in cache - we need both name and avatar
        if (!userCache.has(m.senderId)) {
          senderIdsToFetch.add(m.senderId)
        }

        // Also check replyTo sender
        if (m.replyTo && !userCache.has(m.replyTo.senderId)) {
          senderIdsToFetch.add(m.replyTo.senderId)
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
              return {
                userId,
                name: result.data.displayName,
                avatar: result.data.imageURL || result.data.imageUrl
              }
            } else {
              return { userId, name: 'Deleted User', avatar: undefined }
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error)
            return { userId, name: 'Deleted User', avatar: undefined }
          }
        })

        // Wait for all fetches to complete
        const results = await Promise.all(fetchPromises)

        // Update cache with all results at once
        results.forEach(({ userId, name, avatar }) => {
          newCache.set(userId, { name, avatar })
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
          // CRITICAL: Batch all initial state updates to prevent flickering
          // Use startTransition for non-urgent updates
          startTransition(() => {
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
              setLeftAt(timestampToDate(groupResult.data.leftMembers[currentUserId]))
            } else {
              setLeftAt(null)
            }
          })

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

          // CRITICAL: Use startTransition to prevent blocking render
          startTransition(() => {
            setGroupMembers(members)
          })

          // Setup real-time listeners for each group member
          console.log('[ChatRoom] Setting up real-time listeners for group members')
          groupResult.data.participants.forEach((userId) => {
            const unsubscribe = userRepository.listenToUser(
              userId,
              (userData: User) => {
                // Update this specific member in the groupMembers array
                setGroupMembers(prevMembers => {
                  // Find existing member to compare
                  const existingMember = prevMembers.find(m => m.userId === userId)

                  // Handle deleted user or missing displayName
                  const displayName = userData.displayName && userData.displayName.trim() !== ''
                    ? userData.displayName
                    : 'Deleted User'

                  const newEmail = userData.email || 'deleted@user.com'

                  // CRITICAL: Skip update if data hasn't changed (prevent unnecessary re-renders)
                  if (existingMember &&
                    existingMember.displayName === displayName &&
                    existingMember.email === newEmail &&
                    existingMember.status === userData.status &&
                    existingMember.imageURL === userData.imageURL &&
                    existingMember.imageUrl === userData.imageUrl) {
                    return prevMembers // No change, return same reference to prevent re-render
                  }

                  const updatedMembers = prevMembers.map(member => {
                    if (member.userId === userId) {
                      return {
                        ...userData,
                        displayName,
                        email: newEmail
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
        startTransition(() => {
          setIsDeletedUser(false)
        })
      } else {
        // For direct chats, get the other user's info and listen for changes
        const parts = chatId.replace('direct_', '').split('_')
        const foundOtherUserId = parts.find(id => id !== currentUserId)
        console.log('[ChatRoom] Direct chat - Other user ID:', foundOtherUserId)

        if (foundOtherUserId) {
          startTransition(() => {
            setOtherUserId(foundOtherUserId)
          })

          // Setup real-time listener for user data
          let prevData = { displayName: '', avatar: '', isDeleted: false }
          unsubscribeDirectUser = userRepository.listenToUser(
            foundOtherUserId,
            (userData: User) => {
              // Handle deleted user or missing displayName
              const displayName = userData.displayName && userData.displayName.trim() !== ''
                ? userData.displayName
                : 'Deleted User'
              const avatar = userData.imageURL || userData.imageUrl || ''
              const isDeleted = displayName === 'Deleted User'

              // CRITICAL: Skip update if data hasn't changed (prevent unnecessary re-renders)
              if (prevData.displayName === displayName &&
                prevData.avatar === avatar &&
                prevData.isDeleted === isDeleted) {
                return // No change, skip state updates
              }

              // Update previous data
              prevData = { displayName, avatar, isDeleted }

              // CRITICAL: Use startTransition for smoother updates
              startTransition(() => {
                setRoomTitle(displayName)
                setRoomAvatar(avatar)
                setIsDeletedUser(isDeleted)
              })
            },
            (error: string) => {
              // User not found or error
              console.error('[ChatRoom] Error listening to user:', error)
              startTransition(() => {
                setRoomTitle('Deleted User')
                setRoomAvatar('')
                setIsDeletedUser(true)
              })
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

    // Track previous values to prevent unnecessary re-renders
    let prevGroupData = {
      admins: [] as string[],
      name: '',
      avatar: ''
    }

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
        const name = groupData?.name || ''
        const avatar = groupData?.avatar || groupData?.avatarUrl || ''

        console.log('[ChatRoom] Real-time group update:', {
          participants,
          admins,
          participantsMap,
          currentUserInParticipants: participants.includes(currentUserId),
          currentUserInParticipantsMap: !!participantsMap[currentUserId]
        })

        // CRITICAL: Only update admins if changed (prevent re-render)
        const adminsChanged = JSON.stringify(prevGroupData.admins) !== JSON.stringify(admins)
        if (adminsChanged) {
          startTransition(() => {
            setGroupAdmins(admins)
          })
          prevGroupData.admins = admins
        }

        // CRITICAL: Only update room title if changed (prevent re-render)
        if (name && name !== prevGroupData.name) {
          startTransition(() => {
            setRoomTitle(name)
          })
          prevGroupData.name = name
        }

        // CRITICAL: Only update room avatar if changed (prevent re-render)
        if (avatar !== prevGroupData.avatar) {
          startTransition(() => {
            setRoomAvatar(avatar)
          })
          prevGroupData.avatar = avatar
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

  // Refetch group data when reconnecting to ensure role sync
  // This handles the case where user role changed while offline
  useEffect(() => {
    if (!isGroupChat) return
    if (!isOnline) return // Only trigger when back online

    console.log('[ChatRoom] Network reconnected - syncing group data')

    // Force re-fetch group data from Firestore
    const groupRef = doc(db(), 'groupChats', chatId)
    const syncGroupData = async () => {
      try {
        const snapshot = await getDoc(groupRef)
        if (!snapshot.exists()) return

        const groupData = snapshot.data()
        const admins = groupData?.admins || []
        const name = groupData?.name || ''
        const avatar = groupData?.avatar || groupData?.avatarUrl || ''
        const participantsMap = groupData?.participantsMap || {}

        // Update all group state
        startTransition(() => {
          setGroupAdmins(admins)
          if (name) setRoomTitle(name)
          if (avatar) setRoomAvatar(avatar)

          // Check if user is still participant
          if (!participantsMap[currentUserId]) {
            toast.info('Anda telah dikeluarkan dari grup ini')
            onLeaveGroup?.()
          }
        })

        console.log('[ChatRoom] Group data synced after reconnect:', { admins, name })
      } catch (error) {
        console.error('[ChatRoom] Failed to sync group data:', error)
      }
    }

    // Small delay to ensure Firestore connection is stable
    const timeoutId = setTimeout(syncGroupData, 1000)
    return () => clearTimeout(timeoutId)
  }, [isOnline, isGroupChat, chatId, currentUserId, onLeaveGroup])

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

  // Scroll to bottom
  const scrollToBottom = (instant = false) => {
    const scrollContainer = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollContainer) return

    // Direct scroll to bottom (instant and reliable)
    // Using scrollIntoView with smooth behavior can be unreliable for small scroll distances
    scrollContainer.scrollTop = scrollContainer.scrollHeight
  }

  // Reset visible message count and scroll flag when switching chatrooms
  useEffect(() => {
    setVisibleMessageCount(50) // Start with 50
    isLoadingMore.current = false
    hasScrolledToBottom.current = false // Reset scroll flag for new chat
  }, [chatId])

  // Adjust visible count on first load if we have fewer messages than 50
  useEffect(() => {
    if (!loading && messages.length > 0 && messages.length < 50) {
      setVisibleMessageCount(messages.length)
    }
  }, [loading, messages.length])

  // Memoize visible messages to avoid re-computing on every render (must be before scroll effects that use it)
  // Also inject synthetic messages for active uploads in this chat
  const visibleMessages = useMemo(() => {
    const reversed = [...messages].reverse()
    const sliced = reversed.slice(-visibleMessageCount)

    // Get active uploads for this chat from upload manager
    const activeUploads = uploadManager.getUploadsByChat(chatId)
      .filter(upload => upload.status === 'uploading' || upload.status === 'pending')

    // Create synthetic messages for active uploads that aren't already in the message list
    const syntheticMessages: Message[] = activeUploads
      .filter(upload => !sliced.some(msg => msg.messageId === upload.tempMessageId))
      .map(upload => {
        const emoji = upload.fileType === 'image' ? '🖼️' : upload.fileType === 'video' ? '🎥' : '📄'
        const phase = upload.phase === 'compressing' ? 'Compressing' : 'Uploading'
        const progressText = upload.progress > 0 ? `${phase}... ${upload.progress}%` : phase

        return {
          messageId: upload.tempMessageId,
          senderId: upload.userId,
          senderName: upload.userName,
          senderAvatar: upload.userAvatar,
          text: `${emoji} ${progressText}`,
          type: upload.fileType === 'image' ? 'IMAGE' : upload.fileType === 'video' ? 'VIDEO' : 'DOCUMENT',
          readBy: {},
          deliveredTo: {},
          timestamp: { seconds: upload.createdAt / 1000, nanoseconds: 0 } as any,
          status: MessageStatus.SENDING,
        } as Message
      })

    // Merge synthetic messages with existing messages
    return [...sliced, ...syntheticMessages]
  }, [messages, visibleMessageCount, chatId, activeUploadsForThisChat])

  // Progressive loading with IntersectionObserver (more performant than scroll listener)
  useEffect(() => {
    const trigger = loadMoreTriggerRef.current
    const scrollContainer = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]')

    if (!trigger || !scrollContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries

        // If trigger is visible and there are more messages to load and not currently loading
        if (entry.isIntersecting && visibleMessageCount < messages.length && !isLoadingMore.current) {
          isLoadingMore.current = true

          // Save scroll position and height BEFORE state update
          const previousScrollHeight = scrollContainer.scrollHeight
          const previousScrollTop = scrollContainer.scrollTop

          // Load more messages
          setVisibleMessageCount(prev => {
            const newCount = Math.min(prev + MESSAGES_PER_LOAD, messages.length)

            // Use double RAF for better timing with React 18+ rendering
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (scrollContainer) {
                  const newScrollHeight = scrollContainer.scrollHeight
                  const heightDifference = newScrollHeight - previousScrollHeight

                  // Instantly restore scroll position (no smooth scroll) to prevent jumping
                  if (heightDifference > 0) {
                    scrollContainer.scrollTop = previousScrollTop + heightDifference
                  }

                  // Allow next load after a short delay
                  setTimeout(() => {
                    isLoadingMore.current = false
                  }, 100)
                }
              })
            })

            return newCount
          })
        }
      },
      {
        root: scrollContainer,
        rootMargin: '400px', // Start loading 400px before trigger is visible
        threshold: 0.1
      }
    )

    observer.observe(trigger)

    return () => {
      observer.disconnect()
    }
  }, [visibleMessageCount, messages.length, MESSAGES_PER_LOAD])

  // Initial scroll to bottom when switching chatrooms or when messages finish loading
  useEffect(() => {
    // Only scroll if:
    // 1. Not loading
    // 2. We have messages
    // 3. We haven't scrolled to bottom yet for this chat
    if (!loading && messages.length > 0 && visibleMessages.length > 0 && !hasScrolledToBottom.current) {
      const scrollContainer = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]')

      if (scrollContainer) {
        // Mark as initial load
        isInitialLoad.current = true

        // Instant scroll to bottom - no smooth behavior
        const scrollToEnd = () => {
          if (scrollContainer) {
            // Direct scroll to bottom (instant, most reliable)
            scrollContainer.scrollTop = scrollContainer.scrollHeight

            // Also use scrollIntoView as backup (behavior: 'auto' = instant scroll)
            if (scrollRef.current) {
              scrollRef.current.scrollIntoView({ behavior: 'auto', block: 'end', inline: 'nearest' })
            }
          }
        }

        // Execute scroll immediately and with retries to ensure it works
        scrollToEnd() // Immediate execution

        // Retry multiple times to catch async rendering
        const timeouts = [
          setTimeout(scrollToEnd, 0),      // Next tick
          setTimeout(scrollToEnd, 10),     // Very quick
          setTimeout(scrollToEnd, 50),     // Quick
          setTimeout(scrollToEnd, 100),    // Medium
          setTimeout(scrollToEnd, 200),    // Slower (for images)
          setTimeout(scrollToEnd, 300),    // Even slower
        ]

        // Mark as scrolled and not initial load after final scroll
        const finalTimeout = setTimeout(() => {
          scrollToEnd() // One final scroll
          hasScrolledToBottom.current = true // Prevent re-scrolling on this chat
          isInitialLoad.current = false
          console.log('[ChatRoom] Scrolled to bottom for chat:', chatId)
        }, 350)

        return () => {
          // Cleanup all timeouts
          timeouts.forEach(clearTimeout)
          clearTimeout(finalTimeout)
        }
      }
    }
  }, [chatId, loading, messages.length, visibleMessages.length]) // Trigger when data is ready

  // Additional useLayoutEffect for even earlier scroll (runs before browser paint)
  useLayoutEffect(() => {
    // Only run if messages just finished loading
    if (!loading && messages.length > 0 && visibleMessages.length > 0 && !hasScrolledToBottom.current) {
      const scrollContainer = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]')

      if (scrollContainer) {
        // Instant scroll to bottom (synchronous, before paint)
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [loading, messages.length, visibleMessages.length])

  // Auto-scroll to bottom when new messages arrive (only for new messages, not initial load)
  const prevMessagesLengthRef = useRef(messages.length)
  const lastMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Skip if initial load or no messages
    if (isInitialLoad.current || messages.length === 0) {
      prevMessagesLengthRef.current = messages.length
      return
    }

    // Get the newest message (first in array, sorted descending by timestamp)
    const newestMessage = messages[0]

    // Check if we have a new message (either length increased OR messageId changed)
    const hasNewMessage = messages.length > prevMessagesLengthRef.current ||
                         (newestMessage && newestMessage.messageId !== lastMessageIdRef.current)

    if (hasNewMessage && newestMessage && newestMessage.senderId === currentUserId) {
      // Scroll to bottom for messages sent by current user
      // Use double RAF to wait for layout, then one delayed attempt for slow renders
      let rafId1: number, rafId2: number, timeoutId: ReturnType<typeof setTimeout>

      rafId1 = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(() => {
          scrollToBottom(false)
          // Single delayed retry for cases where images/media take time to render
          timeoutId = setTimeout(() => scrollToBottom(false), 100)
        })
      })

      // Cleanup function
      return () => {
        if (rafId1) cancelAnimationFrame(rafId1)
        if (rafId2) cancelAnimationFrame(rafId2)
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    prevMessagesLengthRef.current = messages.length
    lastMessageIdRef.current = newestMessage?.messageId || null
  }, [messages, currentUserId])

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
      // Note: Chat stays open and remains in sidebar
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
    // When forwarding single message (from context menu), reset selection
    setSelectionMode(false)
    setSelectedMessageIds(new Set())
    setForwardMessageId(messageId)
    setShowForwardDialog(true)
  }

  const handleForwardMessage = async (targetChatId: string, isGroup: boolean) => {
    // Get message IDs to forward (either from selection or single message)
    const messageIdsToForward = selectionMode && selectedMessageIds.size > 0
      ? Array.from(selectedMessageIds)
      : forwardMessageId ? [forwardMessageId] : []

    if (messageIdsToForward.length === 0) {
      toast.error('No messages selected')
      return
    }

    // Immediately switch to target chat
    if (onChatSelect) {
      onChatSelect(targetChatId, isGroup)
    }

    // Reset selection mode
    setSelectionMode(false)
    setSelectedMessageIds(new Set())
    setShowForwardDialog(false)

    // Forward messages in background
    try {
      if (messageIdsToForward.length === 1) {
        // Single message - use existing method
        const result = await messageRepository.forwardMessage(
          messageIdsToForward[0],
          chatId,
          targetChatId,
          currentUserId
        )

        if (result.status === 'error') {
          toast.error('Failed to forward message')
        }
      } else {
        // Multiple messages - use batch method
        const result = await messageRepository.forwardMessages(
          messageIdsToForward,
          chatId,
          targetChatId,
          currentUserId,
          currentUserName
        )

        if (result.status === 'success') {
          const { successCount, failedCount } = result.data

          // Show summary toast only if there were errors
          if (failedCount > 0) {
            toast.error(`${failedCount} message(s) failed to forward`)
          }
        } else {
          toast.error('Failed to forward messages')
        }
      }
      // Don't show success toast - user will see the messages appear in the chat
    } catch (error) {
      console.error('Forward error:', error)
      toast.error('Failed to forward messages')
    }
  }

  // Handle avatar click to show user profile
  const handleAvatarClick = useCallback(async (userId: string) => {
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
  }, [currentUserId, userRepository])

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
  const handleReply = useCallback((messageId: string) => {
    const message = messages.find(m => m.messageId === messageId)
    if (message) {
      setReplyingTo(message)
    }
  }, [messages])

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null)
  }, [])

  const handleReplyClick = useCallback((messageId: string) => {
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
  }, [messages])

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
      <header className="flex items-center justify-between border-b py-3 shadow-sm z-10 px-3" style={{ backgroundColor: '#fafafa' }}>
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
        <DropdownMenu open={showDropdownMenu} onOpenChange={setShowDropdownMenu}>
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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <ScrollArea
            ref={scrollContainerRef}
            className="flex-1 min-h-0 smooth-scroll scroll-optimized"
            style={{
              backgroundImage: tilePatternUrl ? `url(${tilePatternUrl})` : 'none',
              backgroundRepeat: 'repeat'
            }}
            onContextMenu={(e) => {
              // Prevent context menu when any dialog is open
              if (hasOpenDialog) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          >
            {loading ? (
              <div className="mx-auto w-full space-y-3 p-4">
                {/* Enhanced Message skeleton loader with varied heights */}
                {[
                  { lines: 2, widths: ['w-64', 'w-48'] },
                  { lines: 1, widths: ['w-32'] },
                  { lines: 3, widths: ['w-56', 'w-64', 'w-40'] },
                  { lines: 2, widths: ['w-48', 'w-36'] },
                  { lines: 1, widths: ['w-44'] },
                  { lines: 2, widths: ['w-52', 'w-60'] },
                  { lines: 3, widths: ['w-64', 'w-56', 'w-32'] },
                  { lines: 1, widths: ['w-40'] },
                ].map((skeleton, i) => (
                  <div key={i} className={`flex w-full ${i % 2 === 0 ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`} style={{ animationDelay: `${i * 25}ms` }}>
                    <div className={`flex flex-col gap-2 rounded-xl px-4 py-2 ${i % 2 === 0 ? 'max-w-[80%] ml-auto items-end bg-primary/10' : 'max-w-[80%] mr-auto items-start bg-muted'}`}>
                      {skeleton.widths.map((width, j) => (
                        <div key={j} className={`h-4 ${width} bg-muted-foreground/20 rounded animate-pulse`} style={{ animationDuration: '1.5s' }} />
                      ))}
                      <div className="h-3 w-16 bg-muted-foreground/20 rounded animate-pulse mt-1" style={{ animationDuration: '1.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : (
              <div
                className="mx-auto w-full space-y-3 p-4"
                style={{ paddingBottom: replyBarHeight > 0 ? `${replyBarHeight + 16}px` : '16px' }}
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {/* Invisible trigger for IntersectionObserver - positioned at top */}
                    {visibleMessageCount < messages.length && (
                      <div ref={loadMoreTriggerRef} className="h-px" />
                    )}

                    {visibleMessages.map((m, index) => {
                      // Filter messages: if user left, only show messages before leftAt
                      if (leftAt && m.timestamp) {
                        const messageTime = timestampToDate(m.timestamp)
                        if (messageTime && messageTime > leftAt) {
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

                      const timestamp = timestampToDate(m.timestamp)
                      const timeStr = timestamp ? format(timestamp, 'HH:mm') : ''

                      // Format edited timestamp if exists
                      const editedAt = timestampToDate(m.editedAt)
                      const editedTimeStr = editedAt ? format(editedAt, 'HH:mm') : undefined

                      // Map message type to ChatMessage type format
                      const messageType = m.type === 'DOCUMENT' ? 'doc'
                        : m.type === 'VOICE_CALL' ? 'voice_call'
                          : m.type === 'VIDEO_CALL' ? 'video_call'
                            : m.type.toLowerCase()

                      // Get user info from cache (name and avatar fetched by senderId)
                      const cachedUser = userCache.get(m.senderId)

                      // If user not in cache yet, skip rendering to avoid flicker
                      if (!cachedUser) {
                        return null
                      }

                      const senderName = m.senderName && m.senderName.trim() !== ''
                        ? m.senderName
                        : cachedUser.name
                      const senderAvatar = cachedUser.avatar

                      // Compute actual message status based on readBy
                      const isMe = m.senderId === currentUserId
                      const computedStatus = computeMessageStatus(m, isMe, isGroupChat, otherUserId, groupMembers)

                      // Check for active upload progress from global upload manager
                      const uploadTask = uploadManager.getUploadByTempMessageId(m.messageId)
                      const hasActiveUpload = uploadTask && (uploadTask.status === 'uploading' || uploadTask.status === 'pending')

                      // Override content and status if upload is in progress
                      let messageContent = m.mediaUrl || m.text
                      let messageStatus = computedStatus

                      if (hasActiveUpload) {
                        // Show progress in content
                        if (uploadTask.progress > 0 && uploadTask.progress < 100) {
                          const emoji = uploadTask.fileType === 'image' ? '🖼️' : uploadTask.fileType === 'video' ? '🎥' : '📄'
                          const phase = uploadTask.phase === 'compressing' ? 'Compressing' : 'Uploading'
                          messageContent = `${emoji} ${phase}... ${uploadTask.progress}%`
                        }
                        messageStatus = MessageStatus.SENDING
                      }

                      return (
                        <div
                          key={m.messageId}
                          data-message-id={m.messageId}
                          className="chat-message-container"
                        >
                          <ChatMessage
                            data={{
                              id: m.messageId,
                              type: messageType as any,
                              content: messageContent,
                              fileName: m.mediaMetadata?.fileName,
                              fileSize: m.mediaMetadata?.fileSize ? `${(m.mediaMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` : undefined,
                              mimeType: m.mediaMetadata?.mimeType,
                              mediaItems: m.mediaItems, // For IMAGE_GROUP
                              callMetadata: m.callMetadata,
                              senderId: m.senderId,
                              senderName: senderName,
                              senderAvatar: senderAvatar,
                              timestamp: timeStr,
                              isEdited: m.isEdited,
                              editedAt: editedTimeStr,
                              status: messageStatus,
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
                            onCancel={cancelUpload}
                            onMediaViewerChange={setHasMediaViewerOpen}
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {isGroupChat ? (
            <>
              <ContextMenuItem
                onClick={() => {
                  setSelectionMode(false)
                  setSelectedMessageIds(new Set())
                  setShowGroupInfoDialog(true)
                }}
              >
                <Info className="h-4 w-4" />
                <span>Info grup</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  setSelectionMode(true)
                  setSelectedMessageIds(new Set())
                }}
              >
                <CheckSquare className="h-4 w-4" />
                <span>Pilih pesan</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  if (onCloseChat) {
                    onCloseChat()
                  }
                }}
              >
                <X className="h-4 w-4" />
                <span>Tutup chat</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => setShowDeleteHistoryDialog(true)}
              >
                <Eraser className="h-4 w-4" />
                <span>Bersihkan chat</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setShowDeleteChatDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Hapus chat</span>
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem
                onClick={() => {
                  if (otherUserId && !isDeletedUser) {
                    handleHeaderClick()
                  }
                }}
                disabled={isDeletedUser}
              >
                <UserIcon className="h-4 w-4" />
                <span>Info kontak</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  setSelectionMode(true)
                  setSelectedMessageIds(new Set())
                }}
              >
                <CheckSquare className="h-4 w-4" />
                <span>Pilih pesan</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => {
                  if (onCloseChat) {
                    onCloseChat()
                  }
                }}
              >
                <X className="h-4 w-4" />
                <span>Tutup chat</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => setShowDeleteHistoryDialog(true)}
              >
                <Eraser className="h-4 w-4" />
                <span>Bersihkan chat</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setShowDeleteChatDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Hapus chat</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <Separator />
      <div className="message-composer absolute left-0 bottom-0">
        {selectionMode ? (
          /* Selection toolbar */
          <div className="flex items-center justify-between border-t py-3 bg-background shadow-sm">
            <div className="flex items-center gap-3 flex-1">
              <Button variant="ghost" size="icon" onClick={handleCancelSelection}>
                <X className="h-5 w-5" />
              </Button>
              <span className="text-sm font-medium">{selectedMessageIds.size} terpilih</span>
            </div>
            <div className="flex items-center gap-2 px-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (selectedMessageIds.size > 0) {
                    setShowForwardDialog(true)
                  }
                }}
                disabled={selectedMessageIds.size === 0}
                title="Forward messages"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenDeleteDialog}
                disabled={selectedMessageIds.size === 0}
                title="Delete messages"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
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
              <div ref={replyBarRef}>
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
              onSendImageGroup={(files, shouldCompress) => sendImageGroup(currentUserId, currentUserName, files, shouldCompress, currentUserAvatar)}
              onSendVideo={(file, shouldCompress) => sendVideo(currentUserId, currentUserName, file, shouldCompress, currentUserAvatar)}
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
              Semua pesan dalam chat ini akan dihapus dari perangkat Anda. Chat akan hilang dari daftar, namun akan muncul kembali jika ada pesan baru. User lain tetap dapat melihat semua pesan.
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
              Semua pesan dalam chat ini akan dihapus dari perangkat Anda. Chat tetap berada di daftar. User lain tetap dapat melihat semua pesan.
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
