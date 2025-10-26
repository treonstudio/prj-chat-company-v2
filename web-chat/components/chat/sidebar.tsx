"use client"

import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect, memo } from "react"
import { useChatList } from "@/lib/hooks/use-chat-list"
import { useAuth } from "@/lib/contexts/auth.context"
import { useFeatureFlags } from "@/lib/contexts/feature-flags.context"
import { formatChatListTimestamp } from "@/lib/utils/timestamp-formatter"
import { NewChatDialog } from "./new-chat-dialog"
import { GroupChatDialog } from "./group-chat-dialog"
import { ProfileView } from "./profile-view"
import { MessageSquarePlus, Users, TriangleAlert, RefreshCw } from "lucide-react"
import { User } from "@/types/models"
import { useOnlineStatus } from "@/lib/hooks/use-online-status"
import { getDraftMessage } from "@/lib/hooks/use-draft-message"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"

export function Sidebar({
  currentUserId,
  currentUserName,
  currentUserData,
  selectedChatId,
  onChatSelect,
}: {
  currentUserId: string
  currentUserName: string
  currentUserData: User
  selectedChatId?: string | null
  onChatSelect: (chatId: string, isGroup: boolean, chatName?: string, chatAvatar?: string) => void
}) {
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showGroupChatDialog, setShowGroupChatDialog] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [avatarCacheKey, setAvatarCacheKey] = useState(Date.now())
  const { signOut } = useAuth()
  const { chats, loading, error } = useChatList(currentUserId)
  const { featureFlags } = useFeatureFlags()
  const { isOnline, isSlow } = useOnlineStatus()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [groupAvatars, setGroupAvatars] = useState<Record<string, string>>({})

  // Fetch missing group avatars from groupChats collection
  useEffect(() => {
    const fetchMissingGroupAvatars = async () => {
      const groupChatsWithoutAvatar = chats.filter(
        (chat) => chat.chatType === 'GROUP' && !chat.groupAvatar && !groupAvatars[chat.chatId]
      )

      if (groupChatsWithoutAvatar.length === 0) return

      const newAvatars: Record<string, string> = {}

      for (const chat of groupChatsWithoutAvatar) {
        try {
          const groupChatRef = doc(db(), 'groupChats', chat.chatId)
          const groupChatDoc = await getDoc(groupChatRef)

          if (groupChatDoc.exists()) {
            const groupData = groupChatDoc.data()
            const avatar = groupData?.imageURL || groupData?.avatarUrl || groupData?.avatar

            if (avatar) {
              newAvatars[chat.chatId] = avatar
            }
          }
        } catch (error) {
          console.error(`Error fetching avatar for group ${chat.chatId}:`, error)
        }
      }

      if (Object.keys(newAvatars).length > 0) {
        setGroupAvatars(prev => ({ ...prev, ...newAvatars }))
      }
    }

    fetchMissingGroupAvatars()
  }, [chats])

  // Sync activeId with selectedChatId from parent
  useEffect(() => {
    if (selectedChatId) {
      setActiveId(selectedChatId)
    }
  }, [selectedChatId])

  // Update cache key when avatar URL changes to force image reload
  useEffect(() => {
    if (currentUserData?.imageURL || currentUserData?.imageUrl) {
      setAvatarCacheKey(Date.now())
    }
  }, [currentUserData?.imageURL, currentUserData?.imageUrl])

  // Load drafts for all chats
  useEffect(() => {
    const loadDrafts = () => {
      const draftMap: Record<string, string> = {}
      chats.forEach((chat) => {
        const draft = getDraftMessage(chat.chatId)
        if (draft) {
          draftMap[chat.chatId] = draft
        }
      })

      // Only update state if drafts actually changed (prevent unnecessary re-renders)
      setDrafts(prev => {
        const hasChanges = Object.keys(draftMap).length !== Object.keys(prev).length ||
          Object.keys(draftMap).some(key => draftMap[key] !== prev[key])

        return hasChanges ? draftMap : prev
      })
    }

    loadDrafts()

    // CRITICAL: Use much longer interval to reduce re-renders (10 seconds instead of 1 second)
    // This prevents glitch/flicker when uploading files
    const interval = setInterval(loadDrafts, 10000)
    return () => clearInterval(interval)
  }, [chats])

  const handleChatClick = (chatId: string, isGroup: boolean, chatName?: string, chatAvatar?: string) => {
    setActiveId(chatId)
    onChatSelect(chatId, isGroup, chatName, chatAvatar)
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return chats.filter((c) => {
      const name = c.chatType === 'GROUP' ? c.groupName : c.otherUserName
      return name?.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
    })
  }, [chats, query])

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0)
  }, [chats])

  // Update document title with unread count
  useEffect(() => {
    if (totalUnreadCount > 0) {
      document.title = `(${totalUnreadCount}) Chatku Web`
    } else {
      document.title = 'Chatku Web'
    }
  }, [totalUnreadCount])

  const handleLogout = async () => {
    await signOut()
  }

  const handleChatCreated = (chatId: string, isGroup: boolean) => {
    setActiveId(chatId)
    onChatSelect(chatId, isGroup)
  }

  // Get avatar URL with cache busting to ensure fresh image loads
  const currentUserAvatarUrl = currentUserData.imageURL || currentUserData.imageUrl
    ? `${currentUserData.imageURL || currentUserData.imageUrl}?t=${avatarCacheKey}`
    : "/placeholder-user.jpg"

  return (
    <div className="flex h-full min-h-0 flex-col relative overflow-hidden" style={{ backgroundColor: '#fafafa' }}>
      {/* Main Sidebar Content */}
      <div
        className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
          showProfile ? '-translate-x-full' : 'translate-x-0'
        }`}
        style={{ backgroundColor: '#fafafa' }}
      >
        <div className="flex h-full min-h-0 flex-col">
      {/* Sticky header: user info + search */}
      <div className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: '#fafafa' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            className="flex items-center gap-3 hover:bg-muted rounded-lg px-2 py-1 -ml-2 transition-colors"
            onClick={() => setShowProfile(true)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={currentUserAvatarUrl} alt="" />
              <AvatarFallback aria-hidden>{currentUserName?.slice(0, 2).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-medium text-left">{currentUserName || 'User'}</p>
              <p className="truncate text-xs text-muted-foreground text-left">{currentUserData.username || currentUserData.userId || ''}</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {(featureFlags.allowChat || featureFlags.allowCreateGroup) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="New chat menu"
                  >
                    <MessageSquarePlus className="h-10 w-10" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-40">
                  {featureFlags.allowChat && (
                    <DropdownMenuItem onSelect={() => setShowNewChatDialog(true)}>
                      New Chat
                    </DropdownMenuItem>
                  )}
                  {featureFlags.allowCreateGroup && (
                    <DropdownMenuItem onSelect={() => setShowGroupChatDialog(true)}>
                      New Group
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="px-4 pb-3">
          <Input
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-white text-foreground placeholder:text-muted-foreground"
            aria-label="Search chats"
            autoComplete="off"
          />
        </div>
        <Separator />

        {/* Offline/Slow Connection Banner */}
        {(!isOnline || isSlow) && (
          <div className="px-4 py-3 bg-[#FFF4CE] border-b border-[#E8D8A3]">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <TriangleAlert className="h-5 w-5 text-[#8B7000]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[#3B3B3B] mb-0.5">
                  {!isOnline ? 'Komputer tidak terhubung' : 'Koneksi lambat'}
                </h3>
                <p className="text-xs text-[#54656F] leading-relaxed">
                  {!isOnline
                    ? 'Pastikan komputer Anda memiliki koneksi Internet aktif.'
                    : 'Koneksi Internet Anda tampaknya lambat. Pesan mungkin terlambat terkirim.'}
                </p>
                {!isOnline && (
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#00A884] hover:text-[#008F72] transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Hubungkan ulang</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chats list */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <ul className="divide-y">
            {/* Chat list skeleton loader */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-muted animate-pulse" />
                  <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="flex items-center justify-center p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <p className="text-sm text-muted-foreground">
              {query ? 'No chats found' : 'No chats yet'}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((c) => {
              // Handle deleted user
              const rawName = c.chatType === 'GROUP' ? c.groupName : c.otherUserName
              const name = rawName && rawName.trim() !== '' ? rawName : 'Deleted User'
              const isDeletedUser = name === 'Deleted User' && c.chatType !== 'GROUP'
              const avatar = c.chatType === 'GROUP'
                ? (c.groupAvatar || groupAvatars[c.chatId])
                : (isDeletedUser ? undefined : c.otherUserAvatar) // undefined will show fallback icon
              const isGroup = c.chatType === 'GROUP'
              const timeAgo = formatChatListTimestamp(c.lastMessageTime)

              // Truncate chat name with ellipsis (max 25 chars)
              const truncatedName = name.length > 25
                ? name.slice(0, 25) + '...'
                : name

              // Check if there's a draft for this chat
              const draftText = drafts[c.chatId]
              const hasDraft = !!draftText

              // Use draft message if available, otherwise use last message
              const displayMessage = hasDraft ? draftText : c.lastMessage

              // Truncate long messages with ellipsis (max 35 chars)
              const truncatedMessage = displayMessage.length > 35
                ? displayMessage.slice(0, 35) + '...'
                : displayMessage

              return (
                <li key={c.chatId}>
                  <button
                    onClick={() => handleChatClick(c.chatId, isGroup, name, avatar || undefined)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors",
                      activeId === c.chatId ? "bg-accent" : "hover:bg-muted",
                    )}
                    aria-current={activeId === c.chatId ? "page" : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={avatar || "/placeholder-user.jpg"} alt="" />
                        <AvatarFallback aria-hidden className={cn(
                          isGroup ? "bg-muted border border-border flex items-center justify-center" : "",
                          isDeletedUser ? "bg-red-100 text-red-600" : ""
                        )}>
                          {isGroup ? (
                            <Users className="h-5 w-5 text-muted-foreground" />
                          ) : isDeletedUser ? (
                            'DU'
                          ) : (
                            name?.slice(0, 2).toUpperCase()
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <p className="truncate text-sm font-semibold flex-1 leading-tight">{truncatedName}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap leading-tight">{timeAgo}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-xs text-muted-foreground flex-1 leading-tight overflow-hidden text-ellipsis whitespace-nowrap break-all line-clamp-1">
                            {hasDraft && (
                              <span className="text-green-600 font-medium">Draft: </span>
                            )}
                            {truncatedMessage}
                          </p>
                          {c.unreadCount > 0 ? (
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shrink-0">
                              {c.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>

      {/* Dialogs */}
      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onChatCreated={handleChatCreated}
      />

      <GroupChatDialog
        open={showGroupChatDialog}
        onOpenChange={setShowGroupChatDialog}
        currentUserId={currentUserId}
        onGroupCreated={handleChatCreated}
      />
        </div>
      </div>

      {/* Profile View with Slide Animation */}
      <div
        className={`absolute inset-0 bg-card transition-transform duration-300 ease-in-out ${
          showProfile ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <ProfileView
          user={currentUserData}
          onBack={() => setShowProfile(false)}
          onLogout={handleLogout}
        />
      </div>
    </div>
  )
}
