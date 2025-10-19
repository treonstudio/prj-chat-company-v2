'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { User } from '@/types/models'
import { MessageSquare } from 'lucide-react'
import { SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

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
  if (!user) return null

  const displayName = user.displayName || 'Unknown User'
  const phoneNumber = user.email || ''
  const avatar = user.imageURL || user.imageUrl

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 gap-0" side="right">
        <SheetTitle asChild>
          <VisuallyHidden>User Profile</VisuallyHidden>
        </SheetTitle>
        <div className="flex flex-col h-full">
          {/* User Photo Header */}
          <div className="flex items-center justify-center py-12 bg-background">
            <Avatar className="h-48 w-48">
              <AvatarImage src={avatar || '/placeholder-user.jpg'} alt="" />
              <AvatarFallback className="text-4xl">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* User Info */}
          <div className="px-6 py-6 bg-background text-center">
            <h2 className="text-xl font-medium mb-2">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{phoneNumber}</p>
          </div>

          {/* Send Message Button */}
          {onSendMessage && (
            <div className="px-6 py-4 border-t mt-auto">
              <Button
                onClick={onSendMessage}
                className="w-full gap-2"
                variant="default"
              >
                <MessageSquare className="h-5 w-5" />
                Kirim pesan
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
