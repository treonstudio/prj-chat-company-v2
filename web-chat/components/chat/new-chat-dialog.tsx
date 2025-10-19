"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserRepository } from "@/lib/repositories/user.repository"
import { ChatRepository } from "@/lib/repositories/chat.repository"
import { User } from "@/types/models"
import { Search, Loader2 } from "lucide-react"

const userRepository = new UserRepository()
const chatRepository = new ChatRepository()

interface NewChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  currentUserName: string
  onChatCreated: (chatId: string, isGroup: boolean) => void
}

export function NewChatDialog({
  open,
  onOpenChange,
  currentUserId,
  currentUserName,
  onChatCreated,
}: NewChatDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSearchQuery("")
      setUsers([])
      setError(null)
      return
    }
  }, [open])

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setUsers([])
        return
      }

      setLoading(true)
      setError(null)

      const result = await userRepository.searchUsers(searchQuery, currentUserId)

      if (result.status === 'success') {
        setUsers(result.data)
      } else if (result.status === 'error') {
        setError(result.message || "Failed to search users")
        setUsers([])
      }

      setLoading(false)
    }

    const debounceTimer = setTimeout(() => {
      searchUsers()
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, currentUserId])

  const handleUserClick = async (user: User) => {
    setCreatingUserId(user.userId)
    setError(null)

    const result = await chatRepository.startDirectChat(
      currentUserId,
      currentUserName,
      user.userId,
      user.displayName,
      user.imageURL || user.imageUrl
    )

    setCreatingUserId(null)

    if (result.status === 'success') {
      onChatCreated(result.data, false)
      onOpenChange(false)
    } else if (result.status === 'error') {
      setError(result.message || "Failed to start chat")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
              disabled={creatingUserId !== null}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive text-center py-2">
              {error}
            </div>
          )}

          {/* User List */}
          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {searchQuery.trim()
                    ? "No users found"
                    : "Search for users to start a conversation"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {users.map((user) => (
                  <button
                    key={user.userId}
                    onClick={() => handleUserClick(user)}
                    disabled={creatingUserId !== null}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={user.imageURL || user.imageUrl || "/placeholder-user.jpg"} alt="" />
                      <AvatarFallback>{user.displayName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.username || user.email?.split('@')[0] || 'Unknown'}
                      </p>
                    </div>
                    {creatingUserId === user.userId && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
