'use client';

import { useEffect, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { MessageRepository } from '@/lib/repositories/message.repository';
import { Message, MessageType, MessageStatus, ReplyTo } from '@/types/models';
import { Timestamp, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useMessageCache } from '@/lib/stores/message-cache.store';
import { extractUrls, fetchLinkPreview, LinkPreviewData } from '@/lib/utils/link-preview';
import { OfflineMessageQueue } from '@/lib/utils/offline-queue';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { useUploadManager } from '@/lib/stores/upload-manager.store';

const messageRepository = new MessageRepository();

// Helper function for retrying operations with exponential backoff
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Helper function to safely get milliseconds from timestamp (handles both Firestore Timestamp and plain objects from cache)
function getTimestampMillis(timestamp: any): number {
  if (!timestamp) return 0;

  // If it's a Firestore Timestamp object with toMillis method
  if (typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis();
  }

  // If it's a plain object from cache with seconds property
  if (timestamp.seconds !== undefined) {
    return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
  }

  return 0;
}

export function useMessages(chatId: string | null, isGroupChat: boolean, currentUserId?: string) {
  // Global upload manager (persists across chat switches)
  const uploadManager = useUploadManager();

  // Zustand cache store (get this first for lazy init)
  const {
    getMessages: getCachedMessages,
    setMessages: setCachedMessages,
    addMessage: addCachedMessage,
    updateMessage: updateCachedMessage,
    deleteMessage: deleteCachedMessage,
    clearChatHistory: clearCachedHistory
  } = useMessageCache();

  // CRITICAL: Lazy initialize to prevent skeleton flash
  // Check cache synchronously on first render to avoid loading state flicker
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!chatId) return [];
    const cached = getCachedMessages(chatId);
    return cached && cached.length > 0 ? cached : [];
  });

  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  // CRITICAL: Start with loading=false if we have cached data
  const [loading, setLoading] = useState(() => {
    if (!chatId) return false;
    const cached = getCachedMessages(chatId);
    return !(cached && cached.length > 0); // Only loading if no cache
  });

  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMessage, setUploadingMessage] = useState<Message | null>(null);
  const [userJoinedAt, setUserJoinedAt] = useState<Timestamp | null>(null);
  const [deleteHistoryTimestamp, setDeleteHistoryTimestamp] = useState<Timestamp | null>(null);

  // Track abort controllers for ongoing uploads (key: tempId, value: AbortController)
  const [uploadAbortControllers] = useState<Map<string, AbortController>>(new Map());

  // Track pending uploads (lost on page refresh since Files can't be stored)
  const [pendingUploads] = useState<Map<string, {
    file: File;
    fileType: 'image' | 'video' | 'document';
    shouldCompress: boolean;
    userId: string;
    userName: string;
    userAvatar?: string;
  }>>(new Map());

  // Monitor online status for auto-send pending messages
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    // Reset state when chatId changes
    setUploadingMessage(null);
    setUploading(false);
    setOptimisticMessages([]);
    setUserJoinedAt(null);
    setDeleteHistoryTimestamp(null);

    // DON'T cancel ongoing uploads when switching chats
    // Uploads now persist in global upload manager
    // uploadAbortControllers.forEach(controller => controller.abort());
    // uploadAbortControllers.clear();

    // DON'T clear pending uploads - they should persist across chat switches
    // pendingUploads.clear();

    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // INSTANT LOAD: Check cache first (WhatsApp-like experience)
    // Note: On first mount, lazy init already loaded cache, but we still need this
    // for when chatId changes (navigating between different chats)
    const cachedMessages = getCachedMessages(chatId);
    if (cachedMessages && cachedMessages.length > 0) {
      console.log(`[Cache] Loading ${cachedMessages.length} messages from cache for ${chatId}`);
      setMessages(cachedMessages);
      setLoading(false); // Show cached data immediately, no loading state!
    } else {
      setMessages([]); // Clear old messages
      setLoading(true); // Only show loading if no cache
    }

    // CRITICAL: Load group join date and deleteHistory BEFORE subscribing to messages
    // This prevents race conditions where messages load before we know the filter timestamp
    const setupMessageListener = async () => {
      let joinedAtTimestamp: Timestamp | null = null;
      let deleteHistoryTs: Timestamp | null = null;

      // Load deleteHistory and join date from chat document
      if (currentUserId) {
        try {
          const collection = isGroupChat ? 'groupChats' : 'directChats';
          const chatRef = doc(db(), collection, chatId);
          const chatDoc = await getDoc(chatRef);

          if (chatDoc.exists()) {
            const chatData = chatDoc.data();

            // Get deleteHistory for current user
            const deleteHistory = chatData?.deleteHistory || {};
            deleteHistoryTs = deleteHistory[currentUserId] || null;
            setDeleteHistoryTimestamp(deleteHistoryTs);

            // For group chats, also get join date
            if (isGroupChat) {
              const usersJoinedAt = chatData?.usersJoinedAt || {};
              joinedAtTimestamp = usersJoinedAt[currentUserId] || null;
              setUserJoinedAt(joinedAtTimestamp);
            }
          }
        } catch (err) {
          console.error('Error loading chat metadata:', err);
          // Continue without filtering if we can't load metadata
        }
      }

      // Now subscribe to messages with filtering applied
      const unsubscribe = messageRepository.getMessages(
        chatId,
        isGroupChat,
        (messages) => {
          // CRITICAL: Filter messages based on user's join date and deleteHistory
          let filteredMessages = messages;

          // Apply deleteHistory filter (for both group and direct chats)
          if (deleteHistoryTs) {
            filteredMessages = filteredMessages.filter(msg => {
              if (!msg.timestamp) return true;
              return getTimestampMillis(msg.timestamp) > getTimestampMillis(deleteHistoryTs);
            });
          }

          // Apply join date filter (only for group chats)
          if (isGroupChat && joinedAtTimestamp) {
            filteredMessages = filteredMessages.filter(msg => {
              if (!msg.timestamp) return true;
              return getTimestampMillis(msg.timestamp) >= getTimestampMillis(joinedAtTimestamp);
            });
          }

          setMessages(filteredMessages);

          // SYNC TO CACHE: Keep cache updated for instant loading next time
          setCachedMessages(chatId, filteredMessages);

          setLoading(false);
          setError(null);

          // Remove optimistic messages that have been confirmed
          // This is a safety cleanup - normally optimistic messages are removed on success
          // This handles edge cases where cleanup didn't happen
          const realTempIds = new Set<string>();
          filteredMessages.forEach(msg => {
            if ('tempId' in msg && msg.tempId) {
              realTempIds.add(msg.tempId);
            }
          });

          setOptimisticMessages(prev => {
            // Safety cleanup: Remove any temp message that has a real counterpart
            return prev.filter(optMsg => {
              if (!optMsg.messageId.startsWith('temp_')) {
                return false;
              }
              // Remove if real message exists
              return !realTempIds.has(optMsg.messageId);
            });
          });
        },
        (error) => {
          setError(error);
          setLoading(false);
        },
        currentUserId
      );

      return unsubscribe;
    };

    let unsubscribePromise = setupMessageListener();

    return () => {
      unsubscribePromise.then(unsubscribe => unsubscribe());
    };
  }, [chatId, isGroupChat, currentUserId]);

  // REAL-TIME: Listen to deleteHistory changes
  useEffect(() => {
    if (!chatId || !currentUserId) return;

    const collection = isGroupChat ? 'groupChats' : 'directChats';
    const chatRef = doc(db(), collection, chatId);

    // Set up real-time listener for chat document changes
    const unsubscribe = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const chatData = snapshot.data();
        const deleteHistory = chatData?.deleteHistory || {};
        const newDeleteHistoryTs = deleteHistory[currentUserId] || null;

        // Update state if deleteHistory timestamp changed
        setDeleteHistoryTimestamp(newDeleteHistoryTs);

        // Re-filter messages based on new timestamp
        setMessages((currentMessages) => {
          if (!newDeleteHistoryTs) return currentMessages;

          const filteredMessages = currentMessages.filter(msg => {
            if (!msg.timestamp) return true;
            return getTimestampMillis(msg.timestamp) > getTimestampMillis(newDeleteHistoryTs);
          });

          // Update cache with filtered messages
          setCachedMessages(chatId, filteredMessages);
          return filteredMessages;
        });
      }
    });

    return () => unsubscribe();
  }, [chatId, isGroupChat, currentUserId]);

  // RESTORE: Load pending messages from localStorage on mount
  useEffect(() => {
    if (!chatId) return;

    const pendingMessages = OfflineMessageQueue.getPendingMessagesForChat(chatId);

    if (pendingMessages.length > 0) {
      console.log('[OfflineQueue] Restoring', pendingMessages.length, 'pending messages');

      // Add pending messages to optimistic messages
      const restoredMessages = pendingMessages.map(pending => ({
        ...pending.message,
        status: MessageStatus.PENDING,
      }));

      setOptimisticMessages(prev => [...restoredMessages, ...prev]);
    }
  }, [chatId]); // Only run when chatId changes

  // AUTO-SEND: Send pending messages when coming back online
  useEffect(() => {
    if (!isOnline || !chatId) return;

    // Get pending messages for this chat
    const pendingMessages = OfflineMessageQueue.getPendingMessagesForChat(chatId);

    if (pendingMessages.length === 0) return;

    console.log('[OfflineQueue] Sending', pendingMessages.length, 'pending messages');

    // Send each pending message
    pendingMessages.forEach(async (pending) => {
      // Check if we should retry this message
      if (!OfflineMessageQueue.shouldRetry(pending.id)) {
        console.log('[OfflineQueue] Message exceeded retry count:', pending.id);
        OfflineMessageQueue.removePendingMessage(pending.id);

        // Update UI to show as failed
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === pending.id
              ? { ...msg, status: MessageStatus.FAILED, error: 'Message exceeded retry limit' }
              : msg
          )
        );
        return;
      }

      // Update UI to show as sending
      setOptimisticMessages(prev =>
        prev.map(msg =>
          msg.messageId === pending.id
            ? { ...msg, status: MessageStatus.SENDING }
            : msg
        )
      );

      try {
        // Send the message
        const result = await messageRepository.sendMessage(
          pending.chatId,
          pending.message,
          pending.isGroupChat
        );

        if (result.status === 'success') {
          // Success - remove from queue
          console.log('[OfflineQueue] Message sent successfully:', pending.id);
          OfflineMessageQueue.removePendingMessage(pending.id);

          // Remove from optimistic messages (real message will appear from listener)
          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== pending.id)
          );
        } else {
          // Failed - increment retry count
          const errorMessage = result.status === 'error' ? result.message : 'Unknown error';
          console.log('[OfflineQueue] Message send failed:', pending.id, errorMessage);
          OfflineMessageQueue.incrementRetryCount(pending.id);

          // Update UI to show as failed
          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === pending.id
                ? { ...msg, status: MessageStatus.FAILED, error: errorMessage }
                : msg
            )
          );
        }
      } catch (error: any) {
        // Error - increment retry count
        console.error('[OfflineQueue] Error sending message:', pending.id, error);
        OfflineMessageQueue.incrementRetryCount(pending.id);

        // Update UI to show as failed
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === pending.id
              ? { ...msg, status: MessageStatus.FAILED, error: error.message || 'Failed to send message' }
              : msg
          )
        );
      }
    });
  }, [isOnline, chatId]);

  // AUTO-SEND: Send pending uploads when coming back online
  useEffect(() => {
    if (!isOnline || !chatId || pendingUploads.size === 0) return;

    console.log('[UploadQueue] Sending', pendingUploads.size, 'pending uploads');

    // Process each pending upload
    pendingUploads.forEach(async (uploadData, tempId) => {
      // Update UI to show as sending
      setOptimisticMessages(prev =>
        prev.map(msg =>
          msg.messageId === tempId
            ? { ...msg, status: MessageStatus.SENDING, text: msg.text.replace(' (queued)', '') }
            : msg
        )
      );

      try {
        let result;

        // Send based on file type
        if (uploadData.fileType === 'image') {
          result = await messageRepository.uploadAndSendImage(
            chatId,
            uploadData.userId,
            uploadData.userName,
            uploadData.file,
            isGroupChat,
            uploadData.shouldCompress,
            uploadData.userAvatar,
            undefined,
            undefined,
            tempId
          );
        } else if (uploadData.fileType === 'video') {
          result = await messageRepository.uploadAndSendVideo(
            chatId,
            uploadData.userId,
            uploadData.userName,
            uploadData.file,
            isGroupChat,
            uploadData.shouldCompress,
            uploadData.userAvatar,
            undefined,
            undefined,
            undefined,
            tempId
          );
        } else {
          result = await messageRepository.uploadAndSendDocument(
            chatId,
            uploadData.userId,
            uploadData.userName,
            uploadData.file,
            isGroupChat,
            uploadData.userAvatar,
            undefined,
            undefined,
            tempId
          );
        }

        if (result.status === 'success') {
          // Success - remove from queue and optimistic messages
          console.log('[UploadQueue] Upload sent successfully:', tempId);
          pendingUploads.delete(tempId);

          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== tempId)
          );
        } else {
          // Failed - mark as failed
          const errorMessage = result.status === 'error' ? result.message : 'Unknown error';
          console.log('[UploadQueue] Upload failed:', tempId, errorMessage);
          pendingUploads.delete(tempId);

          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, status: MessageStatus.FAILED, error: errorMessage }
                : msg
            )
          );
        }
      } catch (error: any) {
        // Error - mark as failed
        console.error('[UploadQueue] Error sending upload:', tempId, error);
        pendingUploads.delete(tempId);

        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: error.message || 'Upload failed' }
              : msg
          )
        );
      }
    });
  }, [isOnline, chatId, pendingUploads, isGroupChat]);

  const sendTextMessage = useCallback(
    async (currentUserId: string, currentUserName: string, text: string, currentUserAvatar?: string, replyTo?: ReplyTo | null) => {
      if (!chatId || !text.trim()) return;

      // Extract URLs and fetch link preview for the first URL
      const urls = extractUrls(text.trim());
      let linkPreview: LinkPreviewData | null = null;

      if (urls.length > 0) {
        try {
          // Fetch preview for the first URL only
          linkPreview = await fetchLinkPreview(urls[0]);
        } catch (error) {
          console.error('Error fetching link preview:', error);
          // Continue without preview if fetch fails
        }
      }

      // Create optimistic message
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticMessage: Message = {
        messageId: tempId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: text.trim(),
        type: MessageType.TEXT,
        readBy: {},
        deliveredTo: {},
        timestamp: Timestamp.now(),
        status: MessageStatus.SENDING,
        replyTo: replyTo || null,
        linkPreview: linkPreview,
      };

      // Add to optimistic messages immediately
      setOptimisticMessages(prev => [optimisticMessage, ...prev]);
      setSending(true);

      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: text.trim(),
        type: MessageType.TEXT,
        readBy: {},
        deliveredTo: {},
        replyTo: replyTo || null,
        linkPreview: linkPreview,
        tempId: tempId, // Store tempId for deduplication
      };

      // OFFLINE QUEUE: If offline, queue message instead of sending
      if (!navigator.onLine) {
        console.log('[OfflineQueue] User offline - queueing message:', tempId);
        OfflineMessageQueue.addPendingMessage(chatId, { ...message, messageId: tempId }, isGroupChat);
        setSending(false);

        // Update status to pending (will auto-send when online)
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.PENDING }
              : msg
          )
        );
        return;
      }

      try {
        // Auto-retry with exponential backoff (max 3 attempts: 0s, 1s, 2s)
        const result = await retryOperation(
          async () => {
            const res = await messageRepository.sendMessage(chatId, message, isGroupChat);
            if (res.status === 'error') {
              throw new Error(res.message || 'Failed to send message');
            }
            return res;
          },
          3, // max retries
          1000 // base delay 1s
        );

        setSending(false);

        // SUCCESS: Remove optimistic message immediately
        // Real message will appear from Firestore listener
        setOptimisticMessages(prev =>
          prev.filter(msg => msg.messageId !== tempId)
        );
      } catch (error: any) {
        setSending(false);

        // All retries failed - mark as FAILED
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: error.message || 'Failed to send message' }
              : msg
          )
        );
        setError(error.message || 'Failed to send message');
      }
    },
    [chatId, isGroupChat]
  );

  const sendImage = useCallback(
    async (
      currentUserId: string,
      currentUserName: string,
      imageFile: File,
      shouldCompress: boolean,
      currentUserAvatar?: string
    ) => {
      if (!chatId) return;

      // Create optimistic message
      const tempId = `temp_${Date.now()}_${Math.random()}`;

      const optimisticMessage: Message = {
        messageId: tempId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: '🖼️ Photo',
        type: MessageType.IMAGE,
        readBy: {},
        deliveredTo: {},
        timestamp: Timestamp.now(),
        status: MessageStatus.SENDING,
      };

      setOptimisticMessages(prev => [optimisticMessage, ...prev]);

      // Register upload in global manager
      const uploadId = uploadManager.addUpload({
        chatId,
        isGroupChat,
        file: imageFile,
        fileName: imageFile.name,
        fileSize: imageFile.size,
        fileType: 'image',
        mimeType: imageFile.type,
        tempMessageId: tempId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        shouldCompress,
      });

      // OFFLINE QUEUE: If offline, show error instead of queuing
      // (Queuing isn't implemented yet, so fail fast)
      if (!navigator.onLine) {
        // Update upload manager to failed
        uploadManager.updateUpload(uploadId, {
          status: 'failed',
          error: 'No internet connection',
          completedAt: Date.now(),
        });

        // Update optimistic message to show failure
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'No internet connection' }
              : msg
          )
        );
        return;
      }

      // Create abort controller for this upload
      const abortController = new AbortController();
      uploadAbortControllers.set(tempId, abortController);

      // Store abort controller in upload manager
      uploadManager.updateUpload(uploadId, {
        abortController,
        status: 'uploading',
        startedAt: Date.now(),
      });

      // NOTE: uploading state now managed by MessageComposer internally
      try {
        const result = await messageRepository.uploadAndSendImage(
          chatId,
          currentUserId,
          currentUserName,
          imageFile,
          isGroupChat,
          shouldCompress,
          currentUserAvatar,
          (progress) => {
            // Update message with upload progress
            setOptimisticMessages(prev =>
              prev.map(msg =>
                msg.messageId === tempId
                  ? { ...msg, text: `🖼️ Uploading... ${progress}%` }
                  : msg
              )
            );

            // Update upload manager with progress
            uploadManager.updateUpload(uploadId, { progress });
          },
          abortController.signal,
          tempId
        );

        // Clean up abort controller
        uploadAbortControllers.delete(tempId);

        if (result.status === 'error') {

          // Check if it was cancelled
          const isCancelled = result.message?.includes('cancelled');

          // Update upload manager
          uploadManager.updateUpload(uploadId, {
            status: isCancelled ? 'cancelled' : 'failed',
            error: result.message,
            completedAt: Date.now(),
          });

          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, status: MessageStatus.FAILED, error: isCancelled ? 'Upload cancelled' : result.message }
                : msg
            )
          );
        } else if (result.status === 'success') {
          // Update upload manager
          uploadManager.updateUpload(uploadId, {
            status: 'completed',
            progress: 100,
            completedAt: Date.now(),
          });

          // SUCCESS: Remove optimistic message immediately
          // Real message will appear from Firestore listener
          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== tempId)
          );

          // Remove completed upload after a short delay
          setTimeout(() => {
            uploadManager.removeUpload(uploadId);
          }, 3000);
        }
      } catch (error) {
        console.error('[IMAGE UPLOAD] Unexpected error:', error);
        uploadAbortControllers.delete(tempId);

        // Update upload manager
        uploadManager.updateUpload(uploadId, {
          status: 'failed',
          error: 'Upload failed',
          completedAt: Date.now(),
        });

        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'Upload failed' }
              : msg
          )
        );
      }
    },
    [chatId, isGroupChat, uploadAbortControllers, pendingUploads, uploadManager]
  );

  const sendImageGroup = useCallback(
    async (
      currentUserId: string,
      currentUserName: string,
      imageFiles: File[],
      shouldCompress: boolean,
      currentUserAvatar?: string
    ) => {
      if (!chatId || imageFiles.length === 0) return;

      // Create optimistic message
      const tempId = `temp_${Date.now()}_${Math.random()}`;

      const optimisticMessage: Message = {
        messageId: tempId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: `📷 ${imageFiles.length} Photos`,
        type: MessageType.IMAGE_GROUP,
        readBy: {},
        deliveredTo: {},
        timestamp: Timestamp.now(),
        status: MessageStatus.SENDING,
      };

      setOptimisticMessages(prev => [optimisticMessage, ...prev]);

      // OFFLINE QUEUE: If offline, show pending status
      if (!navigator.onLine) {
        console.log('[UploadQueue] User offline - bulk upload not supported offline');
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'Bulk upload not available offline' }
              : msg
          )
        );
        return;
      }

      // Create abort controller
      const abortController = new AbortController();
      uploadAbortControllers.set(tempId, abortController);

      console.log('[IMAGE_GROUP UPLOAD] Started -', imageFiles.length, 'images');

      try {
        const result = await messageRepository.uploadAndSendImageGroup(
          chatId,
          currentUserId,
          currentUserName,
          imageFiles,
          isGroupChat,
          shouldCompress,
          currentUserAvatar,
          (percentage) => {
            // Update message with upload progress percentage
            setOptimisticMessages(prev =>
              prev.map(msg =>
                msg.messageId === tempId
                  ? { ...msg, text: `📷 Uploading ${percentage}%...`, uploadProgress: percentage }
                  : msg
              )
            );
          },
          abortController.signal,
          tempId
        );

        console.log('[IMAGE_GROUP UPLOAD] Repository result:', result.status);

        // Clean up abort controller
        uploadAbortControllers.delete(tempId);

        if (result.status === 'error') {
          console.log('[IMAGE_GROUP UPLOAD] Error:', result.message);

          const isCancelled = result.message?.includes('cancelled');
          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, status: MessageStatus.FAILED, error: isCancelled ? 'Upload cancelled' : result.message }
                : msg
            )
          );
          if (!isCancelled) {
            setError(result.message);
          }
        } else {
          console.log('[IMAGE_GROUP UPLOAD] Success - removing optimistic message');
          // SUCCESS: Remove optimistic message
          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== tempId)
          );
        }
      } catch (error) {
        console.error('[IMAGE_GROUP UPLOAD] Unexpected error:', error);
        uploadAbortControllers.delete(tempId);
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'Upload failed' }
              : msg
          )
        );
      }
    },
    [chatId, isGroupChat, uploadAbortControllers]
  );

  const sendVideo = useCallback(
    async (currentUserId: string, currentUserName: string, videoFile: File, shouldCompress: boolean, currentUserAvatar?: string) => {
      if (!chatId) return;

      // Create optimistic message
      const tempId = `temp_${Date.now()}_${Math.random()}`;

      const optimisticMessage: Message = {
        messageId: tempId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: shouldCompress ? '🎥 Compressing...' : '🎥 Uploading...',
        type: MessageType.VIDEO,
        readBy: {},
        deliveredTo: {},
        timestamp: Timestamp.now(),
        status: MessageStatus.SENDING,
      };

      setOptimisticMessages(prev => [optimisticMessage, ...prev]);

      // Register upload in global manager
      const uploadId = uploadManager.addUpload({
        chatId,
        isGroupChat,
        file: videoFile,
        fileName: videoFile.name,
        fileSize: videoFile.size,
        fileType: 'video',
        mimeType: videoFile.type,
        tempMessageId: tempId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        shouldCompress,
      });

      // OFFLINE QUEUE: If offline, show error instead of queuing
      // (Queuing isn't implemented yet, so fail fast)
      if (!navigator.onLine) {
        // Update upload manager to failed
        uploadManager.updateUpload(uploadId, {
          status: 'failed',
          error: 'No internet connection',
          completedAt: Date.now(),
        });

        // Update optimistic message to show failure
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'No internet connection' }
              : msg
          )
        );
        return;
      }

      // Create abort controller for this upload
      const abortController = new AbortController();
      uploadAbortControllers.set(tempId, abortController);

      // Store abort controller in upload manager
      uploadManager.updateUpload(uploadId, {
        abortController,
        status: 'uploading',
        startedAt: Date.now(),
      });

      // NOTE: uploading state now managed by MessageComposer internally

      // Update status to uploading after compression (if compressing)
      if (shouldCompress) {
        // Wait a bit for compression to start
        setTimeout(() => {
          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, text: '🎥 Uploading...' }
                : msg
            )
          );
        }, 2000); // Give time for compression UI to show
      }

      try {
        const result = await messageRepository.uploadAndSendVideo(
          chatId,
          currentUserId,
          currentUserName,
          videoFile,
          isGroupChat,
          shouldCompress,
          currentUserAvatar,
          (phase) => {
            // Update message based on phase (only for compressing, uploading handled by progress callback)
            if (phase === 'compressing') {
              setOptimisticMessages(prev =>
                prev.map(msg =>
                  msg.messageId === tempId
                    ? { ...msg, text: '🎥 Compressing...' }
                    : msg
                )
              );
              // Update upload manager with phase
              uploadManager.updateUpload(uploadId, { phase: 'compressing' });
            }
          },
          (progress) => {
            // Update message with upload progress percentage
            setOptimisticMessages(prev =>
              prev.map(msg =>
                msg.messageId === tempId
                  ? { ...msg, text: `🎥 Uploading... ${progress}%` }
                  : msg
              )
            );
            // Update upload manager with progress
            uploadManager.updateUpload(uploadId, {
              progress,
              phase: 'uploading'
            });
          },
          abortController.signal,
          tempId
        );

        // Clean up abort controller
        uploadAbortControllers.delete(tempId);

        if (result.status === 'error') {
          const isCancelled = result.message?.includes('cancelled');

          // Update upload manager
          uploadManager.updateUpload(uploadId, {
            status: isCancelled ? 'cancelled' : 'failed',
            error: result.message,
            completedAt: Date.now(),
          });

          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, status: MessageStatus.FAILED, error: isCancelled ? 'Upload cancelled' : result.message }
                : msg
            )
          );
        } else {
          // Update upload manager
          uploadManager.updateUpload(uploadId, {
            status: 'completed',
            progress: 100,
            completedAt: Date.now(),
          });

          // SUCCESS: Remove optimistic message immediately
          // Real message will appear from Firestore listener
          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== tempId)
          );

          // Remove completed upload after a short delay
          setTimeout(() => {
            uploadManager.removeUpload(uploadId);
          }, 3000);
        }
      } catch (error) {
        uploadAbortControllers.delete(tempId);

        // Update upload manager
        uploadManager.updateUpload(uploadId, {
          status: 'failed',
          error: 'Upload failed',
          completedAt: Date.now(),
        });

        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'Upload failed' }
              : msg
          )
        );
      }
    },
    [chatId, isGroupChat, uploadAbortControllers, pendingUploads, uploadManager]
  );

  const sendDocument = useCallback(
    async (currentUserId: string, currentUserName: string, documentFile: File, currentUserAvatar?: string) => {
      if (!chatId) return;

      // Create optimistic message
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticMessage: Message = {
        messageId: tempId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: `📄 ${documentFile.name}`,
        type: MessageType.DOCUMENT,
        readBy: {},
        deliveredTo: {},
        timestamp: Timestamp.now(),
        status: MessageStatus.SENDING,
      };

      setOptimisticMessages(prev => [optimisticMessage, ...prev]);

      // Register upload in global manager
      const uploadId = uploadManager.addUpload({
        chatId,
        isGroupChat,
        file: documentFile,
        fileName: documentFile.name,
        fileSize: documentFile.size,
        fileType: 'document',
        mimeType: documentFile.type,
        tempMessageId: tempId,
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        shouldCompress: false,
      });

      // OFFLINE QUEUE: If offline, show error instead of queuing
      // (Queuing isn't implemented yet, so fail fast)
      if (!navigator.onLine) {
        // Update upload manager to failed
        uploadManager.updateUpload(uploadId, {
          status: 'failed',
          error: 'No internet connection',
          completedAt: Date.now(),
        });

        // Update optimistic message to show failure
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'No internet connection' }
              : msg
          )
        );
        return;
      }

      // Update upload manager status
      uploadManager.updateUpload(uploadId, {
        status: 'uploading',
        startedAt: Date.now(),
      });

      // NOTE: uploading state now managed by MessageComposer internally

      try {
        const result = await messageRepository.uploadAndSendDocument(
          chatId,
          currentUserId,
          currentUserName,
          documentFile,
          isGroupChat,
          currentUserAvatar,
          (progress) => {
            // Update message with upload progress
            setOptimisticMessages(prev =>
              prev.map(msg =>
                msg.messageId === tempId
                  ? { ...msg, text: `📄 Uploading... ${progress}%` }
                  : msg
              )
            );
            // Update upload manager with progress
            uploadManager.updateUpload(uploadId, { progress });
          },
          undefined,
          tempId
        );

        if (result.status === 'error') {
          // Update upload manager
          uploadManager.updateUpload(uploadId, {
            status: 'failed',
            error: result.message,
            completedAt: Date.now(),
          });

          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, status: MessageStatus.FAILED, error: result.message }
                : msg
            )
          );
        } else {
          // Update upload manager
          uploadManager.updateUpload(uploadId, {
            status: 'completed',
            progress: 100,
            completedAt: Date.now(),
          });

          // SUCCESS: Remove optimistic message immediately
          // Real message will appear from Firestore listener
          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== tempId)
          );

          // Remove completed upload after a short delay
          setTimeout(() => {
            uploadManager.removeUpload(uploadId);
          }, 3000);
        }
      } catch (error) {
        // Update upload manager
        uploadManager.updateUpload(uploadId, {
          status: 'failed',
          error: 'Upload failed',
          completedAt: Date.now(),
        });

        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'Upload failed' }
              : msg
          )
        );
      }
    },
    [chatId, isGroupChat, pendingUploads, uploadManager]
  );

  const markAsRead = useCallback(
    async (userId: string) => {
      if (!chatId) return;

      await messageRepository.markMessagesAsRead(chatId, userId, isGroupChat);
    },
    [chatId, isGroupChat]
  );

  /**
   * Mark message as delivered
   * Called automatically when receiving a new message (not from self)
   */
  const markAsDelivered = useCallback(
    async (messageId: string, userId: string) => {
      if (!chatId || !messageId || !userId) return;

      try {
        await messageRepository.markMessageAsDelivered(chatId, messageId, userId, isGroupChat);
        console.log(`[useMessages] ✅ Message ${messageId} marked as DELIVERED for user ${userId}`);
      } catch (error) {
        console.error('[useMessages] Error marking message as delivered:', error);
      }
    },
    [chatId, isGroupChat]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      console.log('[RETRY] Starting retry for message:', messageId);
      const failedMessage = optimisticMessages.find(msg => msg.messageId === messageId);
      console.log('[RETRY] Failed message:', failedMessage);

      if (!failedMessage || failedMessage.status !== MessageStatus.FAILED) {
        console.log('[RETRY] Not a failed message, aborting');
        return;
      }

      // Find the failed upload in upload manager
      const failedUpload = uploadManager.getUploadByTempMessageId(messageId);
      console.log('[RETRY] Failed upload from manager:', failedUpload);

      if (!failedUpload) {
        console.log('[RETRY] No upload found in manager, cannot retry file upload');
        return;
      }

      if (!failedUpload.file) {
        console.log('[RETRY] File not available in upload manager (might be after page refresh)');
        return;
      }

      // Remove the failed message from optimistic messages
      setOptimisticMessages(prev => prev.filter(msg => msg.messageId !== messageId));

      // Retry based on message type
      if (failedMessage.type === MessageType.TEXT) {
        await sendTextMessage(
          failedMessage.senderId,
          failedMessage.senderName,
          failedMessage.text,
          failedMessage.senderAvatar
        );
      } else if (failedMessage.type === MessageType.IMAGE) {
        console.log('[RETRY] Retrying image upload, shouldCompress:', failedUpload.shouldCompress);

        // Remove the failed upload from manager before retrying
        uploadManager.removeUpload(failedUpload.id);

        // Retry image upload (userId, userName, file, shouldCompress, avatar)
        await sendImage(
          failedMessage.senderId,
          failedMessage.senderName,
          failedUpload.file as File,
          failedUpload.shouldCompress || false,
          failedUpload.userAvatar
        );
      } else if (failedMessage.type === MessageType.VIDEO) {
        console.log('[RETRY] Retrying video upload, shouldCompress:', failedUpload.shouldCompress);

        // Remove the failed upload from manager before retrying
        uploadManager.removeUpload(failedUpload.id);

        // Retry video upload (userId, userName, file, shouldCompress, avatar)
        await sendVideo(
          failedMessage.senderId,
          failedMessage.senderName,
          failedUpload.file as File,
          failedUpload.shouldCompress || false,
          failedUpload.userAvatar
        );
      } else if (failedMessage.type === MessageType.DOCUMENT) {
        console.log('[RETRY] Retrying document upload');

        // Remove the failed upload from manager before retrying
        uploadManager.removeUpload(failedUpload.id);

        // Retry document upload (userId, userName, file, avatar)
        await sendDocument(
          failedMessage.senderId,
          failedMessage.senderName,
          failedUpload.file as File,
          failedUpload.userAvatar
        );
      }
    },
    [optimisticMessages, sendTextMessage, sendImage, sendVideo, sendDocument, uploadManager, chatId, isGroupChat]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!chatId) return;

      const result = await messageRepository.deleteMessage(chatId, messageId, isGroupChat);

      if (result.status === 'error') {
        setError(result.message);
      } else {
        // Update cache to remove deleted message
        deleteCachedMessage(chatId, messageId);
      }
    },
    [chatId, isGroupChat, deleteCachedMessage]
  );

  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!chatId) return;

      const result = await messageRepository.editMessage(chatId, messageId, newText, isGroupChat);

      if (result.status === 'error') {
        setError(result.message);
      } else {
        // Update cache with edited message text
        updateCachedMessage(chatId, messageId, { text: newText, isEdited: true });
      }
    },
    [chatId, isGroupChat, updateCachedMessage]
  );

  // Combine real messages and optimistic messages, sorted by timestamp
  // Use useMemo to avoid re-computing on every render (performance optimization)
  const allMessages = useMemo(() => {
    const messageMap = new Map<string, Message>();

    // Build a set of tempIds from real messages for fast deduplication lookup
    const realTempIds = new Set<string>();
    messages.forEach(msg => {
      if (msg.tempId) {
        realTempIds.add(msg.tempId);
      }
    });

    // Add all real messages first (they have priority)
    messages.forEach(msg => {
      messageMap.set(msg.messageId, msg);
    });

    // Add optimistic messages (only SENDING and FAILED exist now)
    // Skip if real message with same tempId already exists (deduplication)
    optimisticMessages.forEach(optMsg => {
      if (optMsg.messageId.startsWith('temp_') && !messageMap.has(optMsg.messageId)) {
        // Skip optimistic message if real message with this tempId exists
        if (realTempIds.has(optMsg.messageId)) {
          return; // Duplicate - skip
        }
        messageMap.set(optMsg.messageId, optMsg);
      }
    });

    // Convert to array and sort
    const sortedMessages = Array.from(messageMap.values()).sort((a, b) => {
      // Use timestamp, fallback to createdAt, then messageId for consistent ordering
      const timeA = getTimestampMillis(a.timestamp) || getTimestampMillis(a.createdAt) || 0;
      const timeB = getTimestampMillis(b.timestamp) || getTimestampMillis(b.createdAt) || 0;

      // If timestamps are equal, use messageId as tiebreaker
      if (timeA === timeB) {
        return a.messageId.localeCompare(b.messageId);
      }

      return timeB - timeA; // Descending order (newest first)
    });

    // Debug: Log message statuses
    sortedMessages.forEach(msg => {
      if (msg.messageId === 'WoXa3T93IQLWFURZtk20') {
        console.log(`[useMessages] allMessages - Message ${msg.messageId} has status:`, msg.status);
      }
    });

    return sortedMessages;
  }, [messages, optimisticMessages]);

  /**
   * Cancel an ongoing upload
   */
  const cancelUpload = useCallback((messageId: string) => {
    const abortController = uploadAbortControllers.get(messageId);
    if (abortController) {
      console.log('[UPLOAD CANCEL] Cancelling upload:', messageId);
      abortController.abort();
      uploadAbortControllers.delete(messageId);

      // Update message status to cancelled
      setOptimisticMessages(prev =>
        prev.map(msg =>
          msg.messageId === messageId
            ? { ...msg, status: MessageStatus.FAILED, error: 'Upload cancelled' }
            : msg
        )
      );
    }
  }, [uploadAbortControllers]);

  return {
    messages: allMessages,
    loading,
    error,
    sending,
    uploading,
    uploadingMessage,
    sendTextMessage,
    sendImage,
    sendImageGroup,
    sendVideo,
    sendDocument,
    markAsRead,
    markAsDelivered,
    retryMessage,
    deleteMessage,
    editMessage,
    cancelUpload,
  };
}
