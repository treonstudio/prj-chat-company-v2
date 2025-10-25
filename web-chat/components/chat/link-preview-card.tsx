'use client';

import { ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { LinkPreview } from '@/types/models';

interface LinkPreviewCardProps {
  preview: LinkPreview;
  isMe: boolean;
}

export function LinkPreviewCard({ preview, isMe }: LinkPreviewCardProps) {
  const handleClick = () => {
    window.open(preview.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="mt-2 overflow-hidden rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={handleClick}
    >
      {/* Image thumbnail */}
      {preview.image && (
        <div className="relative w-full h-48 bg-muted">
          <Image
            src={preview.image}
            alt={preview.title || 'Link preview'}
            fill
            className="object-cover"
            sizes="(max-width: 330px) 100vw, 330px"
            onError={(e) => {
              // Hide image on error
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-1">
        {/* Site name or domain */}
        {(preview.siteName || preview.url) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {preview.favicon && (
              <Image
                src={preview.favicon}
                alt=""
                width={12}
                height={12}
                className="rounded-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className="truncate">
              {preview.siteName || new URL(preview.url).hostname}
            </span>
          </div>
        )}

        {/* Title */}
        {preview.title && (
          <h4 className="text-sm font-semibold line-clamp-2 text-foreground">
            {preview.title}
          </h4>
        )}

        {/* Description */}
        {preview.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {preview.description}
          </p>
        )}

        {/* URL */}
        <div className="flex items-center gap-1 text-xs text-primary pt-1">
          <ExternalLink className="h-3 w-3" />
          <span className="truncate">{preview.url}</span>
        </div>
      </div>
    </div>
  );
}
