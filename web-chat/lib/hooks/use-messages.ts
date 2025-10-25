'use client';

import { useEffect, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { MessageRepository } from '@/lib/repositories/message.repository';
import { Message, MessageType, MessageStatus, ReplyTo } from '@/types/models';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useMessageCache } from '@/lib/stores/message-cache.store';
import { extractUrls, fetchLinkPreview, LinkPreviewData } from '@/lib/utils/link-preview';

const messageRepository = new MessageRepository();

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

  useEffect(() => {
    // Reset state when chatId changes
    setUploadingMessage(null);
    setUploading(false);
    setOptimisticMessages([]);
    setUserJoinedAt(null);
    setDeleteHistoryTimestamp(null);

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

      const result = await messageRepository.sendMessage(chatId, message, isGroupChat);
      setSending(false);

      if (result.status === 'error') {
        // Update optimistic message to failed
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: result.message }
              : msg
          )
        );
        setError(result.message);
      } else {
        // SUCCESS: Remove optimistic message immediately
        // Real message will appear from Firestore listener
        setOptimisticMessages(prev =>
          prev.filter(msg => msg.messageId !== tempId)
        );
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
      // NOTE: uploading state now managed by MessageComposer internally
      console.log('[IMAGE UPLOAD] Started');

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
          },
          tempId
        );

        console.log('[IMAGE UPLOAD] Repository result:', result.status);

        if (result.status === 'error') {
          console.log('[IMAGE UPLOAD] Error:', result.message);
          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, status: MessageStatus.FAILED, error: result.message }
                : msg
            )
          );
          setError(result.message);
        } else {
          console.log('[IMAGE UPLOAD] Success - removing optimistic message');
          // SUCCESS: Remove optimistic message immediately
          // Real message will appear from Firestore listener
          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== tempId)
          );
        }
      } catch (error) {
        console.error('[IMAGE UPLOAD] Unexpected error:', error);
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'Upload failed' }
              : msg
          )
        );
      }
    },
    [chatId, isGroupChat]
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
          },
          tempId
        );

        if (result.status === 'error') {
          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, status: MessageStatus.FAILED, error: result.message }
                : msg
            )
          );
          setError(result.message);
        } else {
          // SUCCESS: Remove optimistic message immediately
          // Real message will appear from Firestore listener
          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== tempId)
          );
        }
      } catch (error) {
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'Upload failed' }
              : msg
          )
        );
      }
    },
    [chatId, isGroupChat]
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
      // NOTE: uploading state now managed by MessageComposer internally

      try {
        const result = await messageRepository.uploadAndSendDocument(
          chatId,
          currentUserId,
          currentUserName,
          documentFile,
          isGroupChat,
          currentUserAvatar,
          undefined,
          tempId
        );

        if (result.status === 'error') {
          setOptimisticMessages(prev =>
            prev.map(msg =>
              msg.messageId === tempId
                ? { ...msg, status: MessageStatus.FAILED, error: result.message }
                : msg
            )
          );
          setError(result.message);
        } else {
          // SUCCESS: Remove optimistic message immediately
          // Real message will appear from Firestore listener
          setOptimisticMessages(prev =>
            prev.filter(msg => msg.messageId !== tempId)
          );
        }
      } catch (error) {
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.FAILED, error: 'Upload failed' }
              : msg
          )
        );
      }
    },
    [chatId, isGroupChat]
  );

  const markAsRead = useCallback(
    async (userId: string) => {
      if (!chatId) return;

      await messageRepository.markMessagesAsRead(chatId, userId, isGroupChat);
    },
    [chatId, isGroupChat]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const failedMessage = optimisticMessages.find(msg => msg.messageId === messageId);
      if (!failedMessage || failedMessage.status !== MessageStatus.FAILED) return;

      // Update status to sending
      setOptimisticMessages(prev =>
        prev.map(msg =>
          msg.messageId === messageId
            ? { ...msg, status: MessageStatus.SENDING, error: undefined }
            : msg
        )
      );

      // Retry based on message type
      if (failedMessage.type === MessageType.TEXT) {
        await sendTextMessage(
          failedMessage.senderId,
          failedMessage.senderName,
          failedMessage.text,
          failedMessage.senderAvatar
        );
      }

      // Remove the failed message after retry
      setOptimisticMessages(prev => prev.filter(msg => msg.messageId !== messageId));
    },
    [optimisticMessages, sendTextMessage, chatId, isGroupChat]
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
    return Array.from(messageMap.values()).sort((a, b) => {
      // Use timestamp, fallback to createdAt, then messageId for consistent ordering
      const timeA = getTimestampMillis(a.timestamp) || getTimestampMillis(a.createdAt) || 0;
      const timeB = getTimestampMillis(b.timestamp) || getTimestampMillis(b.createdAt) || 0;

      // If timestamps are equal, use messageId as tiebreaker
      if (timeA === timeB) {
        return a.messageId.localeCompare(b.messageId);
      }

      return timeB - timeA; // Descending order (newest first)
    });
  }, [messages, optimisticMessages]);

  return {
    messages: allMessages,
    loading,
    error,
    sending,
    uploading,
    uploadingMessage,
    sendTextMessage,
    sendImage,
    sendVideo,
    sendDocument,
    markAsRead,
    retryMessage,
    deleteMessage,
    editMessage,
  };
}
