'use client';

import { useEffect, useState } from 'react';

const DRAFT_STORAGE_KEY = 'chat_drafts';

interface DraftMessages {
  [chatId: string]: string;
}

/**
 * Custom hook to manage draft messages per chat room
 * Drafts are stored in localStorage and persist across sessions
 */
export function useDraftMessage(chatId: string) {
  const [draft, setDraft] = useState<string>('');

  // Load draft from localStorage when chatId changes
  useEffect(() => {
    const loadDraft = () => {
      try {
        const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (stored) {
          const drafts: DraftMessages = JSON.parse(stored);
          setDraft(drafts[chatId] || '');
        } else {
          setDraft('');
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
        setDraft('');
      }
    };

    loadDraft();
  }, [chatId]);

  // Save draft to localStorage
  const saveDraft = (text: string) => {
    setDraft(text);

    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      const drafts: DraftMessages = stored ? JSON.parse(stored) : {};

      if (text.trim()) {
        // Save draft if not empty
        drafts[chatId] = text;
      } else {
        // Remove draft if empty
        delete drafts[chatId];
      }

      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  // Clear draft for current chat
  const clearDraft = () => {
    saveDraft('');
  };

  return {
    draft,
    saveDraft,
    clearDraft,
  };
}

/**
 * Get draft message for a specific chat (non-hook utility)
 * Used for displaying draft preview in chat list
 */
export function getDraftMessage(chatId: string): string | null {
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored) {
      const drafts: DraftMessages = JSON.parse(stored);
      return drafts[chatId] || null;
    }
  } catch (error) {
    console.error('Failed to get draft:', error);
  }
  return null;
}
