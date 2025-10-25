'use client';

import { useEffect, useRef } from 'react';
import { OfflineUploadQueue, PendingUpload } from '@/lib/utils/offline-queue';

/**
 * Upload Queue Manager Hook
 *
 * Manages pending uploads with file storage in memory.
 * Note: Files are lost on page refresh (localStorage can't store File objects)
 *
 * This hook provides:
 * - In-memory File storage (uploadId -> File)
 * - Metadata persistence (localStorage)
 * - Auto-cleanup of stale uploads on mount
 */
export function useUploadQueue() {
  // Store File objects in memory (lost on page refresh)
  const fileStorageRef = useRef<Map<string, File>>(new Map());

  // Cleanup stale uploads on mount (files that don't have File objects in memory)
  useEffect(() => {
    const pendingUploads = OfflineUploadQueue.getPendingUploads();

    if (pendingUploads.length > 0) {
      console.log('[UploadQueue] Cleaning up stale uploads (files lost on page refresh)');

      // Remove all pending uploads since we don't have the files anymore
      pendingUploads.forEach(upload => {
        OfflineUploadQueue.removePendingUpload(upload.id);
      });
    }
  }, []);

  /**
   * Add upload to queue
   */
  const queueUpload = (
    chatId: string,
    file: File,
    fileType: 'image' | 'video' | 'document',
    shouldCompress: boolean,
    isGroupChat: boolean,
    currentUserId: string,
    currentUserName: string,
    currentUserAvatar?: string
  ): string => {
    // Generate upload ID
    const uploadId = OfflineUploadQueue.addPendingUpload(
      chatId,
      file,
      fileType,
      shouldCompress,
      isGroupChat,
      currentUserId,
      currentUserName,
      currentUserAvatar
    );

    // Store File object in memory
    if (uploadId) {
      fileStorageRef.current.set(uploadId, file);
      console.log('[UploadQueue] Queued upload:', uploadId, file.name);
    }

    return uploadId;
  };

  /**
   * Get File object from memory
   */
  const getFile = (uploadId: string): File | undefined => {
    return fileStorageRef.current.get(uploadId);
  };

  /**
   * Remove upload from queue
   */
  const removeUpload = (uploadId: string): void => {
    OfflineUploadQueue.removePendingUpload(uploadId);
    fileStorageRef.current.delete(uploadId);
    console.log('[UploadQueue] Removed upload:', uploadId);
  };

  /**
   * Get all pending uploads for a chat
   */
  const getPendingUploadsForChat = (chatId: string): PendingUpload[] => {
    const allPending = OfflineUploadQueue.getPendingUploads();
    return allPending.filter(upload => upload.chatId === chatId);
  };

  /**
   * Increment retry count
   */
  const incrementRetryCount = (uploadId: string): void => {
    OfflineUploadQueue.incrementRetryCount(uploadId);
  };

  /**
   * Check if should retry
   */
  const shouldRetry = (uploadId: string): boolean => {
    return OfflineUploadQueue.shouldRetry(uploadId);
  };

  return {
    queueUpload,
    getFile,
    removeUpload,
    getPendingUploadsForChat,
    incrementRetryCount,
    shouldRetry,
  };
}
