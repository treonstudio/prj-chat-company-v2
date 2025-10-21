'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageRepository } from '@/lib/repositories/message.repository';
import { Message, MessageType, MessageStatus, ReplyTo } from '@/types/models';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const messageRepository = new MessageRepository();

export function useMessages(chatId: string | null, isGroupChat: boolean, currentUserId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMessage, setUploadingMessage] = useState<Message | null>(null);
  const [userJoinedAt, setUserJoinedAt] = useState<Timestamp | null>(null);

  useEffect(() => {
    // Reset uploading state when chatId changes
    setUploadingMessage(null);
    setUploading(false);
    setOptimisticMessages([]);
    setUserJoinedAt(null);

    if (!chatId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // CRITICAL: Load group join date BEFORE subscribing to messages
    // This prevents race conditions where messages load before we know the filter timestamp
    const setupMessageListener = async () => {
      let joinedAtTimestamp: Timestamp | null = null;

      // For group chats, load user's join date first
      if (isGroupChat && currentUserId) {
        try {
          const groupRef = doc(db(), 'groupChats', chatId);
          const groupDoc = await getDoc(groupRef);

          if (groupDoc.exists()) {
            const groupData = groupDoc.data();
            const usersJoinedAt = groupData?.usersJoinedAt || {};
            joinedAtTimestamp = usersJoinedAt[currentUserId] || null;
            setUserJoinedAt(joinedAtTimestamp);
          }
        } catch (err) {
          console.error('Error loading group join date:', err);
          // Continue without filtering if we can't load join date
        }
      }

      // Now subscribe to messages with filtering applied
      const unsubscribe = messageRepository.getMessages(
        chatId,
        isGroupChat,
        (messages) => {
          // CRITICAL: Filter messages based on user's join date for group chats
          let filteredMessages = messages;

          if (isGroupChat && joinedAtTimestamp) {
            filteredMessages = messages.filter(msg => {
              if (!msg.timestamp) return true; // Include messages without timestamp (edge case)
              return msg.timestamp.toMillis() >= joinedAtTimestamp.toMillis();
            });
          }

          setMessages(filteredMessages);
          setLoading(false);
          setError(null);

          // Remove optimistic messages that have been confirmed
          setOptimisticMessages(prev => {
            // Only keep optimistic messages (temp_ ids)
            // If a message with same content exists in real messages, remove optimistic version
            return prev.filter(optMsg => {
              if (!optMsg.messageId.startsWith('temp_')) {
                return false; // Remove non-temp messages from optimistic list
              }

              // Check if this optimistic message now exists in real messages
              const hasRealVersion = filteredMessages.some(msg => {
                if (msg.messageId.startsWith('temp_')) {
                  return false; // Skip other temp messages
                }

                const timeDiff = Math.abs(
                  (msg.timestamp?.toMillis() || 0) - (optMsg.timestamp?.toMillis() || 0)
                );

                // Match by content and time
                return (
                  msg.senderId === optMsg.senderId &&
                  msg.text === optMsg.text &&
                  msg.type === optMsg.type &&
                  timeDiff < 10000 // 10 second window
                );
              });

              return !hasRealVersion; // Keep if no real version exists yet
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
        // Success - the real message listener will remove the optimistic message
        // Just update status to SENT for now
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.SENT }
              : msg
          )
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
      setUploading(true);

      const result = await messageRepository.uploadAndSendImage(
        chatId,
        currentUserId,
        currentUserName,
        imageFile,
        isGroupChat,
        shouldCompress,
        currentUserAvatar
      );

      setUploading(false);

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
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.SENT }
              : msg
          )
        );
      }
    },
    [chatId, isGroupChat]
  );

  const sendVideo = useCallback(
    async (currentUserId: string, currentUserName: string, videoFile: File, currentUserAvatar?: string) => {
      if (!chatId) return;

      // Create optimistic message
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticMessage: Message = {
        messageId: tempId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: '🎥 Video',
        type: MessageType.VIDEO,
        readBy: {},
        deliveredTo: {},
        timestamp: Timestamp.now(),
        status: MessageStatus.SENDING,
      };

      setOptimisticMessages(prev => [optimisticMessage, ...prev]);
      setUploading(true);

      const result = await messageRepository.uploadAndSendVideo(
        chatId,
        currentUserId,
        currentUserName,
        videoFile,
        isGroupChat,
        currentUserAvatar
      );

      setUploading(false);

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
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.SENT }
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
      setUploading(true);

      const result = await messageRepository.uploadAndSendDocument(
        chatId,
        currentUserId,
        currentUserName,
        documentFile,
        isGroupChat,
        currentUserAvatar
      );

      setUploading(false);

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
        setOptimisticMessages(prev =>
          prev.map(msg =>
            msg.messageId === tempId
              ? { ...msg, status: MessageStatus.SENT }
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
      }
    },
    [chatId, isGroupChat]
  );

  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!chatId) return;

      const result = await messageRepository.editMessage(chatId, messageId, newText, isGroupChat);

      if (result.status === 'error') {
        setError(result.message);
      }
    },
    [chatId, isGroupChat]
  );

  // Combine real messages and optimistic messages, sorted by timestamp
  // First, deduplicate to avoid showing same message twice
  const messageMap = new Map<string, Message>();

  // Add all real messages first (they have priority)
  messages.forEach(msg => {
    messageMap.set(msg.messageId, msg);
  });

  // Add optimistic messages only if they don't match any real message
  optimisticMessages.forEach(optMsg => {
    // Only add if it's a temp message and not already in map
    if (optMsg.messageId.startsWith('temp_') && !messageMap.has(optMsg.messageId)) {
      // Double-check it doesn't duplicate a real message by content
      const isDuplicate = Array.from(messageMap.values()).some(realMsg => {
        const timeDiff = Math.abs(
          (realMsg.timestamp?.toMillis() || 0) - (optMsg.timestamp?.toMillis() || 0)
        );
        return (
          !realMsg.messageId.startsWith('temp_') &&
          realMsg.senderId === optMsg.senderId &&
          realMsg.text === optMsg.text &&
          realMsg.type === optMsg.type &&
          timeDiff < 10000
        );
      });

      if (!isDuplicate) {
        messageMap.set(optMsg.messageId, optMsg);
      }
    }
  });

  // Convert to array and sort
  const allMessages = Array.from(messageMap.values()).sort((a, b) => {
    // Use timestamp, fallback to createdAt, then messageId for consistent ordering
    const timeA = a.timestamp?.toMillis() || a.createdAt?.toMillis() || 0;
    const timeB = b.timestamp?.toMillis() || b.createdAt?.toMillis() || 0;

    // If timestamps are equal, use messageId as tiebreaker
    if (timeA === timeB) {
      return a.messageId.localeCompare(b.messageId);
    }

    return timeB - timeA; // Descending order (newest first)
  });

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
