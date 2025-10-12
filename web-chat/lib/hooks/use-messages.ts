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

  useEffect(() => {
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
      shouldCompress: boolean
    ) => {
      if (!chatId) return;

      setUploading(true);
      const result = await messageRepository.uploadAndSendImage(
        chatId,
        currentUserId,
        currentUserName,
        imageFile,
        isGroupChat,
        shouldCompress
      );
      setUploading(false);

      if (result.status === 'error') {
        setError(result.message);
      }
    },
    [chatId, isGroupChat]
  );

  const sendVideo = useCallback(
    async (currentUserId: string, currentUserName: string, videoFile: File) => {
      if (!chatId) return;

      setUploading(true);
      const result = await messageRepository.uploadAndSendVideo(
        chatId,
        currentUserId,
        currentUserName,
        videoFile,
        isGroupChat
      );
      setUploading(false);

      if (result.status === 'error') {
        setError(result.message);
      }
    },
    [chatId, isGroupChat]
  );

  const sendDocument = useCallback(
    async (currentUserId: string, currentUserName: string, documentFile: File) => {
      if (!chatId) return;

      setUploading(true);
      const result = await messageRepository.uploadAndSendDocument(
        chatId,
        currentUserId,
        currentUserName,
        documentFile,
        isGroupChat
      );
      setUploading(false);

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
    sendTextMessage,
    sendImage,
    sendVideo,
    sendDocument,
    markAsRead,
  };
}
