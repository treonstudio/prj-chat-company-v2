'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { User } from '@/types/models'
import { UserMinus, UserPlus, Camera, Users as UsersIcon, Loader2, Pencil, Search, X, LogOut, ChevronDown, UserCog, ZoomIn, ZoomOut } from 'lucide-react'
import { ChatRepository } from '@/lib/repositories/chat.repository'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { useCallback } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserRepository } from '@/lib/repositories/user.repository'
import { uploadGroupAvatar } from '@/lib/utils/storage.utils'
import { cn } from '@/lib/utils'
import { DialogTitle } from '@/components/ui/dialog'
import { SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { UserProfileDialog } from './user-profile-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const chatRepository = new ChatRepository()
const userRepository = new UserRepository()

// Max participants that can be added per action (unlimited by default)
const MAX_PARTICIPANTS_PER_ACTION = parseInt(process.env.NEXT_PUBLIC_MAX_PARTICIPANTS_PER_ACTION || '999')

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
  onNameUpdate?: (newName: string) => void
  onLeaveGroup?: () => void
  onAdminsUpdate?: (admins: string[]) => void
  onChatSelect?: (chatId: string, isGroupChat: boolean) => void
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
  onNameUpdate,
  onLeaveGroup,
  onAdminsUpdate,
  onChatSelect,
}: GroupInfoDialogProps) {
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [addingMembers, setAddingMembers] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; userName: string } | null>(null)
  const [removingMember, setRemovingMember] = useState(false)
  const [showEditNameDialog, setShowEditNameDialog] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [updatingName, setUpdatingName] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<User | null>(null)

  // Image cropper states
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  // Group metadata states
  const [createdAt, setCreatedAt] = useState<Date | null>(null)
  const [createdBy, setCreatedBy] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState<string | null>(null)

  const isCurrentUserAdmin = groupAdmins.includes(currentUserId)

  // Helper function to convert timestamp to Date
  const timestampToDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    return null;
  }

  // Listen to group metadata and participants in real-time
  useEffect(() => {
    if (!open || !chatId) return;

    const unsubscribe = chatRepository.listenToGroupChat(
      chatId,
      async (groupData) => {
        // Set createdAt
        if (groupData.createdAt) {
          setCreatedAt(timestampToDate(groupData.createdAt));
        }

        // Set createdBy and fetch creator name
        if (groupData.createdBy) {
          setCreatedBy(groupData.createdBy);

          // Fetch creator user data
          const creatorResult = await userRepository.getUserById(groupData.createdBy);
          if (creatorResult.status === 'success') {
            setCreatorName(creatorResult.data.displayName);
          }
        }

        // Update participants in real-time
        if (groupData.participants) {
          // Fetch full user data for all participants
          const participantPromises = groupData.participants.map(userId =>
            userRepository.getUserById(userId)
          );
          const participantResults = await Promise.all(participantPromises);
          const updatedMembers = participantResults
            .filter(r => r.status === 'success')
            .map(r => r.data);

          onMembersUpdate(updatedMembers);
        }

        // Update admins in real-time
        if (groupData.admins && onAdminsUpdate) {
          onAdminsUpdate(groupData.admins);
        }
      },
      (error) => {
        console.error('Error listening to group metadata:', error);
      }
    );

    // Cleanup listener on unmount or when dialog closes
    return () => {
      unsubscribe();
    };
  }, [open, chatId]);

  const handleKickMember = async (userId: string, userName: string) => {
    if (!isCurrentUserAdmin) {
      toast.error('Hanya admin yang dapat menghapus anggota')
      return
    }

    setMemberToRemove({ userId, userName })
    setShowRemoveDialog(true)
  }

  const handlePromoteToAdmin = async (userId: string, userName: string) => {
    if (!isCurrentUserAdmin) {
      toast.error('Hanya admin yang dapat menambahkan admin baru')
      return
    }

    const result = await chatRepository.promoteToAdmin(chatId, userId)

    if (result.status === 'success') {
      toast.success(`${userName} sekarang menjadi admin`)
      // Update parent state with new admin
      if (onAdminsUpdate) {
        onAdminsUpdate([...groupAdmins, userId])
      }
    } else if (result.status === 'error') {
      toast.error(result.message || 'Gagal menjadikan admin')
    }
  }

  const handleDemoteFromAdmin = async (userId: string, userName: string) => {
    if (!isCurrentUserAdmin) {
      toast.error('Hanya admin yang dapat menghapus admin')
      return
    }

    const result = await chatRepository.demoteFromAdmin(chatId, userId)

    if (result.status === 'success') {
      toast.success(`${userName} bukan lagi admin`)
      // Update parent state by removing admin
      if (onAdminsUpdate) {
        onAdminsUpdate(groupAdmins.filter(id => id !== userId))
      }
    } else if (result.status === 'error') {
      toast.error(result.message || 'Gagal menghapus admin')
    }
  }

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return

    // Get current user name for system message
    const currentUser = groupMembers.find(m => m.userId === currentUserId)
    const adminName = currentUser?.displayName || 'Admin'

    setRemovingMember(true)
    const result = await chatRepository.removeGroupMember(
      chatId,
      currentUserId,
      adminName,
      memberToRemove.userId
    )
    setRemovingMember(false)

    if (result.status === 'success') {
      const updatedMembers = groupMembers.filter(m => m.userId !== memberToRemove.userId)
      onMembersUpdate(updatedMembers)
      toast.success('Anggota berhasil dikeluarkan dari grup')
      setShowRemoveDialog(false)
      setMemberToRemove(null)
    } else if (result.status === 'error') {
      toast.error(`Gagal mengeluarkan anggota: ${result.message}`)
    }
  }

  const handleEditName = () => {
    setEditingName(groupName)
    setShowEditNameDialog(true)
  }

  const handleUpdateGroupName = async () => {
    if (!editingName.trim() || editingName.trim() === groupName) {
      setShowEditNameDialog(false)
      return
    }

    setUpdatingName(true)
    const result = await chatRepository.updateGroupName(chatId, editingName.trim())
    setUpdatingName(false)

    if (result.status === 'success') {
      toast.success('Nama grup berhasil diubah')
      setShowEditNameDialog(false)
      if (onNameUpdate) {
        onNameUpdate(editingName.trim())
      }
    } else if (result.status === 'error') {
      toast.error(`Gagal mengubah nama grup: ${result.message}`)
    }
  }

  const handleLeaveGroup = () => {
    setShowLeaveDialog(true)
  }

  const confirmLeaveGroup = async () => {
    // Get current user name
    const currentUser = groupMembers.find(m => m.userId === currentUserId)
    const userName = currentUser?.displayName || 'User'

    setLeaving(true)
    const result = await chatRepository.leaveGroupChat(currentUserId, chatId, userName)
    setLeaving(false)

    if (result.status === 'success') {
      toast.success('Anda telah keluar dari grup')
      setShowLeaveDialog(false)
      onOpenChange(false)
      if (onLeaveGroup) {
        onLeaveGroup()
      }
    } else if (result.status === 'error') {
      toast.error(`Gagal keluar dari grup: ${result.message}`)
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
      // Check if selecting this user would exceed the max participants per action
      if (newSelected.size >= MAX_PARTICIPANTS_PER_ACTION) {
        toast.error(
          `Maksimal ${MAX_PARTICIPANTS_PER_ACTION} peserta dapat dipilih sekaligus`,
          { duration: 3000 }
        )
        return
      }
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

    // Validate max participants per action
    if (selectedUserIds.size > MAX_PARTICIPANTS_PER_ACTION) {
      toast.error(
        `Maksimal ${MAX_PARTICIPANTS_PER_ACTION} peserta dapat ditambahkan sekaligus`,
        { duration: 3000 }
      )
      return
    }

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
        toast.success(`${successCount} anggota berhasil ditambahkan ke grup`)
      }
      if (failCount > 0) {
        toast.error(`Gagal menambahkan ${failCount} anggota`)
      }

      setShowAddMemberDialog(false)
      setSelectedUserIds(new Set())
    } catch (error) {
      console.error('Add members error:', error)
      toast.error('Gagal menambahkan anggota')
    } finally {
      setAddingMembers(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isCurrentUserAdmin) return

    if (!file.type.startsWith('image/')) {
      toast.error('Harap pilih file gambar')
      return
    }

    // Read file and show cropper
    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage(reader.result as string)
      setShowCropper(true)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)

    // Reset input
    e.target.value = ''
  }

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createCroppedImage = async () => {
    if (!selectedImage || !croppedAreaPixels) return

    try {
      const image = new Image()
      image.src = selectedImage

      await new Promise((resolve) => {
        image.onload = resolve
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = croppedAreaPixels.width
      canvas.height = croppedAreaPixels.height

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      )

      canvas.toBlob(async (blob) => {
        if (!blob) return

        setShowCropper(false)
        setUploadingAvatar(true)

        try {
          // Create File from blob
          const file = new File([blob], 'group-avatar.jpg', { type: 'image/jpeg' })

          const uploadResult = await uploadGroupAvatar(chatId, file)

          if (uploadResult.status === 'success') {
            const avatarUrl = uploadResult.data

            // Update group avatar in Firestore
            const updateResult = await chatRepository.updateGroupAvatar(chatId, avatarUrl)

            if (updateResult.status === 'success') {
              onAvatarUpdate(avatarUrl)
              toast.success('Foto grup berhasil diubah')
            } else if (updateResult.status === 'error') {
              toast.error(`Gagal mengubah foto grup: ${updateResult.message}`)
            }
          } else {
            const errorMsg = uploadResult.status === 'error' ? uploadResult.message : 'Unknown error';
            toast.error(`Gagal mengunggah gambar: ${errorMsg}`)
          }
        } catch (error: any) {
          toast.error('Gagal mengubah foto grup')
          console.error('Avatar update error:', error)
        } finally {
          setUploadingAvatar(false)
        }
      }, 'image/jpeg', 0.95)
    } catch (error) {
      console.error('Error cropping image:', error)
      toast.error('Gagal memotong gambar')
    }
  }

  // Handle send message to user from profile dialog
  const handleSendMessageToUser = async () => {
    if (!selectedUserForProfile || !onChatSelect) return

    setShowUserProfile(false)

    // Create or get direct chat with selected user
    const result = await chatRepository.getOrCreateDirectChat(currentUserId, selectedUserForProfile.userId)
    if (result.status === 'success') {
      // Close group info dialog
      onOpenChange(false)
      // Switch to the direct chat
      onChatSelect(result.data.chatId, false)
    } else {
      toast.error('Gagal membuat chat')
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 gap-0 flex flex-col" side="right" showClose={false}>
          <SheetTitle asChild>
            <VisuallyHidden>Group Info</VisuallyHidden>
          </SheetTitle>

          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 bg-background border-b">
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 hover:bg-muted rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="text-lg font-medium">Info grup</h2>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col pb-4">
              {/* Group Photo Header */}
              <div className="relative w-full aspect-square max-h-[400px] bg-muted/50 flex items-center justify-center group">
                {/* Clickable area to view full image */}
                <button
                  onClick={() => {
                    if (groupAvatar) {
                      setShowImageViewer(true)
                    }
                  }}
                  className="absolute inset-0 w-full h-full flex items-center justify-center"
                  disabled={!groupAvatar}
                >
                  {groupAvatar ? (
                    <img
                      src={groupAvatar}
                      alt={groupName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UsersIcon className="h-24 w-24 text-muted-foreground" />
                  )}
                </button>

                {/* Upload overlay for admin */}
                {isCurrentUserAdmin && (
                  <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 cursor-pointer bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
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
                <div className="flex items-center justify-between gap-3 mb-2 break-words w-[400px] inline-block">
                  <h2 className="text-xl font-medium flex-1">{groupName}</h2>
                  {isCurrentUserAdmin && (
                    <button
                      onClick={handleEditName}
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

                {/* Created At and Created By - Minimalist format */}
                {createdAt && createdBy && (
                  <p className="mt-3 text-xs text-muted-foreground/80">
                    Grup dibuat oleh <span className="font-medium text-foreground/90">{createdBy === currentUserId ? 'Anda' : (creatorName || createdBy)}</span>, pada <span className="font-medium text-foreground/90">{format(createdAt, 'd/M/yyyy')}</span> pukul <span className="font-medium text-foreground/90">{format(createdAt, 'HH.mm')}</span>
                  </p>
                )}
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
                      title="Add members to group"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  {[...groupMembers]
                    .sort((a, b) => {
                      const aIsAdmin = groupAdmins.includes(a.userId)
                      const bIsAdmin = groupAdmins.includes(b.userId)

                      // Sort admins first
                      if (aIsAdmin && !bIsAdmin) return -1
                      if (!aIsAdmin && bIsAdmin) return 1

                      // Then sort alphabetically by display name
                      return a.displayName.localeCompare(b.displayName)
                    })
                    .map((member) => {
                      const isAdmin = groupAdmins.includes(member.userId)
                      const canManage = isCurrentUserAdmin && member.userId !== currentUserId
                      const isCurrentUser = member.userId === currentUserId
                      const isHovered = hoveredMemberId === member.userId
                      const canPromoteToAdmin = !isAdmin && groupAdmins.length < 5

                      return (
                        <div
                          key={member.userId}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group ",
                            !isCurrentUser && "cursor-pointer"
                          )}
                          onMouseEnter={() => setHoveredMemberId(member.userId)}
                          onMouseLeave={() => setHoveredMemberId(null)}
                          onClick={() => {
                            if (!isCurrentUser) {
                              setSelectedUserForProfile(member)
                              setShowUserProfile(true)
                            }
                          }}
                        >
                          <Avatar className="h-12 w-12 shrink-0">
                            <AvatarImage src={member.imageURL || member.imageUrl} alt="" />
                            <AvatarFallback className="text-sm font-semibold">
                              {member.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 max-w-[calc(100%-140px)] pt-1">
                            <div className="flex items-baseline gap-1 mb-0.5">
                              <span className="text-sm font-medium">
                                {member.displayName.length > 35
                                  ? member.displayName.slice(0, 35) + '...'
                                  : member.displayName}
                              </span>
                              {isCurrentUser && (
                                <span className="text-sm text-muted-foreground font-normal shrink-0">(You)</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{member.username || member.email?.split('@')[0]}</p>
                          </div>

                          {/* Right side: Badge and Dropdown horizontal */}
                          <div className="flex items-center flex-col justify-start pt-1">
                            {isAdmin && (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 font-normal">
                                Admin
                              </Badge>
                            )}
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={cn(
                                      "h-8 w-8 transition-opacity",
                                      isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation() // Prevent opening user profile when clicking dropdown
                                    }}
                                    aria-label={`Manage ${member.displayName}`}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {isAdmin ? (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation() // Prevent opening user profile
                                        handleDemoteFromAdmin(member.userId, member.displayName)
                                      }}
                                    >
                                      <UserCog className="h-4 w-4 mr-2" />
                                      <span>Hapus dari admin</span>
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation() // Prevent opening user profile
                                        if (canPromoteToAdmin) {
                                          handlePromoteToAdmin(member.userId, member.displayName)
                                        }
                                      }}
                                      disabled={!canPromoteToAdmin}
                                      className={!canPromoteToAdmin ? 'opacity-50 cursor-not-allowed' : ''}
                                      title={!canPromoteToAdmin ? 'Maksimal 5 admin per grup' : ''}
                                    >
                                      <UserCog className="h-4 w-4 mr-2" />
                                      <span>Jadikan admin grup</span>
                                      {!canPromoteToAdmin && (
                                        <span className="ml-auto text-[10px] text-muted-foreground">(Max)</span>
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation() // Prevent opening user profile
                                      handleKickMember(member.userId, member.displayName)
                                    }}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  >
                                    <UserMinus className="h-4 w-4 mr-2" />
                                    <span>Keluarkan</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              <Separator />

              {/* Leave Group Button */}
              <div className="px-6 py-4">
                <Button
                  variant="ghost"
                  onClick={handleLeaveGroup}
                  className="w-full justify-start gap-3 h-auto py-3 text-white hover:text-white transition-colors"
                  style={{ backgroundColor: '#E54C38' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#D43D28'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#E54C38'
                  }}
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-sm font-medium">Keluar dari Grup</span>
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogTitle asChild>
            <VisuallyHidden>Tambahkan Anggota ke "{groupName}"</VisuallyHidden>
          </DialogTitle>
          <div className="flex flex-col h-[600px]">
            {/* Header */}
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Tambahkan Anggota ke "{groupName}"</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Pilih hingga {MAX_PARTICIPANTS_PER_ACTION} anggota untuk ditambahkan
              </p>
            </div>

            {/* Selected Members */}
            {selectedUserIds.size > 0 && (
              <div className="px-6 py-3 border-b bg-muted/30">
                <p className="text-sm font-medium mb-2">Anggota Terpilih ({selectedUserIds.size})</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedUserIds).map((userId) => {
                    const user = availableUsers.find(u => u.userId === userId)
                    if (!user) return null
                    const displayName = user.displayName && user.displayName.length > 25
                      ? user.displayName.slice(0, 25) + '...'
                      : user.displayName || 'Unknown User'
                    return (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="gap-1 pl-2 pr-1 py-1"
                      >
                        <span className="text-xs">{displayName}</span>
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
                  placeholder="Cari Pengguna"
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
                  <p className="text-sm text-muted-foreground">Tidak ada pengguna yang tersedia untuk ditambahkan</p>
                </div>
              ) : (
                <div className="px-4 py-2">
                  {availableUsers
                    .filter(user => {
                      if (!searchQuery) return true
                      const q = searchQuery.toLowerCase()
                      return (
                        user.displayName?.toLowerCase().includes(q) ||
                        user.email?.toLowerCase().includes(q)
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
                              {user.displayName?.slice(0, 2).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium truncate">
                              {user.displayName && user.displayName.length > 25
                                ? user.displayName.slice(0, 25) + '...'
                                : user.displayName || 'Unknown User'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">@{user.email?.split('@')[0] || 'unknown'}</p>
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
                  {selectedUserIds.size} anggota terpilih
                </p>
                <Button
                  onClick={handleAddMembers}
                  disabled={addingMembers}
                  className="gap-2"
                >
                  {addingMembers ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menambahkan...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Tambahkan Anggota
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle asChild>
              <VisuallyHidden>Keluarkan anggota dari grup?</VisuallyHidden>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan mengeluarkan anggota dari grup. Mereka dapat ditambahkan kembali nanti oleh admin grup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMember}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmRemoveMember()
              }}
              disabled={removingMember}
              className="text-white hover:text-white transition-colors"
              style={{ backgroundColor: '#E54C38' }}
              onMouseEnter={(e) => {
                if (!removingMember) {
                  e.currentTarget.style.backgroundColor = '#D43D28'
                }
              }}
              onMouseLeave={(e) => {
                if (!removingMember) {
                  e.currentTarget.style.backgroundColor = '#E54C38'
                }
              }}
            >
              {removingMember ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengeluarkan...
                </>
              ) : (
                "Keluarkan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Group Name Dialog */}
      <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit group name</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="Enter group name"
              maxLength={50}
              disabled={updatingName}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleUpdateGroupName()
                }
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">
              {editingName.length}/50 characters
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditNameDialog(false)}
              disabled={updatingName}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateGroupName}
              disabled={updatingName || !editingName.trim() || editingName.trim() === groupName}
            >
              {updatingName ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Group Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keluar dari Grup?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin keluar dari grup ini? Anda tidak akan lagi menerima pesan dari grup ini dan perlu ditambahkan kembali oleh anggota untuk bergabung lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmLeaveGroup()
              }}
              disabled={leaving}
              className="text-white hover:text-white transition-colors"
              style={{ backgroundColor: '#E54C38' }}
              onMouseEnter={(e) => {
                if (!leaving) {
                  e.currentTarget.style.backgroundColor = '#D43D28'
                }
              }}
              onMouseLeave={(e) => {
                if (!leaving) {
                  e.currentTarget.style.backgroundColor = '#E54C38'
                }
              }}
            >
              {leaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Keluar...
                </>
              ) : (
                "Keluar dari Grup"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Viewer Dialog */}
      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-0">
          <DialogTitle asChild>
            <VisuallyHidden>View Group Avatar</VisuallyHidden>
          </DialogTitle>
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => setShowImageViewer(false)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Close"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Image */}
            {groupAvatar && (
              <img
                src={groupAvatar}
                alt={groupName}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile Dialog */}
      <UserProfileDialog
        open={showUserProfile}
        onOpenChange={setShowUserProfile}
        user={selectedUserForProfile}
        onSendMessage={onChatSelect ? handleSendMessageToUser : undefined}
      />

      {/* Image Cropper Dialog */}
      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="max-w-2xl p-0">
          <DialogTitle asChild>
            <VisuallyHidden>Crop Image</VisuallyHidden>
          </DialogTitle>
          <div className="flex flex-col h-[600px]">
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Crop Image</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCropper(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Cropper */}
            <div className="relative flex-1 bg-black">
              {selectedImage && (
                <Cropper
                  image={selectedImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            {/* Controls */}
            <div className="px-6 py-4 border-t space-y-4">
              {/* Zoom Slider */}
              <div className="flex items-center gap-3">
                <ZoomOut className="h-5 w-5 text-muted-foreground" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <ZoomIn className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCropper(false)}
                >
                  Cancel
                </Button>
                <Button onClick={createCroppedImage}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
