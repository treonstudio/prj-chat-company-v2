"use client"

import { useState, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Pencil, Check, X, LogOut, Eye, EyeOff, Camera, Loader2 } from "lucide-react"
import { User } from "@/types/models"
import { StorageRepository } from "@/lib/repositories/storage.repository"
import { UserRepository } from "@/lib/repositories/user.repository"
import { AuthRepository } from "@/lib/repositories/auth.repository"
import { AvatarCropDialog } from "./avatar-crop-dialog"
import { toast } from "sonner"
import { useUsageControls } from "@/lib/contexts/usage-controls.context"

interface ProfileViewProps {
  user: User
  onBack: () => void
  onLogout: () => void
}

const storageRepository = new StorageRepository()
const userRepository = new UserRepository()
const authRepository = new AuthRepository()

export function ProfileView({ user, onBack, onLogout }: ProfileViewProps) {
  const [editingName, setEditingName] = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)
  const [name, setName] = useState(user.displayName)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { usageControls } = useUsageControls()

  // Max character limit for profile name
  const MAX_PROFILE_NAME_LENGTH = 25

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    if (newValue.length > MAX_PROFILE_NAME_LENGTH) {
      toast.error(
        `Nama profil terlalu panjang! Maksimal ${MAX_PROFILE_NAME_LENGTH} karakter. ` +
        `Saat ini: ${newValue.length} karakter.`,
        { duration: 3000 }
      )
      return
    }

    setName(newValue)
  }

  const handleSaveName = async () => {
    if (!name.trim()) {
      toast.error('Nama tidak boleh kosong')
      return
    }

    if (name.length > MAX_PROFILE_NAME_LENGTH) {
      toast.error(`Nama profil maksimal ${MAX_PROFILE_NAME_LENGTH} karakter`)
      return
    }

    if (name.trim() === user.displayName) {
      setEditingName(false)
      return
    }

    setSaving(true)
    try {
      const result = await userRepository.updateDisplayName(user.userId, name.trim())

      if (result.status === 'success') {
        setEditingName(false)
        toast.success('Nama berhasil diperbarui')
        // The real-time listener will update the UI automatically
      } else if (result.status === 'error') {
        toast.error(result.message || 'Gagal memperbarui nama')
        setName(user.displayName) // Reset to original
      }
    } catch (error) {
      toast.error('Terjadi kesalahan yang tidak terduga')
      setName(user.displayName) // Reset to original
    } finally {
      setSaving(false)
    }
  }

  const handleSavePassword = async () => {
    // Validate inputs
    if (!currentPassword.trim()) {
      toast.error('Silakan masukkan password saat ini')
      return
    }

    if (!newPassword.trim()) {
      toast.error('Silakan masukkan password baru')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password harus minimal 6 karakter')
      return
    }

    if (!confirmPassword.trim()) {
      toast.error('Silakan konfirmasi password baru')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Password baru dan konfirmasi password tidak cocok')
      return
    }

    setSaving(true)
    try {
      // First, reauthenticate the user with current password
      const reauthResult = await authRepository.reauthenticate(currentPassword)

      if (reauthResult.status === 'error') {
        toast.error(reauthResult.message || 'Password saat ini salah')
        setSaving(false)
        return
      }

      // Then update to new password
      const updateResult = await authRepository.updatePassword(newPassword)

      if (updateResult.status === 'success') {
        toast.success('Password berhasil diperbarui. Anda akan logout otomatis...')
        setEditingPassword(false)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setShowCurrentPassword(false)
        setShowNewPassword(false)
        setShowConfirmPassword(false)

        // Auto logout after 2 seconds
        setTimeout(() => {
          onLogout()
        }, 2000)
      } else if (updateResult.status === 'error') {
        toast.error(updateResult.message || 'Gagal memperbarui password')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan yang tidak terduga')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Silakan pilih file gambar yang valid')
      return
    }

    // Validate file size using dynamic limit from Firestore
    const maxSizeInBytes = usageControls.maxFileSizeUploadedInMB * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      toast.error(`Ukuran gambar tidak boleh lebih dari ${usageControls.maxFileSizeUploadedInMB}MB`)
      return
    }

    // Create object URL for the selected image
    const imageUrl = URL.createObjectURL(file)
    setSelectedImage(imageUrl)
    setShowCropDialog(true)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = async (croppedImageFile: File) => {
    setUploadingAvatar(true)

    try {
      // Upload to Firebase Storage
      const uploadResult = await storageRepository.uploadAvatar(user.userId, croppedImageFile)

      if (uploadResult.status === 'success') {
        // Update user document with new avatar URL
        const updateResult = await userRepository.updateAvatar(user.userId, uploadResult.data)

        if (updateResult.status === 'success') {
          toast.success('Foto profil berhasil diperbarui')
        } else if (updateResult.status === 'error') {
          toast.error(updateResult.message || 'Gagal memperbarui foto profil')
        }
        // Success - the real-time listener in AuthContext will update the UI automatically
      } else if (uploadResult.status === 'error') {
        toast.error(uploadResult.message || 'Gagal mengunggah foto profil')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat mengunggah foto profil')
    } finally {
      setUploadingAvatar(false)
      // Clean up object URL
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage)
        setSelectedImage(null)
      }
    }
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-5 bg-primary text-primary-foreground">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">Profil</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Avatar Section */}
        <div className="flex flex-col items-center py-8 bg-muted/30">
          <div className="relative group">
            <Avatar className="h-40 w-40">
              <AvatarImage src={user.imageURL || user.imageUrl || "/placeholder-user.jpg"} alt="" />
              <AvatarFallback className="text-4xl">
                {user.displayName?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Camera overlay button */}
            <button
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : (
                <Camera className="h-8 w-8 text-white" />
              )}
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Name Section */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Nama</label>
            {editingName && name.length > MAX_PROFILE_NAME_LENGTH * 0.8 && (
              <span
                className={`text-[10px] ${
                  name.length > MAX_PROFILE_NAME_LENGTH * 0.95
                    ? 'text-destructive font-semibold'
                    : name.length > MAX_PROFILE_NAME_LENGTH * 0.9
                    ? 'text-orange-500 font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {name.length} / {MAX_PROFILE_NAME_LENGTH}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 py-2">
            {editingName ? (
              <>
                <Input
                  value={name}
                  onChange={handleNameChange}
                  disabled={saving}
                  className="flex-1"
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSaveName}
                    disabled={saving || !name.trim()}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setName(user.displayName)
                      setEditingName(false)
                    }}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="flex-1 text-base">{name}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingName(true)}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Password Section */}
        <div className="px-4 py-4">
          <label className="text-sm text-muted-foreground">Password</label>
          {editingPassword ? (
            <div className="space-y-3 mt-2">
              {/* Current Password */}
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={saving}
                  placeholder="Current password"
                  className="pr-10"
                  autoFocus
                  autoComplete="off"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  type="button"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {/* New Password */}
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={saving}
                  placeholder="New password (min 6 characters)"
                  className="pr-10"
                  autoComplete="new-password"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  type="button"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={saving}
                  placeholder="Confirm new password"
                  className="pr-10"
                  autoComplete="new-password"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  type="button"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                    setEditingPassword(false)
                    setShowCurrentPassword(false)
                    setShowNewPassword(false)
                    setShowConfirmPassword(false)
                  }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-1" />
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleSavePassword}
                  disabled={saving || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Simpan
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 py-2">
              <p className="flex-1 text-base">••••••••</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingPassword(true)}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Logout Button */}
        <div className="px-4 py-6">
          <Button
            variant="destructive"
            className="w-full bg-red-400 hover:bg-red-500 text-white"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
        </div>
      </div>

      {/* Avatar Crop Dialog */}
      {selectedImage && (
        <AvatarCropDialog
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )
}
