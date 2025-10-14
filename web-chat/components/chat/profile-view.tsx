"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Pencil, Check, X, Copy, LogOut, Eye, EyeOff } from "lucide-react"
import { User } from "@/types/models"

interface ProfileViewProps {
  user: User
  onBack: () => void
  onLogout: () => void
  onUpdateProfile?: (name: string, about: string) => Promise<void>
}

export function ProfileView({ user, onBack, onLogout, onUpdateProfile }: ProfileViewProps) {
  const [editingName, setEditingName] = useState(false)
  const [editingAbout, setEditingAbout] = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)
  const [name, setName] = useState(user.displayName)
  const [about, setAbout] = useState("Avail") // Default about, could be from user data
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSaveName = async () => {
    if (name.trim() && onUpdateProfile) {
      setSaving(true)
      await onUpdateProfile(name.trim(), about)
      setSaving(false)
      setEditingName(false)
    }
  }

  const handleSaveAbout = async () => {
    if (about.trim() && onUpdateProfile) {
      setSaving(true)
      await onUpdateProfile(name, about.trim())
      setSaving(false)
      setEditingAbout(false)
    }
  }

  const handleSavePassword = async () => {
    if (password.trim()) {
      setSaving(true)
      // TODO: Implement password update logic
      // await updatePassword(password)
      setSaving(false)
      setEditingPassword(false)
      setPassword("")
    }
  }

  const handleCopyPhone = () => {
    // Assuming phone is in user data, for now using placeholder
    const phone = "+62 821-5442-4492"
    navigator.clipboard.writeText(phone)
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
          <Avatar className="h-40 w-40">
            <AvatarImage src={user.avatarUrl || "/placeholder-user.jpg"} alt="" />
            <AvatarFallback className="text-4xl">
              {user.displayName?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name Section */}
        <div className="px-4 py-4">
          <label className="text-sm text-muted-foreground">Nama</label>
          <div className="flex items-center justify-between gap-2 py-2">
            {editingName ? (
              <>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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

        {/* About Section */}
        <div className="px-4 py-4">
          <label className="text-sm text-muted-foreground">Tentang</label>
          <div className="flex items-center justify-between gap-2 py-2">
            {editingAbout ? (
              <>
                <Input
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  disabled={saving}
                  className="flex-1"
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSaveAbout}
                    disabled={saving || !about.trim()}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setAbout("Avail")
                      setEditingAbout(false)
                    }}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="flex-1 text-base">{about}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingAbout(true)}
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
          <div className="flex items-center justify-between gap-2 py-2">
            {editingPassword ? (
              <>
                <div className="flex-1 relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={saving}
                    placeholder="Enter new password"
                    className="pr-10"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSavePassword}
                    disabled={saving || !password.trim()}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPassword("")
                      setEditingPassword(false)
                      setShowPassword(false)
                    }}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="flex-1 text-base">••••••••</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingPassword(true)}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Phone Section */}
        <div className="px-4 py-4">
          <label className="text-sm text-muted-foreground">Telepon</label>
          <div className="flex items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-muted-foreground">📞</span>
              <p className="text-base">+62 821-5442-4492</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyPhone}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
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
    </div>
  )
}
