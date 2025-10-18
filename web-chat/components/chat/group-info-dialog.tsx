'use client'

import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { User } from '@/types/models'
import { UserMinus, UserPlus, Camera, Users as UsersIcon, Loader2 } from 'lucide-react'
import { ChatRepository } from '@/lib/repositories/chat.repository'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserRepository } from '@/lib/repositories/user.repository'
import { uploadGroupAvatar } from '@/lib/utils/storage.utils'

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
  const [activeTab, setActiveTab] = useState('info')
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

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
    const result = await userRepository.getUsers()
    if (result.status === 'success') {
      // Filter out users who are already members
      const memberIds = groupMembers.map(m => m.userId)
      const available = result.data.filter(u => !memberIds.includes(u.userId) && u.isActive)
      setAvailableUsers(available)
    }
    setLoadingUsers(false)
  }

  const handleAddMember = async (userId: string, userName: string) => {
    const result = await chatRepository.addGroupMember(chatId, userId, groupName, groupAvatar)
    if (result.status === 'success') {
      // Fetch the user data and add to members list
      const userResult = await userRepository.getUserById(userId)
      if (userResult.status === 'success') {
        onMembersUpdate([...groupMembers, userResult.data])
      }
      toast.success(`${userName} has been added to the group`)
      setShowAddMemberDialog(false)
    } else {
      toast.error(`Failed to add member: ${result.message}`)
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-6 pt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Group Info</TabsTrigger>
                <TabsTrigger value="members">
                  Members ({groupMembers.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="info" className="mt-0 space-y-4 px-6 pb-6">
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                    <AvatarImage src={groupAvatar || '/placeholder-user.jpg'} alt="" />
                    <AvatarFallback className="text-3xl">
                      <UsersIcon className="h-16 w-16 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  {isCurrentUserAdmin && (
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-primary p-2 text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Camera className="h-5 w-5" />
                      )}
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
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{groupName}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Group · {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">DESCRIPTION</h3>
                <p className="text-sm">
                  A group chat with {groupMembers.length} members.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">CREATED</h3>
                <p className="text-sm">Group chat</p>
              </div>
            </TabsContent>

            <TabsContent value="members" className="mt-0 px-6 pb-6">
              <div className="space-y-4 pt-4">
                {isCurrentUserAdmin && (
                  <Button
                    onClick={() => {
                      setShowAddMemberDialog(true)
                      loadAvailableUsers()
                    }}
                    className="w-full gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Member
                  </Button>
                )}

                <Separator />

                <ScrollArea className="max-h-[400px] pr-4">
                  <div className="space-y-2">
                    {groupMembers.map((member) => {
                      const isAdmin = groupAdmins.includes(member.userId)
                      const canKick = isCurrentUserAdmin && member.userId !== currentUserId
                      const isCurrentUser = member.userId === currentUserId
                      return (
                        <div
                          key={member.userId}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                            <AvatarImage src={member.imageURL || member.imageUrl} alt="" />
                            <AvatarFallback className="text-sm font-semibold">
                              {member.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold truncate">
                                {member.displayName}
                                {isCurrentUser && (
                                  <span className="text-muted-foreground font-normal"> (You)</span>
                                )}
                              </p>
                              {isAdmin && (
                                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium">
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
                              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                              aria-label={`Remove ${member.displayName}`}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Add Member</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select a user to add to the group
              </p>
            </div>
            <Separator />
            <ScrollArea className="max-h-[400px] pr-4">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">No users available to add</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map((user) => (
                    <button
                      key={user.userId}
                      onClick={() => handleAddMember(user.userId, user.displayName)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.imageURL || user.imageUrl} alt="" />
                        <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
