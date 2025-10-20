'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Message } from '@/types/models'
import { Loader2 } from 'lucide-react'

interface DeleteMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMessages: Message[]
  currentUserId: string
  onDeleteForMe: () => Promise<void>
  onDeleteForEveryone: () => Promise<void>
}

export function DeleteMessageDialog({
  open,
  onOpenChange,
  selectedMessages,
  currentUserId,
  onDeleteForMe,
  onDeleteForEveryone,
}: DeleteMessageDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [deleteType, setDeleteType] = useState<'me' | 'everyone' | null>(null)

  // Check if all messages are from current user
  const allFromCurrentUser = selectedMessages.every(
    (msg) => msg.senderId === currentUserId
  )

  // Check if all messages are within 48 hours (for delete for me)
  const canDeleteForMe = selectedMessages.every((msg) => {
    if (!msg.timestamp) return false
    const hoursDiff = (Date.now() - msg.timestamp.toMillis()) / (1000 * 60 * 60)
    return hoursDiff < 48
  })

  // Check if all messages are within 15 minutes (for delete for everyone)
  const canDeleteForEveryone = allFromCurrentUser && selectedMessages.every((msg) => {
    if (!msg.timestamp) return false
    const minutesDiff = (Date.now() - msg.timestamp.toMillis()) / (1000 * 60)
    return minutesDiff < 15
  })

  const handleDeleteForMe = async () => {
    setDeleting(true)
    setDeleteType('me')
    try {
      await onDeleteForMe()
      onOpenChange(false)
    } finally {
      setDeleting(false)
      setDeleteType(null)
    }
  }

  const handleDeleteForEveryone = async () => {
    setDeleting(true)
    setDeleteType('everyone')
    try {
      await onDeleteForEveryone()
      onOpenChange(false)
    } finally {
      setDeleting(false)
      setDeleteType(null)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus pesan?</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Pilih opsi untuk menghapus pesan
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          {/* Delete for Everyone button (only if user owns messages and within 1 hour) */}
          {canDeleteForEveryone && (
            <Button
              onClick={handleDeleteForEveryone}
              disabled={deleting}
              variant="ghost"
              className="w-full justify-center text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              {deleting && deleteType === 'everyone' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus untuk semua orang'
              )}
            </Button>
          )}

          {/* Delete for Me button */}
          {canDeleteForMe ? (
            <Button
              onClick={handleDeleteForMe}
              disabled={deleting}
              variant="ghost"
              className="w-full justify-center text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              {deleting && deleteType === 'me' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus untuk saya'
              )}
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2">
              Tidak dapat menghapus pesan yang lebih dari 48 jam
            </div>
          )}

          {/* Cancel button */}
          <Button
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            variant="ghost"
            className="w-full justify-center"
          >
            Batal
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
