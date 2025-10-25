import React from 'react';

/**
 * Convert URLs in text to clickable links
 */
export function linkifyText(text: string, isMe: boolean = false): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const index = match.index;

    // Add text before URL
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }

    // Add URL as clickable link with appropriate color for sender/receiver
    parts.push(
      <a
        key={`link-${index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline hover:opacity-80 break-all ${isMe ? 'message-link-me' : 'message-link-other'}`}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {url}
      </a>
    );

    lastIndex = index + url.length;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Check if text contains any URLs
 */
export function hasLinks(text: string): boolean {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return urlRegex.test(text);
}
