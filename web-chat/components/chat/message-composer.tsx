'use client';

import { useState, useRef, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImageIcon, VideoIcon, FileIcon, PlusIcon, SendIcon } from 'lucide-react';

interface MessageComposerProps {
  onSendText: (text: string) => void;
  onSendImage: (file: File, shouldCompress: boolean) => void;
  onSendVideo: (file: File) => void;
  onSendDocument: (file: File) => void;
  disabled?: boolean;
  uploading?: boolean;
}

export function MessageComposer({
  onSendText,
  onSendImage,
  onSendVideo,
  onSendDocument,
  disabled = false,
  uploading = false,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendText(message);
      setMessage('');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setPendingImageFile(file);
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
    if (file && file.type.startsWith('video/')) {
      onSendVideo(file);
    }
    // Reset input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendDocument(file);
    }
    // Reset input
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3">
        {/* Attachment menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || uploading}
              aria-label="Attach file"
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
          accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
          onChange={handleDocumentSelect}
          className="hidden"
        />

        {/* Message input */}
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
          disabled={disabled || uploading}
          className="flex-1"
        />

        {/* Send button */}
        <Button type="submit" size="icon" disabled={!message.trim() || disabled || uploading}>
          <SendIcon className="h-5 w-5" />
        </Button>
      </form>

      {/* Compression dialog */}
      {showCompressionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Send Image</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Would you like to compress the image before sending?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setPendingImageFile(null);
                  setShowCompressionDialog(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleImageUpload(false)}
              >
                Send Original
              </Button>
              <Button onClick={() => handleImageUpload(true)}>
                Compress & Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
