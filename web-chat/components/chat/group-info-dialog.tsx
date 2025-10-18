'use client'

import { useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { User } from '@/types/models'
import { UserMinus, UserPlus, Camera, Users as UsersIcon, Loader2, Pencil, Search, X } from 'lucide-react'
import { ChatRepository } from '@/lib/repositories/chat.repository'
import { toast } from 'sonner'
import { UserRepository } from '@/lib/repositories/user.repository'
import { uploadGroupAvatar } from '@/lib/utils/storage.utils'
import { cn } from '@/lib/utils'

const chatRepository = new ChatRepository()
const userRepository = new UserRepository()

interface GroupInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
  groupName: string
  groupAvatar?: string
  groupMembers: User[]
  groupAdmins: string[]
  currentUserId: string
  onMembersUpdate: (members: User[]) => void
  onAvatarUpdate: (avatarUrl: string) => void
}

export function GroupInfoDialog({
  open,
  onOpenChange,
  chatId,
  groupName,
  groupAvatar,
  groupMembers,
  groupAdmins,
  currentUserId,
  onMembersUpdate,
  onAvatarUpdate,
}: GroupInfoDialogProps) {
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [addingMembers, setAddingMembers] = useState(false)

  const isCurrentUserAdmin = groupAdmins.includes(currentUserId)

  const handleKickMember = async (userId: string, userName: string) => {
    if (!isCurrentUserAdmin) {
      toast.error('Only admins can remove members')
      return
    }

    if (!confirm(`Remove ${userName} from this group?`)) {
      return
    }

    const result = await chatRepository.removeGroupMember(chatId, userId)
    if (result.status === 'success') {
      const updatedMembers = groupMembers.filter(m => m.userId !== userId)
      onMembersUpdate(updatedMembers)
      toast.success(`${userName} has been removed from the group`)
    } else {
      toast.error(`Failed to remove member: ${result.message}`)
    }
  }

  const loadAvailableUsers = async () => {
    setLoadingUsers(true)
    setSelectedUserIds(new Set())
    setSearchQuery('')
    const result = await userRepository.getUsers()
    if (result.status === 'success') {
      // Filter out users who are already members
      const memberIds = groupMembers.map(m => m.userId)
      const available = result.data.filter(u => !memberIds.includes(u.userId) && u.isActive)
      setAvailableUsers(available)
    }
    setLoadingUsers(false)
  }

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUserIds)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUserIds(newSelected)
  }

  const removeSelectedUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds)
    newSelected.delete(userId)
    setSelectedUserIds(newSelected)
  }

  const handleAddMembers = async () => {
    if (selectedUserIds.size === 0) return

    setAddingMembers(true)
    try {
      const promises = Array.from(selectedUserIds).map(async (userId) => {
        return await chatRepository.addGroupMember(chatId, userId, groupName, groupAvatar)
      })

      const results = await Promise.all(promises)
      const successCount = results.filter(r => r.status === 'success').length
      const failCount = results.filter(r => r.status === 'error').length

      // Fetch newly added users and update members list
      const successUserIds = Array.from(selectedUserIds).filter((_, index) => results[index].status === 'success')
      const userPromises = successUserIds.map(userId => userRepository.getUserById(userId))
      const userResults = await Promise.all(userPromises)
      const newUsers = userResults
        .filter(r => r.status === 'success')
        .map(r => r.data)

      onMembersUpdate([...groupMembers, ...newUsers])

      if (successCount > 0) {
        toast.success(`${successCount} ${successCount === 1 ? 'member' : 'members'} added to the group`)
      }
      if (failCount > 0) {
        toast.error(`Failed to add ${failCount} ${failCount === 1 ? 'member' : 'members'}`)
      }

      setShowAddMemberDialog(false)
      setSelectedUserIds(new Set())
    } catch (error) {
      console.error('Add members error:', error)
      toast.error('Failed to add members')
    } finally {
      setAddingMembers(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isCurrentUserAdmin) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setUploadingAvatar(true)

    try {
      // Upload to Firebase Storage
      const uploadResult = await uploadGroupAvatar(chatId, file)

      if (uploadResult.status === 'success') {
        const avatarUrl = uploadResult.data

        // Update group avatar in Firestore
        const updateResult = await chatRepository.updateGroupAvatar(chatId, avatarUrl)

        if (updateResult.status === 'success') {
          onAvatarUpdate(avatarUrl)
          toast.success('Group photo updated successfully')
        } else {
          toast.error(`Failed to update group photo: ${updateResult.message}`)
        }
      } else {
        toast.error(`Failed to upload image: ${uploadResult.message}`)
      }
    } catch (error: any) {
      toast.error('Failed to update group photo')
      console.error('Avatar update error:', error)
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 gap-0" side="right">
          <ScrollArea className="h-full w-full">
            <div className="flex flex-col min-h-full">
              {/* Group Photo Header */}
              <div className="relative w-full aspect-square max-h-[400px] bg-muted/50 flex items-center justify-center group">
                {groupAvatar ? (
                  <img
                    src={groupAvatar}
                    alt={groupName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UsersIcon className="h-24 w-24 text-muted-foreground" />
                )}

                {/* Upload overlay for admin */}
                {isCurrentUserAdmin && (
                  <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 cursor-pointer bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="rounded-full bg-background/90 p-3">
                      {uploadingAvatar ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      ) : (
                        <Camera className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-white">
                      {groupAvatar ? 'Change group photo' : 'Add group photo'}
                    </span>
                  </label>
                )}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={!isCurrentUserAdmin || uploadingAvatar}
                />
              </div>

              {/* Group Name and Info */}
              <div className="px-6 py-6 bg-background">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h2 className="text-xl font-medium flex-1">{groupName}</h2>
                  {isCurrentUserAdmin && (
                    <button
                      className="p-2 hover:bg-muted rounded-full transition-colors"
                      aria-label="Edit group name"
                    >
                      <Pencil className="h-5 w-5 text-primary" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Group · {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}
                </p>
              </div>

              <Separator />

              {/* Description Section */}
              <div className="px-6 py-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</h3>
                <p className="text-sm">
                  A group chat with {groupMembers.length} members.
                </p>
              </div>

              <Separator />

              {/* Created Section */}
              <div className="px-6 py-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</h3>
                <p className="text-sm">Group chat</p>
              </div>

              <Separator />

              {/* Members Section */}
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {groupMembers.length} {groupMembers.length === 1 ? 'Member' : 'Members'}
                  </h3>
                  {isCurrentUserAdmin && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowAddMemberDialog(true)
                        loadAvailableUsers()
                      }}
                      className="gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  {groupMembers.map((member) => {
                    const isAdmin = groupAdmins.includes(member.userId)
                    const canKick = isCurrentUserAdmin && member.userId !== currentUserId
                    const isCurrentUser = member.userId === currentUserId
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.imageURL || member.imageUrl} alt="" />
                          <AvatarFallback className="text-sm font-semibold">
                            {member.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="flex items-baseline gap-1 flex-1 min-w-0">
                              <span className="text-sm font-medium truncate">
                                {member.displayName}
                              </span>
                              {isCurrentUser && (
                                <span className="text-sm text-muted-foreground font-normal shrink-0">(You)</span>
                              )}
                            </div>
                            {isAdmin && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium shrink-0">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                        {canKick && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleKickMember(member.userId, member.displayName)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            aria-label={`Remove ${member.displayName}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="sm:max-w-md p-0">
          <div className="flex flex-col h-[600px]">
            {/* Header */}
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Add Members to "{groupName}"</h2>
            </div>

            {/* Selected Members */}
            {selectedUserIds.size > 0 && (
              <div className="px-6 py-3 border-b bg-muted/30">
                <p className="text-sm font-medium mb-2">Selected Members ({selectedUserIds.size})</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedUserIds).map((userId) => {
                    const user = availableUsers.find(u => u.userId === userId)
                    if (!user) return null
                    return (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="gap-1 pl-2 pr-1 py-1"
                      >
                        <span className="text-xs">{user.displayName}</span>
                        <button
                          onClick={() => removeSelectedUser(userId)}
                          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="px-6 py-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Users"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* User List */}
            <ScrollArea className="flex-1">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">No users available to add</p>
                </div>
              ) : (
                <div className="px-4 py-2">
                  {availableUsers
                    .filter(user => {
                      if (!searchQuery) return true
                      const q = searchQuery.toLowerCase()
                      return (
                        user.displayName.toLowerCase().includes(q) ||
                        user.email.toLowerCase().includes(q)
                      )
                    })
                    .map((user) => {
                      const isSelected = selectedUserIds.has(user.userId)
                      return (
                        <button
                          key={user.userId}
                          onClick={() => toggleUserSelection(user.userId)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-muted"
                          )}
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={user.imageURL || user.imageUrl} alt="" />
                            <AvatarFallback className="text-xs">
                              {user.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium truncate">{user.displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">@{user.email.split('@')[0]}</p>
                          </div>
                          {isSelected && (
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>
                      )
                    })}
                </div>
              )}
            </ScrollArea>

            {/* Footer - Add Button */}
            {selectedUserIds.size > 0 && (
              <div className="px-6 py-4 border-t flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedUserIds.size} {selectedUserIds.size === 1 ? 'member' : 'members'} selected
                </p>
                <Button
                  onClick={handleAddMembers}
                  disabled={addingMembers}
                  className="gap-2"
                >
                  {addingMembers ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Add Members
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
