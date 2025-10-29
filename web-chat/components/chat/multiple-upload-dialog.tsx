'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageIcon, VideoIcon, FileIcon, X, Plus, SendIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MultipleUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  fileType: 'image' | 'video' | 'document';
  onUpload: (files: File[], caption: string, shouldCompress: boolean) => Promise<void>;
  onAddMore?: () => void;
}

export function MultipleUploadDialog({
  open,
  onOpenChange,
  files: initialFiles,
  fileType,
  onUpload,
  onAddMore,
}: MultipleUploadDialogProps) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Generate preview URLs for images/videos
  useEffect(() => {
    if (fileType === 'image' || fileType === 'video') {
      const newPreviews: Record<string, string> = {};

      files.forEach((file, index) => {
        const key = `${file.name}-${index}`;
        if (!previews[key]) {
          newPreviews[key] = URL.createObjectURL(file);
        }
      });

      setPreviews(prev => ({ ...prev, ...newPreviews }));

      // Cleanup old previews
      return () => {
        Object.values(newPreviews).forEach(url => URL.revokeObjectURL(url));
      };
    }
  }, [files, fileType]);

  // Update files when initialFiles changes
  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);

    // If no files left, close dialog
    if (newFiles.length === 0) {
      onOpenChange(false);
      return;
    }

    // Adjust current index if needed
    if (currentIndex >= newFiles.length) {
      setCurrentIndex(newFiles.length - 1);
    }
  };

  const handleUpload = async (shouldCompress: boolean) => {
    if (files.length === 0) return;

    // Save files reference before closing
    const filesToUpload = [...files];

    // Close dialog immediately
    onOpenChange(false);

    // Cleanup preview URLs
    Object.values(previews).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    // Reset state
    setFiles([]);
    setCurrentIndex(0);
    setPreviews({});

    // Upload in background
    try {
      await onUpload(filesToUpload, '', shouldCompress);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Gagal mengupload file');
    }
  };

  const currentFile = files[currentIndex];
  const currentPreview = currentFile ? previews[`${currentFile.name}-${currentIndex}`] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[80vh] p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-semibold">
              {fileType === 'image' ? 'Send Images' : fileType === 'video' ? 'Send Videos' : 'Send Documents'}
            </DialogTitle>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-muted-foreground">
                {currentIndex + 1} / {files.length}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {fileType === 'document' ? (
            /* Document list view */
            <div className="flex-1 overflow-y-auto px-6 space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 transition-colors",
                    index === currentIndex ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setCurrentIndex(index)}
                >
                  <FileIcon className="h-8 w-8 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{file.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            /* Image/Video preview with thumbnails */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Main preview */}
              <div className="flex-1 bg-black/5 flex items-center justify-center relative">
                {currentPreview && (
                  <>
                    {fileType === 'image' ? (
                      <img
                        src={currentPreview}
                        alt={currentFile.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <video
                        src={currentPreview}
                        controls
                        className="max-w-full max-h-full"
                      />
                    )}
                    {/* Remove button overlay */}
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-4 right-4 h-10 w-10 rounded-full"
                      onClick={() => removeFile(currentIndex)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </>
                )}
              </div>

              {/* Thumbnail strip */}
              <div className="border-t bg-background">
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {files.map((file, index) => {
                    const preview = previews[`${file.name}-${index}`];
                    return (
                      <button
                        key={`${file.name}-${index}`}
                        className={cn(
                          "relative shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all",
                          index === currentIndex
                            ? "border-primary ring-2 ring-primary"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setCurrentIndex(index)}
                      >
                        {preview && (
                          fileType === 'image' ? (
                            <img
                              src={preview}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={preview}
                              className="w-full h-full object-cover"
                            />
                          )
                        )}
                        {/* Video indicator */}
                        {fileType === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <VideoIcon className="h-6 w-6 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Add more button */}
                  {onAddMore && (
                    <button
                      className="shrink-0 w-16 h-16 rounded border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-colors"
                      onClick={onAddMore}
                    >
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with send buttons */}
        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <div className="flex gap-2">
              {fileType !== 'document' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleUpload(false)}
                  >
                    Send Original
                  </Button>
                  <Button
                    onClick={() => handleUpload(true)}
                    className="gap-2"
                  >
                    <SendIcon className="h-4 w-4" />
                    Compress & Send ({files.length})
                  </Button>
                </>
              )}
              {fileType === 'document' && (
                <Button
                  onClick={() => handleUpload(false)}
                  className="gap-2"
                >
                  <SendIcon className="h-4 w-4" />
                  Send {files.length} Document{files.length > 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
