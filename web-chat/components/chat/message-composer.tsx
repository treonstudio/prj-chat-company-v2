'use client';

import { useState, useRef, FormEvent, useEffect, useLayoutEffect, memo } from 'react';
import { flushSync } from 'react-dom';
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
import { MultipleUploadDialog } from './multiple-upload-dialog';

interface MessageComposerProps {
  chatId: string;
  onSendText: (text: string) => void;
  onSendImage: (file: File, shouldCompress: boolean) => void | Promise<void>;
  onSendVideo: (file: File, shouldCompress: boolean) => void | Promise<void>;
  onSendDocument: (file: File) => void | Promise<void>;
  disabled?: boolean;
  uploading?: boolean;
  isReplying?: boolean;
}

function MessageComposerComponent({
  chatId,
  onSendText,
  onSendImage,
  onSendVideo,
  onSendDocument,
  disabled = false,
  uploading: parentUploading = false,
  isReplying = false,
}: MessageComposerProps) {
  const { draft, saveDraft, clearDraft } = useDraftMessage(chatId);
  const [message, setMessage] = useState('');
  const messageRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // CRITICAL: Use ONLY internal state for uploading to prevent parent re-render interference
  // Ignore parent uploading state completely to avoid conflicts
  const [internalUploading, setInternalUploading] = useState(false);
  const uploading = internalUploading; // ONLY use internal state

  // Debug: Log uploading state changes
  useEffect(() => {
    console.log('[MessageComposer] uploading state changed:', uploading, 'internal:', internalUploading, 'parent:', parentUploading, 'IGNORED');
    console.log('[MessageComposer] Button should be:', uploading ? 'DISABLED' : 'ENABLED');
  }, [uploading, internalUploading, parentUploading]);

  // Debug: Check actual DOM state after render
  useLayoutEffect(() => {
    if (attachButtonRef.current) {
      const isDisabled = attachButtonRef.current.disabled || attachButtonRef.current.getAttribute('data-disabled') === 'true';
      console.log('[MessageComposer DOM CHECK] Attach button actual state in DOM:', isDisabled ? 'DISABLED' : 'ENABLED', 'Expected:', uploading ? 'DISABLED' : 'ENABLED');
    }
  }, [uploading]);

  // Force re-mount DropdownMenu when upload completes to reset any internal state
  const prevUploadingRef = useRef(uploading);
  useEffect(() => {
    // Detect transition from uploading=true to uploading=false (upload completed)
    if (prevUploadingRef.current === true && uploading === false) {
      // Upload just completed - force DropdownMenu re-mount
      flushSync(() => {
        setDropdownKey(prev => prev + 1);
      });
      console.log('[MessageComposer] Force DropdownMenu re-mount - upload completed');
    }
    prevUploadingRef.current = uploading;
  }, [uploading]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [compressionFileType, setCompressionFileType] = useState<'image' | 'video'>('image');
  const [dropdownKey, setDropdownKey] = useState(0); // Force re-mount DropdownMenu

  // Multiple file upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; type: 'image' | 'video' | 'document' }[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [showMultipleUploadDialog, setShowMultipleUploadDialog] = useState(false);

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

  // Auto-focus input when replying
  useEffect(() => {
    if (isReplying && textareaRef.current) {
      // Multiple focus attempts to ensure it sticks
      // (scroll behavior in chat-room might steal focus)
      const focusInput = () => {
        // Use requestAnimationFrame to ensure focus happens after all DOM updates
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            textareaRef.current?.focus({ preventScroll: true });
          });
        });
      };

      // Schedule multiple focus attempts with increasing delays
      const timers = [
        setTimeout(focusInput, 100),   // Initial focus after reply bar renders
        setTimeout(focusInput, 300),   // After scroll/layout completes
        setTimeout(focusInput, 500),   // Final guarantee (catches edge cases)
      ];

      return () => timers.forEach(clearTimeout);
    }
  }, [isReplying]);

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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxSizeInBytes = usageControls.maxFileSizeUploadedInMB * 1024 * 1024;
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate all files
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        invalidFiles.push(`${file.name} (bukan gambar)`);
      } else if (file.size > maxSizeInBytes) {
        invalidFiles.push(`${file.name} (lebih dari ${usageControls.maxFileSizeUploadedInMB}MB)`);
      } else {
        validFiles.push(file);
      }
    });

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      toast.error(`File tidak valid: ${invalidFiles.join(', ')}`);
    }

    // Handle valid files
    if (validFiles.length > 0) {
      // If dialog already open, merge with existing files (Add More functionality)
      const isAddingMore = showMultipleUploadDialog && compressionFileType === 'image';

      if (isAddingMore) {
        // Merge with existing files
        setPendingFiles(prev => [...prev, ...validFiles]);
        toast.success(`${validFiles.length} gambar ditambahkan`);
      } else if (validFiles.length === 1 && !isAddingMore) {
        // Single file - use existing compression dialog
        setPendingImageFile(validFiles[0]);
        setCompressionFileType('image');
        setShowCompressionDialog(true);
      } else {
        // Multiple files - show multiple upload dialog
        setPendingFiles(validFiles);
        setCompressionFileType('image');
        setShowMultipleUploadDialog(true);
      }
    }

    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (shouldCompress: boolean) => {
    if (pendingImageFile) {
      const fileToSend = pendingImageFile;

      // Close dialog FIRST using flushSync to force synchronous update
      flushSync(() => {
        setPendingImageFile(null);
        setShowCompressionDialog(false);
      });

      // Then start upload
      flushSync(() => {
        setInternalUploading(true);
      });
      console.log('[MessageComposer] Setting internal uploading=true for image');

      try {
        await onSendImage(fileToSend, shouldCompress);
      } finally {
        console.log('[MessageComposer] Setting internal uploading=false for image');
        flushSync(() => {
          setInternalUploading(false);
        });
      }
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxSizeInBytes = usageControls.maxFileSizeUploadedInMB * 1024 * 1024;
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate all files
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('video/')) {
        invalidFiles.push(`${file.name} (bukan video)`);
      } else if (file.size > maxSizeInBytes) {
        invalidFiles.push(`${file.name} (lebih dari ${usageControls.maxFileSizeUploadedInMB}MB)`);
      } else {
        validFiles.push(file);
      }
    });

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      toast.error(`File tidak valid: ${invalidFiles.join(', ')}`);
    }

    // Handle valid files
    if (validFiles.length > 0) {
      // If dialog already open, merge with existing files (Add More functionality)
      const isAddingMore = showMultipleUploadDialog && compressionFileType === 'video';

      if (isAddingMore) {
        // Merge with existing files
        setPendingFiles(prev => [...prev, ...validFiles]);
        toast.success(`${validFiles.length} video ditambahkan`);
      } else if (validFiles.length === 1 && !isAddingMore) {
        // Single file - use existing compression dialog
        setPendingVideoFile(validFiles[0]);
        setCompressionFileType('video');
        setShowCompressionDialog(true);
      } else {
        // Multiple files - show multiple upload dialog
        setPendingFiles(validFiles);
        setCompressionFileType('video');
        setShowMultipleUploadDialog(true);
      }
    }

    // Reset input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (shouldCompress: boolean) => {
    if (pendingVideoFile) {
      const fileToSend = pendingVideoFile;

      // Close dialog FIRST using flushSync to force synchronous update
      flushSync(() => {
        setPendingVideoFile(null);
        setShowCompressionDialog(false);
      });

      // Then start upload
      flushSync(() => {
        setInternalUploading(true);
      });
      console.log('[MessageComposer] Setting internal uploading=true for video');

      try {
        await onSendVideo(fileToSend, shouldCompress);
      } finally {
        console.log('[MessageComposer] Setting internal uploading=false for video');
        flushSync(() => {
          setInternalUploading(false);
        });
      }
    }
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedExtensions = [
      // Documents
      '.doc', '.docx', '.pdf', '.rtf', '.odt',
      // Spreadsheets
      '.xls', '.xlsx', '.csv', '.ods',
      // Presentations
      '.ppt', '.pptx', '.odp',
      // Archives
      '.tar', '.gz', '.tar.gz', '.tgz', '.zip', '.rar', '.7z', '.bz2', '.tar.bz2'
    ];

    const allowedMimeTypes = [
      // Documents
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
      // Spreadsheets
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/vnd.oasis.opendocument.spreadsheet',
      // Presentations
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.oasis.opendocument.presentation',
      // Archives
      'application/zip',
      'application/vnd.rar',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
      'application/x-gzip',
      'application/x-bzip2',
      'application/x-compressed-tar'
    ];

    const maxSizeInBytes = usageControls.maxFileSizeUploadedInMB * 1024 * 1024;
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate all files
    Array.from(files).forEach(file => {
      const fileName = file.name.toLowerCase();
      const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
      const fileMimeType = file.type;

      // Check if file is allowed by either extension or MIME type
      const isAllowedExtension = allowedExtensions.includes(fileExtension);
      const isAllowedMimeType = allowedMimeTypes.includes(fileMimeType);

      if (!isAllowedExtension && !isAllowedMimeType) {
        invalidFiles.push(`${file.name} (format tidak didukung)`);
      } else if (file.size > maxSizeInBytes) {
        invalidFiles.push(`${file.name} (lebih dari ${usageControls.maxFileSizeUploadedInMB}MB)`);
      } else {
        validFiles.push(file);
      }
    });

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      toast.error(`File tidak valid: ${invalidFiles.join(', ')}`);
    }

    // Handle valid files
    if (validFiles.length > 0) {
      // If dialog already open, merge with existing files (Add More functionality)
      const isAddingMore = showMultipleUploadDialog && uploadQueue.length > 0;

      if (isAddingMore) {
        // Merge with existing files
        setUploadQueue(prev => [...prev, ...validFiles.map(file => ({ file, type: 'document' as const }))]);
        toast.success(`${validFiles.length} dokumen ditambahkan`);
      } else if (validFiles.length === 1 && !isAddingMore) {
        // Single file - upload directly
        const file = validFiles[0];
        flushSync(() => {
          setInternalUploading(true);
        });
        console.log('[MessageComposer] Setting internal uploading=true for document');

        try {
          await onSendDocument(file);
        } finally {
          console.log('[MessageComposer] Setting internal uploading=false for document');
          flushSync(() => {
            setInternalUploading(false);
          });
        }
      } else {
        // Multiple files - queue for upload
        setPendingFiles(validFiles);
        setUploadQueue(validFiles.map(file => ({ file, type: 'document' })));
        setShowMultipleUploadDialog(true);
      }
    }

    // Reset input
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  // Handle multiple file upload with compression option (WhatsApp-style)
  const handleMultipleUpload = async (files: File[], _caption: string, shouldCompress: boolean) => {
    if (files.length === 0) return;

    const fileType = compressionFileType;

    flushSync(() => {
      setInternalUploading(true);
    });

    console.log(`[MessageComposer] Uploading ${files.length} ${fileType}(s) with compression=${shouldCompress}`);

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentUploadIndex(i);

      try {
        console.log(`[MessageComposer] Uploading file ${i + 1}/${files.length}: ${file.name}`);

        if (fileType === 'image') {
          await onSendImage(file, shouldCompress);
        } else if (fileType === 'video') {
          await onSendVideo(file, shouldCompress);
        }

        // Small delay between uploads
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error(`[MessageComposer] Error uploading file ${file.name}:`, error);
        toast.error(`Gagal mengupload ${file.name}`);
      }
    }

    // Reset state
    flushSync(() => {
      setInternalUploading(false);
      setCurrentUploadIndex(0);
    });

    console.log('[MessageComposer] All files uploaded successfully');
    toast.success(`${files.length} file berhasil diupload`);
  };

  // Handle multiple document upload (no compression needed, WhatsApp-style)
  const handleMultipleDocumentUpload = async (files: File[], _caption: string, _shouldCompress: boolean) => {
    if (files.length === 0) return;

    flushSync(() => {
      setInternalUploading(true);
    });

    console.log(`[MessageComposer] Uploading ${files.length} document(s)`);

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentUploadIndex(i);

      try {
        console.log(`[MessageComposer] Uploading document ${i + 1}/${files.length}: ${file.name}`);
        await onSendDocument(file);

        // Small delay between uploads
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error(`[MessageComposer] Error uploading document ${file.name}:`, error);
        toast.error(`Gagal mengupload ${file.name}`);
      }
    }

    // Reset state
    flushSync(() => {
      setInternalUploading(false);
      setCurrentUploadIndex(0);
    });

    console.log('[MessageComposer] All documents uploaded successfully');
    toast.success(`${files.length} dokumen berhasil diupload`);
  };

  console.log("[MessageComposer] uploading state:", uploading);
  console.log("[MessageComposer] disabled state:", disabled);

  return (
    <>
      <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2 py-3", isReplying ? "pt-0" : "")}>
        {/* WhatsApp-style floating rounded input container */}
        <div className={cn("flex items-center gap-2 bg-white px-2 py-1.5 shadow-md", isReplying ? "rounded-none rounded-b-[1.6rem]" : "rounded-full")}>
          {/* Attachment menu - only show if allowSendMedia is true */}
          {featureFlags.allowSendMedia && (
            <DropdownMenu key={dropdownKey}>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={attachButtonRef}
                  type="button"
                  variant="ghost"
                  size="icon"
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
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleVideoSelect}
            className="hidden"
          />
          <input
            ref={documentInputRef}
            type="file"
            accept=".doc,.docx,.pdf,.rtf,.odt,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp,.tar,.gz,.tar.gz,.tgz,.zip,.rar,.7z,.bz2,.tar.bz2,application/zip,application/vnd.rar,application/x-7z-compressed,application/x-tar,application/gzip,application/x-bzip2"
            multiple
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
                disabled={disabled}
                rows={1}
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-[15px] shadow-none resize-none overflow-y-auto outline-none"
                style={{ minHeight: '24px', maxHeight: '120px' }}
              />

              {/* Send button */}
              <Button
                type="submit"
                size="icon"
                disabled={!message.trim() || disabled}
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

      {/* WhatsApp-style multiple file upload dialog */}
      <MultipleUploadDialog
        open={showMultipleUploadDialog}
        onOpenChange={(open) => {
          setShowMultipleUploadDialog(open);
          if (!open) {
            setPendingFiles([]);
            setUploadQueue([]);
          }
        }}
        files={uploadQueue.length > 0 ? uploadQueue.map(item => item.file) : pendingFiles}
        fileType={uploadQueue.length > 0 ? 'document' : compressionFileType}
        onUpload={uploadQueue.length > 0 ? handleMultipleDocumentUpload : handleMultipleUpload}
        onAddMore={() => {
          // Trigger file input again to add more files
          if (compressionFileType === 'image') {
            imageInputRef.current?.click();
          } else if (compressionFileType === 'video') {
            videoInputRef.current?.click();
          } else {
            documentInputRef.current?.click();
          }
        }}
      />
    </>
  );
}

// Export with React.memo and custom comparison
// CRITICAL: Ignore parent 'uploading' prop in comparison - we use internal state
export const MessageComposer = memo(MessageComposerComponent, (prevProps, nextProps) => {
  // Re-render ONLY if these props change
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.isReplying === nextProps.isReplying
    // NOTE: Intentionally ignore 'uploading' prop from parent
    // We use internal state management to prevent re-render interference
  );
});
