'use client';

import { useState, useRef, FormEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageIcon, VideoIcon, FileIcon, PlusIcon, SendIcon, Smile, Mic } from 'lucide-react';
import { useFeatureFlags } from '@/lib/contexts/feature-flags.context';
import { useUsageControls } from '@/lib/contexts/usage-controls.context';
import { toast } from 'sonner';
import { useDraftMessage } from '@/lib/hooks/use-draft-message';
import { cn } from '@/lib/utils';

interface MessageComposerProps {
  chatId: string;
  onSendText: (text: string) => void;
  onSendImage: (file: File, shouldCompress: boolean) => void;
  onSendVideo: (file: File, shouldCompress: boolean) => void;
  onSendDocument: (file: File) => void;
  disabled?: boolean;
  uploading?: boolean;
  isReplying?: boolean;
}

export function MessageComposer({
  chatId,
  onSendText,
  onSendImage,
  onSendVideo,
  onSendDocument,
  disabled = false,
  uploading = false,
  isReplying = false,
}: MessageComposerProps) {
  const { draft, saveDraft, clearDraft } = useDraftMessage(chatId);
  const [message, setMessage] = useState('');
  const messageRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [compressionFileType, setCompressionFileType] = useState<'image' | 'video'>('image');
  const { featureFlags } = useFeatureFlags();
  const { usageControls } = useUsageControls();

  // WhatsApp character limit for text messages
  const MAX_TEXT_LENGTH = 65536;

  // Load draft when component mounts or chatId changes
  useEffect(() => {
    setMessage(draft);
    messageRef.current = draft;
  }, [draft]);

  // Update ref whenever message changes
  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`; // Max height 120px (about 5 lines)
    }
  }, [message]);

  // Save draft when chatId changes (user switches room)
  useEffect(() => {
    return () => {
      // Save current message as draft when switching rooms
      const currentMessage = messageRef.current;
      if (currentMessage.trim()) {
        saveDraft(currentMessage);
      } else {
        clearDraft();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]); // Only run when chatId changes

  // Auto-focus input when replying with retry mechanism
  useEffect(() => {
    if (isReplying && textareaRef.current) {
      let attempts = 0;
      const maxAttempts = 10;

      const attemptFocus = () => {
        if (textareaRef.current && document.activeElement !== textareaRef.current && attempts < maxAttempts) {
          attempts++;
          textareaRef.current.focus({ preventScroll: true });

          // Scroll into view on first attempt
          if (attempts === 1) {
            textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          // Retry if focus was stolen
          setTimeout(attemptFocus, 50);
        }
      };

      // Start attempting to focus
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          attemptFocus();
        });
      });
    }
  }, [isReplying]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // Check if exceeds limit
    if (newValue.length > MAX_TEXT_LENGTH) {
      toast.error(
        `Pesan terlalu panjang! Maksimal ${MAX_TEXT_LENGTH.toLocaleString()} karakter. ` +
        `Saat ini: ${newValue.length.toLocaleString()} karakter. ` +
        `Silakan persingkat atau kirim dalam beberapa bagian.`,
        { duration: 5000 }
      );
      return;
    }

    // Show warning when approaching limit (at 90%)
    if (newValue.length > MAX_TEXT_LENGTH * 0.9 && message.length <= MAX_TEXT_LENGTH * 0.9) {
      toast.warning(
        `Peringatan: Anda mendekati batas karakter! ` +
        `${newValue.length.toLocaleString()} / ${MAX_TEXT_LENGTH.toLocaleString()} karakter`,
        { duration: 3000 }
      );
    }

    setMessage(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
    // Shift + Enter will naturally create a new line (default behavior)
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      return;
    }

    if (message.length > MAX_TEXT_LENGTH) {
      toast.error(
        `Pesan terlalu panjang! Maksimal ${MAX_TEXT_LENGTH.toLocaleString()} karakter. ` +
        `Silakan persingkat atau kirim dalam beberapa bagian.`
      );
      return;
    }

    if (!disabled) {
      onSendText(message);
      setMessage('');
      // Clear draft after sending
      clearDraft();

      // Auto-focus back to textarea after sending
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Validate file size
      const maxSizeInBytes = usageControls.maxFileSizeUploadedInMB * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
        toast.error(`Ukuran file tidak boleh lebih dari ${usageControls.maxFileSizeUploadedInMB}MB`);
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
        }
        return;
      }

      setPendingImageFile(file);
      setCompressionFileType('image');
      setShowCompressionDialog(true);
    }
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleImageUpload = (shouldCompress: boolean) => {
    if (pendingImageFile) {
      onSendImage(pendingImageFile, shouldCompress);
      setPendingImageFile(null);
      setShowCompressionDialog(false);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('[MessageComposer] handleVideoSelect:', { file, fileType: file?.type });

    if (file && file.type.startsWith('video/')) {
      // Validate file size
      const maxSizeInBytes = usageControls.maxFileSizeUploadedInMB * 1024 * 1024;
      console.log('[MessageComposer] Video size check:', {
        fileSize: file.size,
        maxSize: maxSizeInBytes,
        valid: file.size <= maxSizeInBytes
      });

      if (file.size > maxSizeInBytes) {
        toast.error(`Ukuran file tidak boleh lebih dari ${usageControls.maxFileSizeUploadedInMB}MB`);
        if (videoInputRef.current) {
          videoInputRef.current.value = '';
        }
        return;
      }

      console.log('[MessageComposer] Showing compression dialog for video');
      setPendingVideoFile(file);
      setCompressionFileType('video');
      setShowCompressionDialog(true);
    }
    // Reset input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleVideoUpload = (shouldCompress: boolean) => {
    console.log('[MessageComposer] handleVideoUpload:', {
      hasPendingFile: !!pendingVideoFile,
      shouldCompress
    });

    if (pendingVideoFile) {
      console.log('[MessageComposer] Calling onSendVideo');
      onSendVideo(pendingVideoFile, shouldCompress);
      setPendingVideoFile(null);
      setShowCompressionDialog(false);
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Allowed document file extensions
      const allowedExtensions = [
        // Documents
        '.doc', '.docx', '.pdf', '.rtf', '.odt',
        // Spreadsheets
        '.xls', '.xlsx', '.csv', '.ods',
        // Presentations
        '.ppt', '.pptx', '.odp'
      ];

      // Get file extension
      const fileName = file.name.toLowerCase();
      const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

      // Validate file type
      if (!allowedExtensions.includes(fileExtension)) {
        toast.error(
          'Format file tidak didukung. Hanya dokumen (PDF, Word, Text), spreadsheet (Excel, CSV), dan presentasi (PowerPoint) yang diperbolehkan.',
          { duration: 5000 }
        );
        if (documentInputRef.current) {
          documentInputRef.current.value = '';
        }
        return;
      }

      // Validate file size
      const maxSizeInBytes = usageControls.maxFileSizeUploadedInMB * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
        toast.error(`Ukuran file tidak boleh lebih dari ${usageControls.maxFileSizeUploadedInMB}MB`);
        if (documentInputRef.current) {
          documentInputRef.current.value = '';
        }
        return;
      }

      onSendDocument(file);
    }
    // Reset input
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2 py-3", isReplying ? "pt-0" : "")}>
        {/* WhatsApp-style floating rounded input container */}
        <div className={cn("flex items-center gap-2 bg-white px-2 py-1.5 shadow-md", isReplying ? "rounded-none rounded-b-[1.6rem]" : "rounded-full")}>
          {/* Attachment menu - only show if allowSendMedia is true */}
          {featureFlags.allowSendMedia && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || uploading}
                  aria-label="Attach file"
                  className="shrink-0"
                >
                  <PlusIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => imageInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>Image</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <VideoIcon className="h-4 w-4" />
                  <span>Video</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => documentInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <FileIcon className="h-4 w-4" />
                  <span>Document</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
          />
          <input
            ref={documentInputRef}
            type="file"
            accept=".doc,.docx,.pdf,.rtf,.odt,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp"
            onChange={handleDocumentSelect}
            className="hidden"
          />

          {/* Message input - only show if allowSendText is true */}
          {featureFlags.allowSendText ? (
            <>
              {/* Textarea field */}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleMessageChange}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan"
                disabled={disabled || uploading}
                rows={1}
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-[15px] shadow-none resize-none overflow-y-auto outline-none"
                style={{ minHeight: '24px', maxHeight: '120px' }}
              />

              {/* Send button */}
              <Button
                type="submit"
                size="icon"
                disabled={!message.trim() || disabled || uploading}
                className="shrink-0 rounded-full h-10 w-10"
              >
                <SendIcon className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Sending messages is disabled
            </div>
          )}
        </div>

        {/* Character counter - only show when typing and near limit */}
        {featureFlags.allowSendText && message.length > MAX_TEXT_LENGTH * 0.8 && (
          <div className="flex justify-end px-2">
            <span
              className={`text-[10px] ${
                message.length > MAX_TEXT_LENGTH * 0.95
                  ? 'text-destructive font-semibold'
                  : message.length > MAX_TEXT_LENGTH * 0.9
                  ? 'text-orange-500 font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {message.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}
            </span>
          </div>
        )}
      </form>

      {/* Compression dialog */}
      <Dialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Send {compressionFileType === 'image' ? 'Image' : 'Video'}
            </DialogTitle>
            <DialogDescription>
              Would you like to compress the {compressionFileType} before sending?
              {compressionFileType === 'image' && ' (80% quality)'}
              {compressionFileType === 'video' && ' (30% quality, 720p)'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPendingImageFile(null);
                setPendingVideoFile(null);
                setShowCompressionDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (compressionFileType === 'image') {
                  handleImageUpload(false);
                } else {
                  handleVideoUpload(false);
                }
              }}
            >
              Send Original
            </Button>
            <Button
              onClick={() => {
                if (compressionFileType === 'image') {
                  handleImageUpload(true);
                } else {
                  handleVideoUpload(true);
                }
              }}
            >
              Compress & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
