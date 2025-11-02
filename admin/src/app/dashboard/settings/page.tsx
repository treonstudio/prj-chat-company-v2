"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/context/AuthContext"
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut } from "firebase/auth"
import firebase_app from "@/firebase/config"
import { toast } from "sonner"
import { Eye, EyeOff, Lock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const auth = getAuth(firebase_app)

export default function SettingsPage() {
  const { user } = useAuthContext()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Show/hide password states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Error states
  const [currentPasswordError, setCurrentPasswordError] = useState("")
  const [newPasswordError, setNewPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")

  const resetForm = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setCurrentPasswordError("")
    setNewPasswordError("")
    setConfirmPasswordError("")
  }

  const validateForm = () => {
    let isValid = true

    // Reset errors
    setCurrentPasswordError("")
    setNewPasswordError("")
    setConfirmPasswordError("")

    // Validate current password
    if (!currentPassword) {
      setCurrentPasswordError("Password saat ini wajib diisi")
      isValid = false
    }

    // Validate new password
    if (!newPassword) {
      setNewPasswordError("Password baru wajib diisi")
      isValid = false
    } else if (newPassword.length < 6) {
      setNewPasswordError("Password baru minimal 6 karakter")
      isValid = false
    } else if (newPassword === currentPassword) {
      setNewPasswordError("Password baru harus berbeda dengan password lama")
      isValid = false
    }

    // Validate confirm password
    if (!confirmPassword) {
      setConfirmPasswordError("Konfirmasi password wajib diisi")
      isValid = false
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError("Konfirmasi password tidak cocok")
      isValid = false
    }

    return isValid
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast.error("User tidak ditemukan", {
        description: "Silakan login kembali"
      })
      return
    }

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      // Re-authenticate user before changing password (Firebase requirement)
      if (!user.email) {
        throw new Error("Email user tidak ditemukan")
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Update password
      await updatePassword(user, newPassword)

      toast.success("Password berhasil diubah", {
        description: "Anda akan logout otomatis, silakan login dengan password baru"
      })

      // Reset form
      resetForm()

      // Auto logout and redirect to signin
      setTimeout(async () => {
        await signOut(auth)
        router.push("/signin")
      }, 2000) // Delay 2 seconds untuk user baca toast message
    } catch (error: any) {
      console.error("Error changing password:", error)

      // Handle specific Firebase errors
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        setCurrentPasswordError("Password saat ini salah")
        toast.error("Password saat ini salah", {
          description: "Silakan periksa kembali password Anda"
        })
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Terlalu banyak percobaan", {
          description: "Akun Anda diblokir sementara. Silakan coba lagi nanti"
        })
      } else if (error.code === "auth/requires-recent-login") {
        toast.error("Sesi telah kadaluarsa", {
          description: "Silakan login kembali untuk mengubah password"
        })
      } else {
        toast.error("Gagal mengubah password", {
          description: error.message || "Terjadi kesalahan yang tidak terduga"
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informasi Akun
          </CardTitle>
          <CardDescription>Detail akun Anda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <p className="text-lg font-medium">{user?.email || "-"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">User ID</Label>
            <p className="text-sm font-mono text-muted-foreground">{user?.uid || "-"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Ubah Password
          </CardTitle>
          <CardDescription>Perbarui password akun Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">
                Password Saat Ini <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value)
                    setCurrentPasswordError("")
                  }}
                  placeholder="Masukkan password saat ini"
                  disabled={isLoading}
                  className={currentPasswordError ? "border-red-500" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isLoading}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {currentPasswordError && (
                <p className="text-sm text-red-500">{currentPasswordError}</p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password">
                Password Baru <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setNewPasswordError("")
                  }}
                  placeholder="Masukkan password baru (min. 6 karakter)"
                  disabled={isLoading}
                  className={newPasswordError ? "border-red-500" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isLoading}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {newPasswordError && (
                <p className="text-sm text-red-500">{newPasswordError}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                Konfirmasi Password Baru <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setConfirmPasswordError("")
                  }}
                  placeholder="Masukkan ulang password baru"
                  disabled={isLoading}
                  className={confirmPasswordError ? "border-red-500" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPasswordError && (
                <p className="text-sm text-red-500">{confirmPasswordError}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {isLoading ? "Menyimpan..." : "Simpan Password Baru"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={isLoading}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
