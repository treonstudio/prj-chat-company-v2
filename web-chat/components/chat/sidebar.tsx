"use client"

import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useMemo, useState, useEffect } from "react"
import { useChatList } from "@/lib/hooks/use-chat-list"
import { useAuth } from "@/lib/contexts/auth.context"
import { useFeatureFlags } from "@/lib/contexts/feature-flags.context"
import { formatDistanceToNow } from "date-fns"
import { NewChatDialog } from "./new-chat-dialog"
import { GroupChatDialog } from "./group-chat-dialog"
import { ProfileView } from "./profile-view"
import { MessageSquarePlus } from "lucide-react"
import { User } from "@/types/models"

export function Sidebar({
  currentUserId,
  currentUserName,
  currentUserData,
  onChatSelect,
}: {
  currentUserId: string
  currentUserName: string
  currentUserData: User
  onChatSelect: (chatId: string, isGroup: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showGroupChatDialog, setShowGroupChatDialog] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const { signOut } = useAuth()
  const { chats, loading, error } = useChatList(currentUserId)
  const { featureFlags } = useFeatureFlags()

  const handleChatClick = (chatId: string, isGroup: boolean) => {
    setActiveId(chatId)
    onChatSelect(chatId, isGroup)
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return chats.filter((c) => {
      const name = c.chatType === 'GROUP' ? c.groupName : c.otherUserName
      return name?.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
    })
  }, [chats, query])

  const handleLogout = async () => {
    await signOut()
  }

  const handleChatCreated = (chatId: string, isGroup: boolean) => {
    setActiveId(chatId)
    onChatSelect(chatId, isGroup)
  }

  return (
    <div className="flex h-full min-h-0 flex-col relative overflow-hidden">
      {/* Main Sidebar Content */}
      <div
        className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
          showProfile ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className="flex h-full min-h-0 flex-col">
      {/* Sticky header: user info + search */}
      <div className="sticky top-0 z-10 bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            className="flex items-center gap-3 hover:bg-muted rounded-lg px-2 py-1 -ml-2 transition-colors"
            onClick={() => setShowProfile(true)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={currentUserData.avatarUrl || "/placeholder-user.jpg"} alt="" />
              <AvatarFallback aria-hidden>{currentUserName?.slice(0, 2).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{currentUserName || 'User'}</p>
              <p className="truncate text-xs text-muted-foreground">Online</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {featureFlags.allowChat && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="New chat"
                onClick={() => setShowNewChatDialog(true)}
              >
                <MessageSquarePlus className="h-5 w-5" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open user menu">
                  <span aria-hidden className="text-xl leading-none">
                    {"⋯"}
                  </span>
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
                <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="px-4 pb-3">
          <Input
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-white text-foreground placeholder:text-muted-foreground"
            aria-label="Search chats"
          />
        </div>
        <Separator />
      </div>

      {/* Chats list */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <p className="text-sm text-muted-foreground">Loading chats...</p>
          </div>
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
              const name = c.chatType === 'GROUP' ? c.groupName : c.otherUserName
              const avatar = c.chatType === 'GROUP' ? c.groupAvatar : c.otherUserAvatar
              const isGroup = c.chatType === 'GROUP'
              const timeAgo = formatDistanceToNow(c.lastMessageTime.toDate(), { addSuffix: true })

              return (
                <li key={c.chatId}>
                  <button
                    onClick={() => handleChatClick(c.chatId, isGroup)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors",
                      activeId === c.chatId ? "bg-accent" : "hover:bg-muted",
                    )}
                    aria-current={activeId === c.chatId ? "page" : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={avatar || "/placeholder-user.jpg"} alt="" />
                        <AvatarFallback aria-hidden>{name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <p className="truncate text-sm font-semibold flex-1 leading-tight">{name}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap leading-tight">{timeAgo.replace('about ', '')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="truncate text-xs text-muted-foreground flex-1 line-clamp-1 leading-tight">{c.lastMessage}</p>
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
