"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserRepository } from "@/lib/repositories/user.repository"
import { ChatRepository } from "@/lib/repositories/chat.repository"
import { User } from "@/types/models"
import { Search, Loader2, X, Check, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const userRepository = new UserRepository()
const chatRepository = new ChatRepository()

interface GroupChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  onGroupCreated: (chatId: string, isGroup: boolean) => void
}

export function GroupChatDialog({
  open,
  onOpenChange,
  currentUserId,
  onGroupCreated,
}: GroupChatDialogProps) {
  const [step, setStep] = useState<"name" | "members">("name")
  const [groupName, setGroupName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setStep("name")
      setGroupName("")
      setSearchQuery("")
      setUsers([])
      setSelectedUsers([])
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (step !== "members") return

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
  }, [searchQuery, currentUserId, step])

  const handleNext = () => {
    if (step === "name" && groupName.trim()) {
      setStep("members")
    }
  }

  const handleBack = () => {
    if (step === "members") {
      setStep("name")
    }
  }

  const toggleUserSelection = (user: User) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.userId === user.userId)
      if (isSelected) {
        return prev.filter((u) => u.userId !== user.userId)
      } else {
        return [...prev, user]
      }
    })
  }

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.userId !== userId))
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      setError("Please add at least one member")
      return
    }

    setCreating(true)
    setError(null)

    const memberIds = selectedUsers.map((u) => u.userId)

    const result = await chatRepository.createGroupChat(
      groupName.trim(),
      currentUserId,
      memberIds
    )

    setCreating(false)

    if (result.status === 'success') {
      onGroupCreated(result.data.chatId, true)
      onOpenChange(false)
    } else if (result.status === 'error') {
      setError(result.message || "Failed to create group")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === "name" ? "New Group" : `Add Members to "${groupName}"`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === "name" ? (
            <>
              {/* Group Name Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Group Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter group name..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="pl-9"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && groupName.trim()) {
                        handleNext()
                      }
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Selected Members */}
              {selectedUsers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Selected Members ({selectedUsers.length})
                  </label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-muted/30">
                    {selectedUsers.map((user) => (
                      <div
                        key={user.userId}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs"
                      >
                        <span>{user.displayName}</span>
                        <button
                          onClick={() => removeSelectedUser(user.userId)}
                          className="hover:bg-primary-foreground/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Users</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    autoFocus
                    disabled={creating}
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-sm text-destructive text-center py-2">
                  {error}
                </div>
              )}

              {/* User List */}
              <ScrollArea className="h-[300px] pr-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {searchQuery.trim()
                        ? "No users found"
                        : "Search for users to add to the group"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {users.map((user) => {
                      const isSelected = selectedUsers.some(
                        (u) => u.userId === user.userId
                      )
                      return (
                        <button
                          key={user.userId}
                          onClick={() => toggleUserSelection(user)}
                          disabled={creating}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                            isSelected
                              ? "bg-primary/10 hover:bg-primary/20"
                              : "hover:bg-muted"
                          )}
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage
                              src={user.avatarUrl || "/placeholder-user.jpg"}
                              alt=""
                            />
                            <AvatarFallback>
                              {user.displayName?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-medium truncate">
                              {user.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              @{user.email.split('@')[0]}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground"
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "members" && (
            <Button variant="outline" onClick={handleBack} disabled={creating}>
              Back
            </Button>
          )}
          {step === "name" ? (
            <Button onClick={handleNext} disabled={!groupName.trim()}>
              Next
            </Button>
          ) : (
            <Button
              onClick={handleCreateGroup}
              disabled={creating || selectedUsers.length === 0}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                `Create Group (${selectedUsers.length})`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
