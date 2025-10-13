'use client';

import { useEffect, useState } from 'react';
import { ChatRepository } from '@/lib/repositories/chat.repository';
import { ChatItem } from '@/types/models';

const chatRepository = new ChatRepository();

export function useChatList(userId: string | null) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = chatRepository.getUserChats(
      userId,
      (chats) => {
        // Remove duplicates based on chatId (keep the most recent one)
        const uniqueChats = chats.reduce((acc: ChatItem[], chat) => {
          const existingIndex = acc.findIndex((c) => c.chatId === chat.chatId);
          if (existingIndex === -1) {
            // Chat doesn't exist, add it
            acc.push(chat);
          } else {
            // Chat exists, keep the one with more recent timestamp
            if (chat.lastMessageTime.seconds > acc[existingIndex].lastMessageTime.seconds) {
              acc[existingIndex] = chat;
            }
          }
          return acc;
        }, []);

        setChats(uniqueChats);
        setLoading(false);
        setError(null);
      },
      (error) => {
        setError(error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { chats, loading, error };
}
