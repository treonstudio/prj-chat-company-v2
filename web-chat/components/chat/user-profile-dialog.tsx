'use client'

import { useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { User } from '@/types/models'
import { MessageSquare, X, ArrowLeft } from 'lucide-react'
import { SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

interface UserProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onSendMessage?: () => void
}

export function UserProfileDialog({
  open,
  onOpenChange,
  user,
  onSendMessage,
}: UserProfileDialogProps) {
  const [showImageViewer, setShowImageViewer] = useState(false)

  if (!user) return null

  const displayName = user.displayName || 'Unknown User'
  const username = user.username || user.email?.split('@')[0] || 'unknown'
  const avatar = user.imageURL || user.imageUrl

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 gap-0 flex flex-col" side="right" showClose={false}>
          <SheetTitle asChild>
            <VisuallyHidden>Info kontak</VisuallyHidden>
          </SheetTitle>

          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 bg-background border-b">
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 hover:bg-muted rounded-full transition-colors"
              aria-label="Close"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h2 className="text-lg font-medium">Info kontak</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* User Photo Section */}
            <div className="flex items-center justify-center py-8 bg-background">
              <button
                onClick={() => {
                  if (avatar) {
                    setShowImageViewer(true)
                  }
                }}
                className="cursor-pointer hover:opacity-90 transition-opacity"
                disabled={!avatar}
              >
                <Avatar className="h-52 w-52">
                  <AvatarImage src={avatar} alt={displayName} />
                  <AvatarFallback className="text-6xl">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>

            {/* User Info */}
            <div className="px-6 py-6 bg-background text-center">
              <h2 className="text-2xl font-medium mb-2">{displayName}</h2>
              <p className="text-base text-muted-foreground">@{username}</p>
            </div>

            <Separator />

            {/* Send Message Button */}
            {onSendMessage && (
              <div className="px-6 py-6">
                <Button
                  onClick={onSendMessage}
                  className="w-full gap-3 h-12 bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-base">Kirim pesan</span>
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

    {/* Image Viewer Dialog */}
    <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
      <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-0">
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
          {avatar && (
            <img
              src={avatar}
              alt={displayName}
              className="max-w-full max-h-full object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
