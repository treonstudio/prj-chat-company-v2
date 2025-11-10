/**
 * Tab Conflict Dialog
 *
 * Shows when app is opened in multiple tabs (like WhatsApp Web)
 * User can choose to use current tab or close it
 */

'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface TabConflictDialogProps {
  open: boolean;
  onUseHere: () => void;
  onClose: () => void;
}

export function TabConflictDialog({
  open,
  onUseHere,
  onClose,
}: TabConflictDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="sr-only">Tab Conflict</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground text-center py-4">
            BC sedang terbuka di jendela lain. Klik &quot;Gunakan di Sini&quot; untuk menggunakan BC di jendela ini.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-base"
          >
            Tutup
          </Button>
          <Button
            onClick={onUseHere}
            className="text-base"
            style={{ backgroundColor: '#008069' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#006d5b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#008069';
            }}
          >
            Gunakan di Sini
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
