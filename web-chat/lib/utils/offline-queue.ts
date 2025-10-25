import { Message, MessageType } from '@/types/models';

/**
 * Offline Queue Manager
 * Stores pending messages in localStorage for offline support
 */

export interface PendingMessage {
  id: string;
  chatId: string;
  message: Message;
  isGroupChat: boolean;
  createdAt: number;
  retryCount: number;
}

export interface PendingUpload {
  id: string;
  chatId: string;
  file: {
    name: string;
    type: string;
    size: number;
    lastModified: number;
  };
  fileType: 'image' | 'video' | 'document';
  shouldCompress: boolean;
  isGroupChat: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  createdAt: number;
  retryCount: number;
}

const PENDING_MESSAGES_KEY = 'chatku_pending_messages';
const PENDING_UPLOADS_KEY = 'chatku_pending_uploads';
const MAX_RETRY_COUNT = 3;
const MAX_PENDING_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Message Queue Operations
 */
export class OfflineMessageQueue {
  /**
   * Add message to pending queue
   */
  static addPendingMessage(
    chatId: string,
    message: Message,
    isGroupChat: boolean
  ): void {
    try {
      const pending: PendingMessage = {
        id: message.messageId,
        chatId,
        message,
        isGroupChat,
        createdAt: Date.now(),
        retryCount: 0,
      };

      const queue = this.getPendingMessages();
      queue.push(pending);

      localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(queue));
      console.log('[OfflineQueue] Message added to queue:', pending.id);
    } catch (error) {
      console.error('[OfflineQueue] Failed to add message to queue:', error);
    }
  }

  /**
   * Get all pending messages
   */
  static getPendingMessages(): PendingMessage[] {
    try {
      const stored = localStorage.getItem(PENDING_MESSAGES_KEY);
      if (!stored) return [];

      const queue: PendingMessage[] = JSON.parse(stored);

      // Filter out old messages
      const now = Date.now();
      const filtered = queue.filter(
        item => now - item.createdAt < MAX_PENDING_AGE_MS
      );

      // Update storage if filtered
      if (filtered.length !== queue.length) {
        localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(filtered));
      }

      return filtered;
    } catch (error) {
      console.error('[OfflineQueue] Failed to get pending messages:', error);
      return [];
    }
  }

  /**
   * Get pending messages for specific chat
   */
  static getPendingMessagesForChat(chatId: string): PendingMessage[] {
    return this.getPendingMessages().filter(item => item.chatId === chatId);
  }

  /**
   * Remove message from queue
   */
  static removePendingMessage(messageId: string): void {
    try {
      const queue = this.getPendingMessages();
      const filtered = queue.filter(item => item.id !== messageId);

      localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(filtered));
      console.log('[OfflineQueue] Message removed from queue:', messageId);
    } catch (error) {
      console.error('[OfflineQueue] Failed to remove message:', error);
    }
  }

  /**
   * Increment retry count
   */
  static incrementRetryCount(messageId: string): void {
    try {
      const queue = this.getPendingMessages();
      const updated = queue.map(item => {
        if (item.id === messageId) {
          return { ...item, retryCount: item.retryCount + 1 };
        }
        return item;
      });

      localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[OfflineQueue] Failed to increment retry count:', error);
    }
  }

  /**
   * Check if message should be retried
   */
  static shouldRetry(messageId: string): boolean {
    const queue = this.getPendingMessages();
    const item = queue.find(msg => msg.id === messageId);
    return item ? item.retryCount < MAX_RETRY_COUNT : false;
  }

  /**
   * Clear all pending messages
   */
  static clearAll(): void {
    localStorage.removeItem(PENDING_MESSAGES_KEY);
  }
}

/**
 * Upload Queue Operations
 */
export class OfflineUploadQueue {
  /**
   * Add upload to pending queue
   * Note: Cannot store actual File object in localStorage
   * So we store metadata and skip actual file
   */
  static addPendingUpload(
    chatId: string,
    file: File,
    fileType: 'image' | 'video' | 'document',
    shouldCompress: boolean,
    isGroupChat: boolean,
    currentUserId: string,
    currentUserName: string,
    currentUserAvatar?: string
  ): string {
    try {
      const id = `upload_${Date.now()}_${Math.random()}`;

      const pending: PendingUpload = {
        id,
        chatId,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
        },
        fileType,
        shouldCompress,
        isGroupChat,
        currentUserId,
        currentUserName,
        currentUserAvatar,
        createdAt: Date.now(),
        retryCount: 0,
      };

      const queue = this.getPendingUploads();
      queue.push(pending);

      localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(queue));
      console.log('[OfflineQueue] Upload added to queue:', id);

      return id;
    } catch (error) {
      console.error('[OfflineQueue] Failed to add upload to queue:', error);
      return '';
    }
  }

  /**
   * Get all pending uploads
   */
  static getPendingUploads(): PendingUpload[] {
    try {
      const stored = localStorage.getItem(PENDING_UPLOADS_KEY);
      if (!stored) return [];

      const queue: PendingUpload[] = JSON.parse(stored);

      // Filter out old uploads
      const now = Date.now();
      const filtered = queue.filter(
        item => now - item.createdAt < MAX_PENDING_AGE_MS
      );

      if (filtered.length !== queue.length) {
        localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(filtered));
      }

      return filtered;
    } catch (error) {
      console.error('[OfflineQueue] Failed to get pending uploads:', error);
      return [];
    }
  }

  /**
   * Remove upload from queue
   */
  static removePendingUpload(uploadId: string): void {
    try {
      const queue = this.getPendingUploads();
      const filtered = queue.filter(item => item.id !== uploadId);

      localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(filtered));
      console.log('[OfflineQueue] Upload removed from queue:', uploadId);
    } catch (error) {
      console.error('[OfflineQueue] Failed to remove upload:', error);
    }
  }

  /**
   * Increment retry count
   */
  static incrementRetryCount(uploadId: string): void {
    try {
      const queue = this.getPendingUploads();
      const updated = queue.map(item => {
        if (item.id === uploadId) {
          return { ...item, retryCount: item.retryCount + 1 };
        }
        return item;
      });

      localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[OfflineQueue] Failed to increment retry count:', error);
    }
  }

  /**
   * Check if upload should be retried
   */
  static shouldRetry(uploadId: string): boolean {
    const queue = this.getPendingUploads();
    const item = queue.find(upload => upload.id === uploadId);
    return item ? item.retryCount < MAX_RETRY_COUNT : false;
  }

  /**
   * Clear all pending uploads
   */
  static clearAll(): void {
    localStorage.removeItem(PENDING_UPLOADS_KEY);
  }
}
