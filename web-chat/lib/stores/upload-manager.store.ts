/**
 * Global Upload Manager Store
 * Manages file uploads independently of chat room lifecycle
 * Uploads persist even when user navigates to different chats
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UploadTask {
  id: string // unique ID for this upload
  chatId: string
  isGroupChat: boolean
  file: File | null // null after hydration (can't persist File objects)
  fileName: string
  fileSize: number
  fileType: 'image' | 'video' | 'document'
  mimeType: string

  // Upload metadata
  tempMessageId: string // optimistic message ID
  userId: string
  userName: string
  userAvatar?: string
  shouldCompress?: boolean

  // Upload state
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled'
  progress: number // 0-100
  phase?: 'compressing' | 'uploading' // for videos
  error?: string
  uploadedUrl?: string

  // Timestamps
  createdAt: number
  startedAt?: number
  completedAt?: number

  // Abort control
  abortController?: AbortController // not persisted
}

interface UploadManagerState {
  // Active uploads map (by upload ID)
  uploads: Map<string, UploadTask>

  // Actions
  addUpload: (task: Omit<UploadTask, 'id' | 'status' | 'progress' | 'createdAt'>) => string
  updateUpload: (id: string, updates: Partial<UploadTask>) => void
  removeUpload: (id: string) => void
  cancelUpload: (id: string) => void
  getUploadsByChat: (chatId: string) => UploadTask[]
  getAllActiveUploads: () => UploadTask[]
  clearCompletedUploads: () => void

  // Get upload by temp message ID
  getUploadByTempMessageId: (tempMessageId: string) => UploadTask | undefined
}

export const useUploadManager = create<UploadManagerState>()(
  persist(
    (set, get) => ({
      uploads: new Map(),

      addUpload: (task) => {
        const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const uploadTask: UploadTask = {
          ...task,
          id,
          status: 'pending',
          progress: 0,
          createdAt: Date.now(),
        }

        set((state) => {
          const newUploads = new Map(state.uploads)
          newUploads.set(id, uploadTask)
          return { uploads: newUploads }
        })

        return id
      },

      updateUpload: (id, updates) => {
        set((state) => {
          const newUploads = new Map(state.uploads)
          const existing = newUploads.get(id)
          if (existing) {
            newUploads.set(id, { ...existing, ...updates })
          }
          return { uploads: newUploads }
        })
      },

      removeUpload: (id) => {
        set((state) => {
          const newUploads = new Map(state.uploads)
          const upload = newUploads.get(id)

          // Abort if still in progress
          if (upload?.abortController && upload.status === 'uploading') {
            upload.abortController.abort()
          }

          newUploads.delete(id)
          return { uploads: newUploads }
        })
      },

      cancelUpload: (id) => {
        const upload = get().uploads.get(id)
        if (upload?.abortController) {
          upload.abortController.abort()
        }

        get().updateUpload(id, {
          status: 'cancelled',
          error: 'Upload cancelled by user',
        })
      },

      getUploadsByChat: (chatId) => {
        return Array.from(get().uploads.values()).filter(
          (upload) => upload.chatId === chatId
        )
      },

      getAllActiveUploads: () => {
        return Array.from(get().uploads.values()).filter(
          (upload) => upload.status === 'pending' || upload.status === 'uploading'
        )
      },

      clearCompletedUploads: () => {
        set((state) => {
          const newUploads = new Map(state.uploads)
          for (const [id, upload] of newUploads.entries()) {
            if (upload.status === 'completed' || upload.status === 'failed' || upload.status === 'cancelled') {
              newUploads.delete(id)
            }
          }
          return { uploads: newUploads }
        })
      },

      getUploadByTempMessageId: (tempMessageId) => {
        return Array.from(get().uploads.values()).find(
          (upload) => upload.tempMessageId === tempMessageId
        )
      },
    }),
    {
      name: 'upload-manager-storage',
      // Custom serialization to handle Map and non-serializable fields
      partialize: (state) => ({
        uploads: Array.from(state.uploads.entries()).map(([id, task]) => [
          id,
          {
            ...task,
            file: null, // Don't persist File objects
            abortController: undefined, // Don't persist AbortControllers
          },
        ]),
      }),
      // Custom deserialization
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        uploads: new Map(persistedState?.uploads || []),
      }),
    }
  )
)
