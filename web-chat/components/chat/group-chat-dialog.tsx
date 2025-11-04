"use client"

import { useState, useEffect, useCallback } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserRepository } from "@/lib/repositories/user.repository"
import { ChatRepository } from "@/lib/repositories/chat.repository"
import { StorageRepository } from "@/lib/repositories/storage.repository"
import { User } from "@/types/models"
import { Search, Loader2, Check, Users, X, ArrowLeft, ArrowRight, ZoomIn, ZoomOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { DialogTitle } from "@/components/ui/dialog"
import { SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { useUsageControls } from "@/lib/contexts/usage-controls.context"

const userRepository = new UserRepository()
const chatRepository = new ChatRepository()
const storageRepository = new StorageRepository()

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
  const [step, setStep] = useState<"participants" | "settings">("participants")
  const [groupName, setGroupName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Image cropper states
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [croppedImageFile, setCroppedImageFile] = useState<File | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  // Usage controls
  const { usageControls } = useUsageControls()

  // Max character limits
  const MAX_GROUP_NAME_LENGTH = 100
  // Max participants that can be selected per action (unlimited by default)
  const MAX_PARTICIPANTS_PER_ACTION = parseInt(process.env.NEXT_PUBLIC_MAX_PARTICIPANTS_PER_ACTION || '999')
  // Minimum participants required to create a group (must be more than 1)
  const MIN_PARTICIPANTS_REQUIRED = 2

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setStep("participants")
      setGroupName("")
      setSearchQuery("")
      setUsers([])
      setSelectedUsers([])
      setError(null)
      setSelectedImage(null)
      setCroppedImage(null)
      setCroppedImageFile(null)
      setShowCropper(false)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
  }, [open])

  // Search users with debounce (300ms)
  useEffect(() => {
    if (step !== "participants") return

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

  const handleGroupNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    if (newValue.length > MAX_GROUP_NAME_LENGTH) {
      toast.error(
        `Nama grup terlalu panjang! Maksimal ${MAX_GROUP_NAME_LENGTH} karakter. ` +
        `Saat ini: ${newValue.length} karakter.`,
        { duration: 3000 }
      )
      return
    }

    setGroupName(newValue)
  }

  const toggleUserSelection = (user: User) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.userId === user.userId)
      if (isSelected) {
        return prev.filter((u) => u.userId !== user.userId)
      } else {
        // Check if selecting this user would exceed the max participants per action
        if (prev.length >= MAX_PARTICIPANTS_PER_ACTION) {
          toast.error(
            `Maksimal ${MAX_PARTICIPANTS_PER_ACTION} peserta dapat dipilih sekaligus`,
            { duration: 3000 }
          )
          return prev
        }
        return [...prev, user]
      }
    })
  }

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.userId !== userId))
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Harap pilih file gambar')
      return
    }

    // Validate file size using dynamic limit from Firestore
    const maxSizeInBytes = usageControls.maxFileSizeUploadedInMB * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      toast.error(`Ukuran gambar tidak boleh lebih dari ${usageControls.maxFileSizeUploadedInMB}MB`)
      return
    }

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

      canvas.toBlob((blob) => {
        if (!blob) return

        // Create URL for preview
        const url = URL.createObjectURL(blob)
        setCroppedImage(url)

        // Create File for upload
        const file = new File([blob], 'group-avatar.jpg', { type: 'image/jpeg' })
        setCroppedImageFile(file)

        setShowCropper(false)
      }, 'image/jpeg', 0.95)
    } catch (error) {
      console.error('Error cropping image:', error)
      toast.error('Gagal memotong gambar')
    }
  }

  const handleNext = () => {
    if (selectedUsers.length < MIN_PARTICIPANTS_REQUIRED) {
      toast.error(`Harap pilih minimal ${MIN_PARTICIPANTS_REQUIRED} peserta`)
      return
    }
    if (selectedUsers.length > MAX_PARTICIPANTS_PER_ACTION) {
      toast.error(`Maksimal ${MAX_PARTICIPANTS_PER_ACTION} peserta dapat dipilih sekaligus`)
      return
    }
    setStep("settings")
  }

  const handleBack = () => {
    if (step === "settings") {
      setStep("participants")
    }
  }

  const handleCreateGroup = async () => {
    // Validation
    if (selectedUsers.length < MIN_PARTICIPANTS_REQUIRED) {
      toast.error(`Harap pilih minimal ${MIN_PARTICIPANTS_REQUIRED} peserta`)
      return
    }

    if (selectedUsers.length > MAX_PARTICIPANTS_PER_ACTION) {
      toast.error(`Maksimal ${MAX_PARTICIPANTS_PER_ACTION} peserta dapat dipilih sekaligus`)
      return
    }

    if (groupName.trim().length > MAX_GROUP_NAME_LENGTH) {
      toast.error(`Nama grup maksimal ${MAX_GROUP_NAME_LENGTH} karakter`)
      return
    }

    setCreating(true)
    setError(null)

    try {
      const memberIds = selectedUsers.map((u) => u.userId)

      // Use "New Group" as default name if no name provided
      const finalGroupName = groupName.trim() || "New Group"

      // Upload group avatar if exists
      let avatarUrl: string | undefined = undefined
      if (croppedImageFile) {
        // Generate temporary chatId for storage path
        const tempChatId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const uploadResult = await storageRepository.uploadGroupAvatar(tempChatId, croppedImageFile)

        if (uploadResult.status === 'success') {
          avatarUrl = uploadResult.data
        } else {
          toast.error('Gagal mengupload foto grup')
          setCreating(false)
          return
        }
      }

      const result = await chatRepository.createGroupChat(
        finalGroupName,
        currentUserId,
        memberIds,
        avatarUrl
      )

      setCreating(false)

      if (result.status === 'success') {
        toast.success('Grup berhasil dibuat')
        onGroupCreated(result.data.chatId, true)
        onOpenChange(false)
      } else if (result.status === 'error') {
        setError(result.message || "Gagal membuat grup")
        toast.error(result.message || "Gagal membuat grup")
      }
    } catch (error) {
      console.error('Error creating group:', error)
      setError('Terjadi kesalahan saat membuat grup')
      toast.error('Terjadi kesalahan saat membuat grup')
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 gap-0">
        <SheetTitle asChild>
          <VisuallyHidden>Add Group Participants</VisuallyHidden>
        </SheetTitle>
        {step === "participants" ? (
          /* Step 1: Select Participants */
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-4 border-b">
              <h2 className="text-lg font-semibold">Add Group Participants</h2>
              <p className="text-xs text-muted-foreground">
                {selectedUsers.length} of {MAX_PARTICIPANTS_PER_ACTION} selected
              </p>
            </div>

            {/* Selected Users Chips */}
            {selectedUsers.length > 0 && (
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="max-h-24 overflow-y-auto">
                  <div className="flex flex-wrap gap-2 pr-2">
                    {selectedUsers.map((user) => {
                      // Truncate user name if longer than 25 characters
                      const displayName = user.displayName && user.displayName.length > 25
                        ? user.displayName.slice(0, 25) + '...'
                        : user.displayName

                      return (
                        <Badge
                          key={user.userId}
                          variant="secondary"
                          className="gap-1.5 pl-2 pr-1 py-1.5 flex-shrink-0"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={user.imageURL || user.imageUrl || "/placeholder-user.jpg"} />
                            <AvatarFallback className="text-[10px]">
                              {user.displayName?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{displayName}</span>
                          <button
                            onClick={() => removeSelectedUser(user.userId)}
                            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="px-4 py-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-4 py-2 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            {/* User List */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery.trim()
                      ? "No users found"
                      : "Ketikkan nama username untuk menambahkan ke group"}
                  </p>
                </div>
              ) : (
                <div className="px-2 py-2">
                  {users.map((user) => {
                    const isSelected = selectedUsers.some(
                      (u) => u.userId === user.userId
                    )
                    return (
                      <button
                        key={user.userId}
                        onClick={() => toggleUserSelection(user)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                          isSelected
                            ? "bg-primary/10"
                            : "hover:bg-muted"
                        )}
                      >
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage
                            src={user.imageURL || user.imageUrl || "/placeholder-user.jpg"}
                            alt=""
                          />
                          <AvatarFallback className="text-sm">
                            {user.displayName?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.displayName && user.displayName.length > 24
                              ? user.displayName.slice(0, 24) + '...'
                              : user.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.username || user.email?.split('@')[0]}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "h-5 w-5 rounded-sm border-2 flex items-center justify-center shrink-0",
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

            {/* Next Button */}
            {selectedUsers.length >= MIN_PARTICIPANTS_REQUIRED && (
              <div className="p-4 border-t flex justify-end">
                <Button
                  size="icon"
                  onClick={handleNext}
                  className="h-14 w-14 rounded-full"
                  title={`Create group with ${selectedUsers.length} participants`}
                >
                  <ArrowRight className="h-6 w-6" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Group Settings */
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-4 border-b flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                disabled={creating}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold flex-1">New Group</h2>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Group Icon Placeholder */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {croppedImage ? (
                        <img src={croppedImage} alt="Group icon" className="h-full w-full object-cover" />
                      ) : (
                        <Users className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <label htmlFor="group-icon-upload" className="absolute bottom-[1.6rem] right-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors cursor-pointer">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <input
                        id="group-icon-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={creating}
                        onChange={handleImageSelect}
                      />
                    </label>
                    <p className="text-center text-xs text-muted-foreground mt-2">Add group icon</p>
                  </div>
                </div>

                {/* Group Name Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Group Subject (optional)</label>
                    {groupName.length > MAX_GROUP_NAME_LENGTH * 0.8 && (
                      <span
                        className={`text-[10px] ${
                          groupName.length > MAX_GROUP_NAME_LENGTH * 0.95
                            ? 'text-destructive font-semibold'
                            : groupName.length > MAX_GROUP_NAME_LENGTH * 0.9
                            ? 'text-orange-500 font-medium'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {groupName.length} / {MAX_GROUP_NAME_LENGTH}
                      </span>
                    )}
                  </div>
                  <Input
                    placeholder="Group subject (optional)"
                    value={groupName}
                    onChange={handleGroupNameChange}
                    disabled={creating}
                    className="border-b-2 border-t-0 border-x-0 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="text-sm text-destructive text-center py-2">
                    {error}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Create Button */}
            <div className="p-4 border-t flex justify-end">
              <Button
                size="icon"
                onClick={handleCreateGroup}
                disabled={creating}
                className="h-14 w-14 rounded-full"
              >
                {creating ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Check className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>

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
    </Sheet>
  )
}
