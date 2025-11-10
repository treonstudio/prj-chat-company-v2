'use client';

import { useState } from 'react';
import { Message } from '@/types/models';
import { LazyImage } from './lazy-image';
import { Download, Eye } from 'lucide-react';
import { getImageGridClass, getImageAspectRatio } from '@/lib/utils/message-grouping';
import { cn } from '@/lib/utils';
import download from 'downloadjs';
import { MediaPreviewModal } from './media-preview-modal';

interface ImageGroupProps {
  messages: Message[];
  isMe: boolean;
}

export function ImageGroup({ messages, isMe }: ImageGroupProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const imageCount = messages.length;
  const gridClass = getImageGridClass(imageCount);

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set(prev).add(index));
  };

  const handleDownload = async (url: string, index: number) => {
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      download(blob, `image-${index + 1}.jpg`, blob.type);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const openPreview = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closePreview = () => {
    setSelectedImageIndex(null);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedImageIndex === null) return;

    if (direction === 'prev' && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    } else if (direction === 'next' && selectedImageIndex < imageCount - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  return (
    <>
      <div
        className={cn(
          'grid gap-1',
          gridClass,
          imageCount === 1 ? 'max-w-[330px]' : 'max-w-[400px]',
          imageCount === 3 ? 'grid-rows-2' : '' // For 3 images: 2 rows
        )}
      >
        {messages.map((message, index) => {
          const aspectClass = getImageAspectRatio(imageCount, index);

          return (
            <div
              key={message.messageId}
              className={cn(
                'relative group overflow-hidden rounded-md bg-muted',
                aspectClass,
                // For 3 images: first image spans 2 rows on the left
                imageCount === 3 && index === 0 ? 'row-span-2' : '',
                // Hide images beyond 4 for 5+ image groups
                imageCount > 4 && index >= 4 ? 'hidden' : ''
              )}
              style={{
                minWidth: imageCount === 1 ? '200px' : '100px',
                minHeight: imageCount === 1 ? '200px' : '100px',
              }}
            >
              {/* Show "+N more" overlay for 5+ images on the 4th image */}
              {imageCount > 4 && index === 3 && (
                <div
                  className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 cursor-pointer"
                  onClick={() => openPreview(index)}
                >
                  <span className="text-white text-2xl font-semibold">
                    +{imageCount - 4}
                  </span>
                </div>
              )}

              <div
                className="w-full h-full cursor-pointer"
                onClick={() => openPreview(index)}
              >
                <LazyImage
                  src={message.mediaUrl || ''}
                  alt={`Image ${index + 1}`}
                  fill
                  className={cn(
                    'object-cover',
                    imageCount === 1 ? 'object-contain' : ''
                  )}
                  onLoadEnd={() => handleImageLoad(index)}
                />
              </div>

              {/* Hover overlay with buttons */}
              {loadedImages.has(index) && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(index);
                      }}
                      className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                      title="View full size"
                    >
                      <Eye className="h-3.5 w-3.5 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(message.mediaUrl || '', index);
                      }}
                      className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5 text-white" />
                    </button>
                  </div>
                </div>
              )}

              {/* Image count badge for first image */}
              {index === 0 && imageCount > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  {imageCount} photos
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full screen image preview modal with zoom and pan */}
      {selectedImageIndex !== null && (
        <MediaPreviewModal
          isOpen={true}
          onClose={closePreview}
          mediaUrl={messages[selectedImageIndex].mediaUrl || ''}
          mediaType="image"
          fileName={`image-${selectedImageIndex + 1}.jpg`}
          mimeType="image/jpeg"
          onDownload={() => handleDownload(messages[selectedImageIndex].mediaUrl || '', selectedImageIndex)}
          downloading={downloading}
          totalImages={imageCount}
          currentImageIndex={selectedImageIndex}
          onNavigate={navigateImage}
        />
      )}
    </>
  );
}
