import { Message } from '@/types/models';

/**
 * Groups consecutive IMAGE messages from the same sender within a 2-minute window
 * for visual display (Android-style grouped images)
 *
 * @param messages - Array of messages to group
 * @returns Array of message groups, where each group contains one or more messages
 */
export interface MessageGroup {
  type: 'single' | 'image-group';
  messages: Message[];
  senderId: string;
  timestamp?: any; // Use first message timestamp
}

export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentImageGroup: Message[] = [];
  let currentSenderId: string | null = null;
  let lastTimestamp: Date | null = null;

  const TIME_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

  // Helper to convert timestamp to Date
  const timestampToDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    return null;
  };

  // Helper to flush current image group
  const flushImageGroup = () => {
    if (currentImageGroup.length > 0) {
      if (currentImageGroup.length === 1) {
        // Single image - add as regular single message
        groups.push({
          type: 'single',
          messages: [currentImageGroup[0]],
          senderId: currentImageGroup[0].senderId,
          timestamp: currentImageGroup[0].timestamp,
        });
      } else {
        // Multiple images - add as image group
        groups.push({
          type: 'image-group',
          messages: currentImageGroup,
          senderId: currentImageGroup[0].senderId,
          timestamp: currentImageGroup[0].timestamp,
        });
      }
      currentImageGroup = [];
      currentSenderId = null;
      lastTimestamp = null;
    }
  };

  for (const message of messages) {
    const messageTime = timestampToDate(message.timestamp);

    // Check if this message can be grouped with previous images
    const canGroup =
      message.type === 'IMAGE' &&
      currentSenderId === message.senderId &&
      messageTime &&
      lastTimestamp &&
      Math.abs(messageTime.getTime() - lastTimestamp.getTime()) <= TIME_WINDOW_MS;

    if (message.type === 'IMAGE' && (canGroup || currentImageGroup.length === 0)) {
      // Add to current group
      currentImageGroup.push(message);
      currentSenderId = message.senderId;
      lastTimestamp = messageTime;
    } else {
      // Flush current group and start new
      flushImageGroup();

      if (message.type === 'IMAGE') {
        // Start new image group
        currentImageGroup.push(message);
        currentSenderId = message.senderId;
        lastTimestamp = messageTime;
      } else {
        // Non-image message - add as single
        groups.push({
          type: 'single',
          messages: [message],
          senderId: message.senderId,
          timestamp: message.timestamp,
        });
      }
    }
  }

  // Flush any remaining image group
  flushImageGroup();

  return groups;
}

/**
 * Get the appropriate grid layout class based on number of images
 */
export function getImageGridClass(imageCount: number): string {
  switch (imageCount) {
    case 1:
      return 'grid-cols-1'; // Single column
    case 2:
      return 'grid-cols-2'; // Two columns side by side
    case 3:
      return 'grid-cols-2'; // 2 columns (special layout: 1 large + 2 stacked)
    case 4:
      return 'grid-cols-2'; // 2x2 grid
    default:
      return 'grid-cols-2'; // 2x2 grid for 5+ images (show first 4)
  }
}

/**
 * Get the appropriate aspect ratio for grouped images
 */
export function getImageAspectRatio(imageCount: number, index: number): string {
  if (imageCount === 1) {
    return 'aspect-auto max-h-[330px]'; // Same as original single image
  } else {
    return 'aspect-square'; // Square for all grid items (2, 3, 4+ images)
  }
}
