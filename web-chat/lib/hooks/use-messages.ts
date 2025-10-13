'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageRepository } from '@/lib/repositories/message.repository';
import { Message, MessageType } from '@/types/models';

const messageRepository = new MessageRepository();

export function useMessages(chatId: string | null, isGroupChat: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMessage, setUploadingMessage] = useState<Message | null>(null);

  useEffect(() => {
    // Reset uploading state when chatId changes
    setUploadingMessage(null);
    setUploading(false);

    if (!chatId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = messageRepository.getMessages(
      chatId,
      isGroupChat,
      (messages) => {
        setMessages(messages);
        setLoading(false);
        setError(null);
      },
      (error) => {
        setError(error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId, isGroupChat]);

  const sendTextMessage = useCallback(
    async (currentUserId: string, currentUserName: string, text: string) => {
      if (!chatId || !text.trim()) return;

      setSending(true);
      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        text: text.trim(),
        type: MessageType.TEXT,
        readBy: {},
      };

      const result = await messageRepository.sendMessage(chatId, message, isGroupChat);
      setSending(false);

      if (result.status === 'error') {
        setError(result.message);
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

      // Create temporary uploading message
      const tempMessage: Message = {
        messageId: `temp_${Date.now()}`,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: '🖼️ Photo',
        type: MessageType.IMAGE,
        readBy: {},
        deliveredTo: {},
      };

      setUploading(true);
      setUploadingMessage(tempMessage);

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
      setUploadingMessage(null);

      if (result.status === 'error') {
        setError(result.message);
      }
    },
    [chatId, isGroupChat]
  );

  const sendVideo = useCallback(
    async (currentUserId: string, currentUserName: string, videoFile: File, currentUserAvatar?: string) => {
      if (!chatId) return;

      // Create temporary uploading message
      const tempMessage: Message = {
        messageId: `temp_${Date.now()}`,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: '🎥 Video',
        type: MessageType.VIDEO,
        readBy: {},
        deliveredTo: {},
      };

      setUploading(true);
      setUploadingMessage(tempMessage);

      const result = await messageRepository.uploadAndSendVideo(
        chatId,
        currentUserId,
        currentUserName,
        videoFile,
        isGroupChat,
        currentUserAvatar
      );

      setUploading(false);
      setUploadingMessage(null);

      if (result.status === 'error') {
        setError(result.message);
      }
    },
    [chatId, isGroupChat]
  );

  const sendDocument = useCallback(
    async (currentUserId: string, currentUserName: string, documentFile: File, currentUserAvatar?: string) => {
      if (!chatId) return;

      // Create temporary uploading message
      const tempMessage: Message = {
        messageId: `temp_${Date.now()}`,
        senderId: currentUserId,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        text: `📄 ${documentFile.name}`,
        type: MessageType.DOCUMENT,
        readBy: {},
        deliveredTo: {},
      };

      setUploading(true);
      setUploadingMessage(tempMessage);

      const result = await messageRepository.uploadAndSendDocument(
        chatId,
        currentUserId,
        currentUserName,
        documentFile,
        isGroupChat,
        currentUserAvatar
      );

      setUploading(false);
      setUploadingMessage(null);

      if (result.status === 'error') {
        setError(result.message);
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

  return {
    messages,
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
  };
}
