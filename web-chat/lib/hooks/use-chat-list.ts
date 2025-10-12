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
        setChats(chats);
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
