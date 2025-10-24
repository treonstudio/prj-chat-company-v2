import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Message } from '@/types/models'

interface MessageCache {
  [chatId: string]: {
    messages: Message[]
    lastFetched: number
    unreadCount?: number
  }
}

interface MessageCacheState {
  cache: MessageCache

  // Actions
  setMessages: (chatId: string, messages: Message[]) => void
  addMessage: (chatId: string, message: Message) => void
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void
  deleteMessage: (chatId: string, messageId: string) => void
  deleteMessages: (chatId: string, messageIds: string[]) => void
  clearChatHistory: (chatId: string) => void
  getMessages: (chatId: string) => Message[] | null
  setUnreadCount: (chatId: string, count: number) => void
  clearCache: (chatId?: string) => void
  isCacheValid: (chatId: string, maxAgeMs?: number) => boolean
}

// Cache validity: 5 minutes by default
const DEFAULT_CACHE_MAX_AGE = 5 * 60 * 1000

export const useMessageCache = create<MessageCacheState>()(
  persist(
    (set, get) => ({
      cache: {},

      // Set all messages for a chat (from Firestore fetch)
      setMessages: (chatId, messages) => {
        set((state) => ({
          cache: {
            ...state.cache,
            [chatId]: {
              messages,
              lastFetched: Date.now(),
              unreadCount: state.cache[chatId]?.unreadCount || 0,
            },
          },
        }))
      },

      // Add a new message (real-time or sent)
      addMessage: (chatId, message) => {
        set((state) => {
          const existing = state.cache[chatId]
          if (!existing) {
            return {
              cache: {
                ...state.cache,
                [chatId]: {
                  messages: [message],
                  lastFetched: Date.now(),
                  unreadCount: 0,
                },
              },
            }
          }

          // Check if message already exists (prevent duplicates)
          const messageExists = existing.messages.some((m) => m.messageId === message.messageId)
          if (messageExists) {
            return state // No change
          }

          return {
            cache: {
              ...state.cache,
              [chatId]: {
                ...existing,
                messages: [...existing.messages, message],
                lastFetched: Date.now(),
              },
            },
          }
        })
      },

      // Update a message (edit, status change, etc.)
      updateMessage: (chatId, messageId, updates) => {
        set((state) => {
          const existing = state.cache[chatId]
          if (!existing) return state

          return {
            cache: {
              ...state.cache,
              [chatId]: {
                ...existing,
                messages: existing.messages.map((msg) =>
                  msg.messageId === messageId ? { ...msg, ...updates } : msg
                ),
                lastFetched: Date.now(),
              },
            },
          }
        })
      },

      // Delete a single message
      deleteMessage: (chatId, messageId) => {
        set((state) => {
          const existing = state.cache[chatId]
          if (!existing) return state

          return {
            cache: {
              ...state.cache,
              [chatId]: {
                ...existing,
                messages: existing.messages.filter((msg) => msg.messageId !== messageId),
                lastFetched: Date.now(),
              },
            },
          }
        })
      },

      // Delete multiple messages
      deleteMessages: (chatId, messageIds) => {
        set((state) => {
          const existing = state.cache[chatId]
          if (!existing) return state

          const messageIdSet = new Set(messageIds)
          return {
            cache: {
              ...state.cache,
              [chatId]: {
                ...existing,
                messages: existing.messages.filter((msg) => !messageIdSet.has(msg.messageId)),
                lastFetched: Date.now(),
              },
            },
          }
        })
      },

      // Clear chat history (all messages)
      clearChatHistory: (chatId) => {
        set((state) => {
          const existing = state.cache[chatId]
          if (!existing) return state

          return {
            cache: {
              ...state.cache,
              [chatId]: {
                messages: [],
                lastFetched: Date.now(),
                unreadCount: 0,
              },
            },
          }
        })
      },

      // Get cached messages
      getMessages: (chatId) => {
        const cached = get().cache[chatId]
        return cached ? cached.messages : null
      },

      // Set unread count
      setUnreadCount: (chatId, count) => {
        set((state) => {
          const existing = state.cache[chatId]
          if (!existing) {
            return {
              cache: {
                ...state.cache,
                [chatId]: {
                  messages: [],
                  lastFetched: 0,
                  unreadCount: count,
                },
              },
            }
          }

          return {
            cache: {
              ...state.cache,
              [chatId]: {
                ...existing,
                unreadCount: count,
              },
            },
          }
        })
      },

      // Clear cache for specific chat or all
      clearCache: (chatId) => {
        if (chatId) {
          set((state) => {
            const { [chatId]: _, ...rest } = state.cache
            return { cache: rest }
          })
        } else {
          set({ cache: {} })
        }
      },

      // Check if cache is still valid
      isCacheValid: (chatId, maxAgeMs = DEFAULT_CACHE_MAX_AGE) => {
        const cached = get().cache[chatId]
        if (!cached || cached.messages.length === 0) return false

        const age = Date.now() - cached.lastFetched
        return age < maxAgeMs
      },
    }),
    {
      name: 'message-cache-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist cache, not large nested objects
      partialize: (state) => ({
        cache: Object.fromEntries(
          Object.entries(state.cache).map(([chatId, data]) => [
            chatId,
            {
              // Only keep last 100 messages in localStorage to avoid quota issues
              messages: data.messages.slice(-100),
              lastFetched: data.lastFetched,
              unreadCount: data.unreadCount,
            },
          ])
        ),
      }),
    }
  )
)
