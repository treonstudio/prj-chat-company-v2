import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Message, MessageType, MediaMetadata, MediaItem, MessageStatus } from '@/types/models';
import { Resource } from '@/types/resource';
import { compressImage, compressVideo } from '@/lib/utils/media-compression';
import { uploadFileToChatkuAPI } from '@/lib/utils/file-upload.utils';

/**
 * Generate a UUID compatible with all browsers
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export class MessageRepository {
  private readonly DIRECT_CHATS_COLLECTION = 'directChats';
  private readonly GROUP_CHATS_COLLECTION = 'groupChats';
  private readonly MESSAGES_SUBCOLLECTION = 'messages';

  /**
   * Get file extension from File object
   */
  private getFileExtension(file: File): string {
    // Try to get from filename first
    const parts = file.name.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }

    // Fallback to MIME type mapping
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
    };

    return mimeMap[file.type] || 'bin';
  }

  /**
   * Calculate message status based on readBy and deliveredTo
   */
  private calculateMessageStatus(
    message: Message,
    currentUserId: string,
    isGroupChat: boolean,
    allParticipants?: string[]
  ): MessageStatus {
    console.log('[calculateMessageStatus] Called for message:', message.messageId, {
      hasStatus: !!message.status,
      statusValue: message.status,
      statusType: typeof message.status,
      senderId: message.senderId,
      currentUserId: currentUserId
    });

    // IMPORTANT: If message already has a status field from Firestore, use it
    // This ensures we respect the status set by delivery receipt service and markAsRead
    if (message.status) {
      console.log('[calculateMessageStatus] ✅ Using existing status from Firestore:', message.status);
      return message.status;
    }

    // Only calculate status for messages sent by current user
    // (for backward compatibility with old messages without status field)
    if (message.senderId !== currentUserId) {
      return MessageStatus.SENT;
    }

    const readByCount = Object.keys(message.readBy || {}).length;
    const deliveredToCount = Object.keys(message.deliveredTo || {}).length;

    if (isGroupChat && allParticipants) {
      // For group chats, check if all other participants have read
      const otherParticipants = allParticipants.filter(id => id !== currentUserId);
      const allRead = otherParticipants.every(id => message.readBy?.[id]);
      const anyDelivered = deliveredToCount > 0;

      if (allRead && otherParticipants.length > 0) {
        return MessageStatus.READ;
      } else if (anyDelivered) {
        return MessageStatus.DELIVERED;
      }
    } else {
      // For direct chats
      if (readByCount > 0) {
        return MessageStatus.READ;
      } else if (deliveredToCount > 0) {
        return MessageStatus.DELIVERED;
      }
    }

    return MessageStatus.SENT;
  }

  /**
   * Get messages with real-time updates
   */
  getMessages(
    chatId: string,
    isGroupChat: boolean,
    onUpdate: (messages: Message[]) => void,
    onError: (error: string) => void,
    currentUserId?: string
  ): () => void {
    const collection_name = isGroupChat
      ? this.GROUP_CHATS_COLLECTION
      : this.DIRECT_CHATS_COLLECTION;

    const messagesRef = collection(
      db(),
      collection_name,
      chatId,
      this.MESSAGES_SUBCOLLECTION
    );

    const q = query(messagesRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        let allParticipants: string[] | undefined;

        // Get participants for status calculation
        if (currentUserId) {
          const chatRef = doc(db(), collection_name, chatId);
          const chatSnapshot = await getDoc(chatRef);
          allParticipants = chatSnapshot.get('participants') as string[] | undefined;
        }

        const messages = snapshot.docs
          .map((doc) => {
            const rawData = doc.data();
            const messageData = {
              ...rawData,
              messageId: doc.id,
            } as Message;

            console.log('[MessageRepository] Raw message data from Firestore:', {
              messageId: doc.id,
              senderId: rawData.senderId,
              statusFromFirestore: rawData.status,
              deliveredTo: rawData.deliveredTo,
              readBy: rawData.readBy
            });

            // Calculate status if currentUserId is provided
            console.log('[MessageRepository] Checking if should calculate status:', {
              hasCurrentUserId: !!currentUserId,
              currentUserId: currentUserId,
              hasAllParticipants: !!allParticipants,
              allParticipants: allParticipants
            });

            if (currentUserId && allParticipants) {
              console.log('[MessageRepository] 🔄 Calculating status for message:', doc.id);

              const calculatedStatus = this.calculateMessageStatus(
                messageData,
                currentUserId,
                isGroupChat,
                allParticipants
              );

              console.log('[MessageRepository] Status after calculation:', {
                messageId: doc.id,
                before: messageData.status,
                after: calculatedStatus
              });

              messageData.status = calculatedStatus;
            } else {
              console.log('[MessageRepository] ⚠️ Skipping status calculation - missing currentUserId or allParticipants');
            }

            return messageData;
          })
          .filter((message) => {
            // Keep messages deleted for everyone (isDeleted: true)
            // These will show "Pesan ini dihapus" placeholder in UI

            // Filter out messages hidden from current user (Delete for Me)
            // These messages should be completely hidden from this user
            if (currentUserId && message.hideFrom && message.hideFrom[currentUserId]) {
              return false;
            }

            return true;
          });

        onUpdate(messages);
      },
      (error) => {
        onError(error.message || 'Failed to fetch messages');
      }
    );

    return unsubscribe;
  }

  /**
   * Send text message
   */
  async sendMessage(
    chatId: string,
    message: Message,
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      const collection_name = isGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      const timestamp = Timestamp.now();

      // Ensure senderName is populated - lookup from users collection if empty
      let finalSenderName = message.senderName;
      if (!finalSenderName || finalSenderName.trim() === '') {
        try {
          const userDoc = await getDoc(doc(db(), 'users', message.senderId));
          if (userDoc.exists()) {
            finalSenderName = userDoc.get('displayName') || 'Unknown User';
          } else {
            finalSenderName = 'Unknown User';
          }
        } catch (error) {
          console.error('Error fetching sender name:', error);
          finalSenderName = 'Unknown User';
        }
      }

      // 1. Add message to messages subcollection
      const messagesRef = collection(
        db(),
        collection_name,
        chatId,
        this.MESSAGES_SUBCOLLECTION
      );

      // Remove undefined fields to avoid Firestore errors
      const messageWithTimestamp: any = {
        ...message,
        senderName: finalSenderName, // Use the populated senderName
        timestamp,
        createdAt: timestamp,
        status: MessageStatus.SENT, // Always set SENT status when saving to Firestore
      };

      // Remove undefined fields
      Object.keys(messageWithTimestamp).forEach(key => {
        if (messageWithTimestamp[key] === undefined) {
          delete messageWithTimestamp[key];
        }
      });

      const messageDoc = await addDoc(messagesRef, messageWithTimestamp);

      // 2. Update lastMessage in the chat document
      const chatRef = doc(db(), collection_name, chatId);
      await updateDoc(chatRef, {
        'lastMessage.text': message.text,
        'lastMessage.senderId': message.senderId,
        'lastMessage.senderName': finalSenderName, // Use the populated senderName
        'lastMessage.timestamp': timestamp,
        'lastMessage.type': message.type,
        updatedAt: timestamp,
      });

      // 3. Get chat details to extract participants
      const chatSnapshot = await getDoc(chatRef);
      const participants = chatSnapshot.get('participants') as string[];

      // 4. Update userChats for all participants
      if (participants && participants.length > 0) {
        for (const participantId of participants) {
          if (isGroupChat) {
            await this.updateUserChatForGroupChat(
              participantId,
              chatId,
              chatSnapshot.get('name') || 'Group Chat',
              chatSnapshot.get('imageURL') || chatSnapshot.get('avatarUrl') || chatSnapshot.get('avatar'),
              message.text,
              timestamp,
              message.senderId
            );
          } else {
            await this.updateUserChat(
              participantId,
              chatId,
              message.text,
              timestamp,
              message.senderId,
              participants
            );
          }
        }
      }

      return Resource.success(undefined);
    } catch (error: any) {
      console.error('Error sending message:', error);
      return Resource.error(error.message || 'Failed to send message');
    }
  }

  /**
   * Upload and send image group message (bulk upload)
   */
  async uploadAndSendImageGroup(
    chatId: string,
    currentUserId: string,
    currentUserName: string,
    imageFiles: File[],
    isGroupChat: boolean,
    shouldCompress: boolean,
    currentUserAvatar?: string,
    onProgress?: (overallPercentage: number) => void,
    abortSignal?: AbortSignal,
    tempId?: string
  ): Promise<Resource<void>> {
    try {
      const mediaItems: MediaItem[] = [];
      const totalFiles = imageFiles.length;

      // Calculate total size of all files
      const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
      let uploadedSize = 0;

      // Upload all images first
      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        let fileToUpload = imageFile;
        const fileSize = imageFile.size;

        // Check for cancellation
        if (abortSignal?.aborted) {
          return Resource.error('Upload cancelled');
        }

        // Compress image if requested
        if (shouldCompress && imageFile.type.startsWith('image/')) {
          try {
            fileToUpload = await compressImage(imageFile, 0.8, 1920);
          } catch (error) {
            console.error('Compression failed for image', i, '- using original:', error);
          }
        }

        // Generate filename
        const extension = this.getFileExtension(fileToUpload);
        const fileName = `IMG_${Date.now()}_${i}.${extension}`;

        // Upload to server with progress tracking
        const uploadResult = await uploadFileToChatkuAPI(
          fileToUpload,
          (filePercentage) => {
            // Calculate overall progress: (uploaded files + current file progress) / total
            const currentFileProgress = (fileSize * filePercentage) / 100;
            const totalUploadedSize = uploadedSize + currentFileProgress;
            const overallPercentage = Math.round((totalUploadedSize / totalSize) * 100);
            onProgress?.(overallPercentage);
          },
          abortSignal
        );

        if (uploadResult.status !== 'success' || !uploadResult.data) {
          return Resource.error(`Failed to upload image ${i + 1}`);
        }

        // Mark this file as fully uploaded
        uploadedSize += fileSize;

        const downloadUrl = uploadResult.data;

        // Create media item
        mediaItems.push({
          url: downloadUrl,
          metadata: {
            fileName,
            fileSize: fileToUpload.size,
            mimeType: fileToUpload.type,
            thumbnailUrl: downloadUrl,
          },
          order: i,
        });

        // Small delay between uploads to avoid overwhelming the server
        if (i < imageFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Create single message with all images
      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        ...(currentUserAvatar && { senderAvatar: currentUserAvatar }),
        text: `📷 ${mediaItems.length} Photos`,
        type: MessageType.IMAGE_GROUP,
        mediaItems,
        readBy: {},
        deliveredTo: {},
        ...(tempId && { tempId }),
      };

      return await this.sendMessage(chatId, message, isGroupChat);
    } catch (error: any) {
      console.error('Error uploading image group:', error);
      return Resource.error(error.message || 'Failed to upload images');
    }
  }

  /**
   * Upload and send image message
   */
  async uploadAndSendImage(
    chatId: string,
    currentUserId: string,
    currentUserName: string,
    imageFile: File,
    isGroupChat: boolean,
    shouldCompress: boolean,
    currentUserAvatar?: string,
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal,
    tempId?: string
  ): Promise<Resource<void>> {
    try {
      let fileToUpload = imageFile;

      // Compress image if requested
      if (shouldCompress && imageFile.type.startsWith('image/')) {
        try {
          // Use browser-image-compression with 80% quality, max 1920px
          fileToUpload = await compressImage(imageFile, 0.8, 1920);
        } catch (error) {
          console.error('Compression failed, using original file:', error);
          // If compression fails, use original file
        }
      }

      // Generate filename with timestamp and proper extension
      const extension = this.getFileExtension(fileToUpload);
      const fileName = `IMG_${Date.now()}.${extension}`;

      const uploadResult = await uploadFileToChatkuAPI(fileToUpload, onProgress, abortSignal);

      if (uploadResult.status !== 'success' || !uploadResult.data) {
        return Resource.error('Failed to upload image');
      }

      const downloadUrl = uploadResult.data;

      // Create media metadata
      const mediaMetadata: MediaMetadata = {
        fileName,
        fileSize: fileToUpload.size,
        mimeType: fileToUpload.type,
        thumbnailUrl: downloadUrl, // For images, use the same URL as mediaUrl
      };

      // Send message with image
      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        ...(currentUserAvatar && { senderAvatar: currentUserAvatar }),
        text: '🖼️ Photo',
        type: MessageType.IMAGE,
        mediaUrl: downloadUrl,
        mediaMetadata,
        readBy: {},
        deliveredTo: {},
        ...(tempId && { tempId }), // Store tempId for deduplication
      };

      return await this.sendMessage(chatId, message, isGroupChat);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      return Resource.error(error.message || 'Failed to upload image');
    }
  }

  /**
   * Upload and send video message
   */
  async uploadAndSendVideo(
    chatId: string,
    currentUserId: string,
    currentUserName: string,
    videoFile: File,
    isGroupChat: boolean,
    shouldCompress: boolean,
    currentUserAvatar?: string,
    onPhaseChange?: (phase: 'compressing' | 'uploading') => void,
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal,
    tempId?: string
  ): Promise<Resource<void>> {
    try {
      let fileToUpload = videoFile;

      // Compress video if requested
      if (shouldCompress && videoFile.type.startsWith('video/')) {
        try {
          // Report compressing phase
          onPhaseChange?.('compressing');

          // Use FFmpeg.wasm compression with 30% quality (720p max)
          fileToUpload = await compressVideo(videoFile, 0.3);
        } catch (error) {
          console.error('Video compression failed, using original file:', error);
          // If compression fails, use original file
        }
      }

      // Report uploading phase
      onPhaseChange?.('uploading');

      // Generate filename with timestamp and proper extension
      const extension = this.getFileExtension(fileToUpload);
      const fileName = `VID_${Date.now()}.${extension}`;

      const uploadResult = await uploadFileToChatkuAPI(fileToUpload, onProgress, abortSignal);

      if (uploadResult.status !== 'success' || !uploadResult.data) {
        return Resource.error('Failed to upload video');
      }

      const downloadUrl = uploadResult.data;

      // Create media metadata (no thumbnailUrl for videos)
      const mediaMetadata: MediaMetadata = {
        fileName,
        fileSize: fileToUpload.size,
        mimeType: fileToUpload.type,
      };

      // Send message with video
      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        ...(currentUserAvatar && { senderAvatar: currentUserAvatar }),
        text: '🎥 Video',
        type: MessageType.VIDEO,
        mediaUrl: downloadUrl,
        mediaMetadata,
        readBy: {},
        deliveredTo: {},
        ...(tempId && { tempId }), // Store tempId for deduplication
      };

      return await this.sendMessage(chatId, message, isGroupChat);
    } catch (error: any) {
      console.error('Error uploading video:', error);
      return Resource.error(error.message || 'Failed to upload video');
    }
  }

  /**
   * Upload and send document message
   */
  async uploadAndSendDocument(
    chatId: string,
    currentUserId: string,
    currentUserName: string,
    documentFile: File,
    isGroupChat: boolean,
    currentUserAvatar?: string,
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal,
    tempId?: string
  ): Promise<Resource<void>> {
    try {
      // Use original filename for documents (with timestamp prefix for uniqueness)
      const extension = this.getFileExtension(documentFile);
      const originalName = documentFile.name;
      const fileName = `DOC_${Date.now()}_${originalName}`;

      const uploadResult = await uploadFileToChatkuAPI(documentFile, onProgress, abortSignal);

      if (uploadResult.status !== 'success' || !uploadResult.data) {
        const errorMsg = uploadResult.status === 'error' ? uploadResult.message : 'Failed to upload document';
        return Resource.error(errorMsg || 'Failed to upload document');
      }

      const downloadUrl = uploadResult.data;

      // Create media metadata (no thumbnailUrl for documents)
      const mediaMetadata: MediaMetadata = {
        fileName: originalName, // Store original filename for display
        fileSize: documentFile.size,
        mimeType: documentFile.type || 'application/octet-stream',
      };

      // Send message with document (text format: 📄 {fileName})
      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        ...(currentUserAvatar && { senderAvatar: currentUserAvatar }),
        text: `📄 ${originalName}`,
        type: MessageType.DOCUMENT,
        mediaUrl: downloadUrl,
        mediaMetadata,
        readBy: {},
        deliveredTo: {},
        ...(tempId && { tempId }), // Store tempId for deduplication
      };

      return await this.sendMessage(chatId, message, isGroupChat);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      return Resource.error(error.message || 'Failed to upload document');
    }
  }

  /**
   * Mark messages as delivered (called when user opens the chat)
   */
  async markMessagesAsDelivered(
    chatId: string,
    userId: string,
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      const collection_name = isGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      const timestamp = Timestamp.now();

      const messagesRef = collection(
        db(),
        collection_name,
        chatId,
        this.MESSAGES_SUBCOLLECTION
      );
      const messagesSnapshot = await getDocs(messagesRef);

      const batch = writeBatch(db());
      let updateCount = 0;

      messagesSnapshot.docs.forEach((doc) => {
        const deliveredTo = (doc.get('deliveredTo') as Record<string, Timestamp>) || {};
        const senderId = doc.get('senderId');

        // Only update if:
        // 1. This user hasn't received it yet
        // 2. This user is NOT the sender
        if (!deliveredTo[userId] && senderId !== userId) {
          const messageRef = doc.ref;
          batch.update(messageRef, {
            [`deliveredTo.${userId}`]: timestamp,
          });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
      }

      return Resource.success(undefined);
    } catch (error: any) {
      console.error('Error marking messages as delivered:', error);
      return Resource.error(error.message || 'Failed to mark messages as delivered');
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(
    chatId: string,
    userId: string,
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      const collection_name = isGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      const timestamp = Timestamp.now();

      // FIRST: Reset unread count in userChats immediately
      const userChatRef = doc(db(), 'userChats', userId);
      const userChatSnapshot = await getDoc(userChatRef);

      if (userChatSnapshot.exists()) {
        const existingChats = userChatSnapshot.get('chats') as any[];
        const chatIndex = existingChats.findIndex((chat) => chat.chatId === chatId);

        if (chatIndex !== -1) {
          const updatedChats = [...existingChats];
          updatedChats[chatIndex] = {
            ...updatedChats[chatIndex],
            unreadCount: 0,
          };

          await updateDoc(userChatRef, {
            chats: updatedChats,
            updatedAt: timestamp,
          });
        }
      }

      // SECOND: Get ALL messages in the chat and mark as read and delivered
      const messagesRef = collection(
        db(),
        collection_name,
        chatId,
        this.MESSAGES_SUBCOLLECTION
      );
      const messagesSnapshot = await getDocs(messagesRef);

      // Batch update to mark all as read and delivered
      const batch = writeBatch(db());
      let updateCount = 0;

      messagesSnapshot.docs.forEach((doc) => {
        const readBy = (doc.get('readBy') as Record<string, Timestamp>) || {};
        const deliveredTo = (doc.get('deliveredTo') as Record<string, Timestamp>) || {};
        const senderId = doc.get('senderId');

        // Only update if this user is NOT the sender
        if (senderId !== userId) {
          const messageRef = doc.ref;
          const updates: any = {};

          // Mark as delivered if not already
          if (!deliveredTo[userId]) {
            updates[`deliveredTo.${userId}`] = timestamp;
          }

          // Mark as read if not already
          if (!readBy[userId]) {
            updates[`readBy.${userId}`] = timestamp;
            // IMPORTANT: Update status to READ when marking as read
            updates['status'] = MessageStatus.READ;
            console.log('[MessageRepository] Marking message as READ:', doc.id, 'Updates:', updates);
          }

          if (Object.keys(updates).length > 0) {
            batch.update(messageRef, updates);
            updateCount++;
          }
        }
      });

      if (updateCount > 0) {
        await batch.commit();
      }

      return Resource.success(undefined);
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
      return Resource.error(error.message || 'Failed to mark messages as read');
    }
  }

  /**
   * Mark a single message as delivered
   * This is called automatically when a user receives a message
   */
  async markMessageAsDelivered(
    chatId: string,
    messageId: string,
    userId: string,
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      const collection_name = isGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      const messageRef = doc(
        db(),
        collection_name,
        chatId,
        this.MESSAGES_SUBCOLLECTION,
        messageId
      );

      // Update message with delivered status
      await updateDoc(messageRef, {
        status: MessageStatus.DELIVERED,
        [`deliveredTo.${userId}`]: Timestamp.now()
      });

      console.log(`[MessageRepository] ✅ Message ${messageId} marked as DELIVERED for user ${userId}`);

      return Resource.success(undefined);
    } catch (error: any) {
      console.error('[MessageRepository] Error marking message as delivered:', error);
      return Resource.error(error.message || 'Failed to mark message as delivered');
    }
  }

  /**
   * Update userChats collection for a specific user (direct chat)
   */
  private async updateUserChat(
    userId: string,
    chatId: string,
    lastMessage: string,
    lastMessageTime: Timestamp,
    senderId: string,
    participants: string[]
  ): Promise<void> {
    try {
      const userChatRef = doc(db(), 'userChats', userId);
      const userChatSnapshot = await getDoc(userChatRef);

      // Get other user ID
      const otherUserId = participants.find((id) => id !== userId);
      if (!otherUserId) {
        return;
      }

      // Get other user's data
      const otherUserDoc = await getDoc(doc(db(), 'users', otherUserId));
      if (!otherUserDoc.exists()) {
        return;
      }

      const otherUserName = otherUserDoc.get('displayName') || 'Unknown';
      const otherUserAvatar = otherUserDoc.get('imageURL') || otherUserDoc.get('imageUrl');

      // Determine unread count
      const isSender = senderId === userId;
      let currentUnreadCount = 0;

      if (userChatSnapshot.exists()) {
        const chats = userChatSnapshot.get('chats') as any[];
        const existingChat = chats.find((chat) => chat.chatId === chatId);
        currentUnreadCount = existingChat?.unreadCount || 0;
      }

      const newUnreadCount = isSender ? 0 : currentUnreadCount + 1;

      // Create chat item update
      // Always update otherUserName and otherUserAvatar to keep them in sync with users collection
      const chatItemUpdate = {
        lastMessage,
        lastMessageTime,
        unreadCount: newUnreadCount,
        otherUserName,
        ...(otherUserAvatar && { otherUserAvatar }),
      };

      if (userChatSnapshot.exists()) {
        const existingChats = userChatSnapshot.get('chats') as any[];
        const existingChatIndex = existingChats.findIndex(
          (chat) => chat.chatId === chatId
        );

        const updatedChats =
          existingChatIndex !== -1
            ? existingChats.map((chat, index) =>
              index === existingChatIndex
                ? { ...chat, ...chatItemUpdate } // Merge to preserve existing fields
                : chat
            )
            : [{
              chatId,
              chatType: 'DIRECT',
              otherUserId,
              otherUserName,
              ...chatItemUpdate,
            }, ...existingChats];

        await updateDoc(userChatRef, {
          chats: updatedChats,
          updatedAt: lastMessageTime,
        });
      } else {
        await setDoc(userChatRef, {
          userId,
          chats: [{
            chatId,
            chatType: 'DIRECT',
            otherUserId,
            otherUserName,
            ...chatItemUpdate,
          }],
          updatedAt: lastMessageTime,
        });
      }
    } catch (error) {
      console.error('Error updating user chat:', error);
    }
  }

  /**
   * Update userChats collection for a specific user (group chat)
   */
  private async updateUserChatForGroupChat(
    userId: string,
    chatId: string,
    groupName: string,
    groupAvatar: string | undefined,
    lastMessage: string,
    lastMessageTime: Timestamp,
    senderId: string
  ): Promise<void> {
    try {
      const userChatRef = doc(db(), 'userChats', userId);
      const userChatSnapshot = await getDoc(userChatRef);

      // Get sender name for display
      const senderDoc = await getDoc(doc(db(), 'users', senderId));
      const senderName = senderDoc.exists() ? senderDoc.get('displayName') : 'Unknown';

      // Determine unread count
      const isSender = senderId === userId;
      let currentUnreadCount = 0;

      if (userChatSnapshot.exists()) {
        const chats = userChatSnapshot.get('chats') as any[];
        const existingChat = chats.find((chat) => chat.chatId === chatId);
        currentUnreadCount = existingChat?.unreadCount || 0;
      }

      const newUnreadCount = isSender ? 0 : currentUnreadCount + 1;

      // Format message with sender name for group chats
      const displayMessage = isSender ? lastMessage : `${senderName}: ${lastMessage}`;

      // Create chat item update (only fields that can change)
      const chatItemUpdate: any = {
        lastMessage: displayMessage,
        lastMessageTime,
        unreadCount: newUnreadCount,
      };

      if (userChatSnapshot.exists()) {
        const existingChats = userChatSnapshot.get('chats') as any[];
        const existingChatIndex = existingChats.findIndex(
          (chat) => chat.chatId === chatId
        );

        const updatedChats =
          existingChatIndex !== -1
            ? existingChats.map((chat, index) =>
              index === existingChatIndex
                ? { ...chat, ...chatItemUpdate } // Merge to preserve groupName, groupAvatar, etc
                : chat
            )
            : [{
              chatId,
              chatType: 'GROUP',
              groupName,
              ...(groupAvatar && { groupAvatar }),
              ...chatItemUpdate,
            }, ...existingChats];

        await updateDoc(userChatRef, {
          chats: updatedChats,
          updatedAt: lastMessageTime,
        });
      } else {
        await setDoc(userChatRef, {
          userId,
          chats: [{
            chatId,
            chatType: 'GROUP',
            groupName,
            ...(groupAvatar && { groupAvatar }),
            ...chatItemUpdate,
          }],
          updatedAt: lastMessageTime,
        });
      }
    } catch (error) {
      console.error('Error updating user chat for group:', error);
    }
  }

  /**
   * Delete a message (soft delete - changes text to "Pesan ini dihapus")
   */
  async deleteMessage(
    chatId: string,
    messageId: string,
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      const collection_name = isGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      const messageRef = doc(
        db(),
        collection_name,
        chatId,
        this.MESSAGES_SUBCOLLECTION,
        messageId
      );

      const timestamp = Timestamp.now();

      // Update message to show as deleted
      await updateDoc(messageRef, {
        text: 'Pesan ini dihapus',
        type: MessageType.TEXT,
        mediaUrl: null,
        mediaMetadata: null,
        deletedAt: timestamp,
        updatedAt: timestamp,
      });

      // Check if this was the last message and update chat
      const chatRef = doc(db(), collection_name, chatId);
      const chatSnapshot = await getDoc(chatRef);
      const lastMessage = chatSnapshot.get('lastMessage');

      if (lastMessage && lastMessage.timestamp) {
        const messageSnapshot = await getDoc(messageRef);
        const messageTimestamp = messageSnapshot.get('timestamp');

        // If this message's timestamp matches the last message timestamp, update it
        if (messageTimestamp && messageTimestamp.seconds === lastMessage.timestamp.seconds) {
          await updateDoc(chatRef, {
            'lastMessage.text': 'Pesan ini dihapus',
            'lastMessage.type': MessageType.TEXT,
            updatedAt: timestamp,
          });

          // Update userChats for all participants
          const participants = chatSnapshot.get('participants') as string[];
          if (participants && participants.length > 0) {
            for (const participantId of participants) {
              if (isGroupChat) {
                await this.updateUserChatForGroupChat(
                  participantId,
                  chatId,
                  chatSnapshot.get('name') || 'Group Chat',
                  chatSnapshot.get('imageURL') || chatSnapshot.get('avatarUrl') || chatSnapshot.get('avatar'),
                  'Pesan ini dihapus',
                  timestamp,
                  lastMessage.senderId
                );
              } else {
                await this.updateUserChat(
                  participantId,
                  chatId,
                  'Pesan ini dihapus',
                  timestamp,
                  lastMessage.senderId,
                  participants
                );
              }
            }
          }
        }
      }

      return Resource.success(undefined);
    } catch (error: any) {
      console.error('Error deleting message:', error);
      return Resource.error(error.message || 'Failed to delete message');
    }
  }

  /**
   * Edit a text message
   */
  async editMessage(
    chatId: string,
    messageId: string,
    newText: string,
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      if (!newText.trim()) {
        return Resource.error('Message text cannot be empty');
      }

      const collection_name = isGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      const messageRef = doc(
        db(),
        collection_name,
        chatId,
        this.MESSAGES_SUBCOLLECTION,
        messageId
      );

      const timestamp = Timestamp.now();

      // Update message text
      await updateDoc(messageRef, {
        text: newText.trim(),
        isEdited: true,
        editedAt: timestamp,
        updatedAt: timestamp,
      });

      // Check if this was the last message and update chat
      const chatRef = doc(db(), collection_name, chatId);
      const chatSnapshot = await getDoc(chatRef);
      const lastMessage = chatSnapshot.get('lastMessage');

      if (lastMessage && lastMessage.timestamp) {
        const messageSnapshot = await getDoc(messageRef);
        const messageTimestamp = messageSnapshot.get('timestamp');

        // If this message's timestamp matches the last message timestamp, update it
        if (messageTimestamp && messageTimestamp.seconds === lastMessage.timestamp.seconds) {
          await updateDoc(chatRef, {
            'lastMessage.text': newText.trim(),
            updatedAt: timestamp,
          });

          // Update userChats for all participants
          const participants = chatSnapshot.get('participants') as string[];
          if (participants && participants.length > 0) {
            for (const participantId of participants) {
              if (isGroupChat) {
                await this.updateUserChatForGroupChat(
                  participantId,
                  chatId,
                  chatSnapshot.get('name') || 'Group Chat',
                  chatSnapshot.get('imageURL') || chatSnapshot.get('avatarUrl') || chatSnapshot.get('avatar'),
                  newText.trim(),
                  timestamp,
                  lastMessage.senderId
                );
              } else {
                await this.updateUserChat(
                  participantId,
                  chatId,
                  newText.trim(),
                  timestamp,
                  lastMessage.senderId,
                  participants
                );
              }
            }
          }
        }
      }

      return Resource.success(undefined);
    } catch (error: any) {
      console.error('Error editing message:', error);
      return Resource.error(error.message || 'Failed to edit message');
    }
  }

  /**
   * Forward a message to another chat
   */
  async forwardMessage(
    messageId: string,
    sourceChatId: string,
    targetChatId: string,
    currentUserId: string
  ): Promise<Resource<void>> {
    try {
      // Get the original message
      const sourceCollection = collection(db(), this.DIRECT_CHATS_COLLECTION, sourceChatId, this.MESSAGES_SUBCOLLECTION);
      const sourceGroupCollection = collection(db(), this.GROUP_CHATS_COLLECTION, sourceChatId, this.MESSAGES_SUBCOLLECTION);

      // Try direct chat first
      let messageDoc = await getDoc(doc(sourceCollection, messageId));
      let isSourceGroupChat = false;

      // If not found in direct chat, try group chat
      if (!messageDoc.exists()) {
        messageDoc = await getDoc(doc(sourceGroupCollection, messageId));
        isSourceGroupChat = true;
      }

      if (!messageDoc.exists()) {
        return Resource.error('Message not found');
      }

      const originalMessage = messageDoc.data() as Message;

      // Check if target is a group chat
      const targetGroupChatDoc = await getDoc(doc(db(), this.GROUP_CHATS_COLLECTION, targetChatId));
      const isTargetGroupChat = targetGroupChatDoc.exists();

      // Create a new message with forwarded content
      const newMessage: Message = {
        messageId: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
        text: originalMessage.text,
        senderId: currentUserId,
        senderName: '', // Will be filled by sendMessage
        timestamp: Timestamp.now(),
        status: MessageStatus.SENT,
        type: originalMessage.type,
        readBy: {},
        deliveredTo: {},
        isForwarded: true, // Mark as forwarded message
        ...(originalMessage.mediaUrl && { mediaUrl: originalMessage.mediaUrl }),
        ...(originalMessage.mediaMetadata && { mediaMetadata: originalMessage.mediaMetadata }),
      };

      // Send the forwarded message
      return await this.sendMessage(targetChatId, newMessage, isTargetGroupChat);
    } catch (error: any) {
      console.error('Error forwarding message:', error);
      return Resource.error(error.message || 'Failed to forward message');
    }
  }

  /**
   * Forward multiple messages in batch (maintains order)
   * More efficient than forwarding one by one
   */
  async forwardMessages(
    messageIds: string[],
    sourceChatId: string,
    targetChatId: string,
    currentUserId: string,
    currentUserName: string
  ): Promise<Resource<{ successCount: number; failedCount: number }>> {
    try {
      if (messageIds.length === 0) {
        return Resource.error('No messages to forward');
      }

      const sourceDirectCollection = collection(db(), this.DIRECT_CHATS_COLLECTION, sourceChatId, this.MESSAGES_SUBCOLLECTION);
      const sourceGroupCollection = collection(db(), this.GROUP_CHATS_COLLECTION, sourceChatId, this.MESSAGES_SUBCOLLECTION);

      // Check if target is a group chat
      const targetGroupChatDoc = await getDoc(doc(db(), this.GROUP_CHATS_COLLECTION, targetChatId));
      const isTargetGroupChat = targetGroupChatDoc.exists();

      const targetCollection = isTargetGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      // Fetch all original messages in parallel
      const messagePromises = messageIds.map(async (messageId) => {
        // Try direct chat first
        let messageDoc = await getDoc(doc(sourceDirectCollection, messageId));

        // If not found, try group chat
        if (!messageDoc.exists()) {
          messageDoc = await getDoc(doc(sourceGroupCollection, messageId));
        }

        return {
          messageId,
          exists: messageDoc.exists(),
          data: messageDoc.exists() ? messageDoc.data() as Message : null
        };
      });

      const messageResults = await Promise.all(messagePromises);

      // Filter out messages that don't exist
      const validMessages = messageResults.filter(m => m.exists && m.data);

      if (validMessages.length === 0) {
        return Resource.error('No valid messages found');
      }

      // Sort messages by their original timestamp to maintain chronological order
      validMessages.sort((a, b) => {
        const aTime = a.data?.timestamp;
        const bTime = b.data?.timestamp;

        if (!aTime || !bTime) return 0;

        // Compare timestamps (older first)
        if (aTime.seconds !== bTime.seconds) {
          return aTime.seconds - bTime.seconds;
        }
        return aTime.nanoseconds - bTime.nanoseconds;
      });

      // Create batch (Firestore limit: 500 operations)
      const batch = writeBatch(db());
      const baseTimestamp = Timestamp.now();
      let batchCount = 0;
      const batches: any[] = [batch];

      // Create forwarded messages maintaining order
      // Add 50ms to each message to ensure proper ordering
      for (let i = 0; i < validMessages.length; i++) {
        const { data: originalMessage } = validMessages[i];
        if (!originalMessage) continue;

        // Check batch limit (500 operations per batch)
        if (batchCount >= 500) {
          batches.push(writeBatch(db()));
          batchCount = 0;
        }

        const currentBatch = batches[batches.length - 1];

        // Create new message reference
        const messagesRef = collection(db(), targetCollection, targetChatId, this.MESSAGES_SUBCOLLECTION);
        const newMessageRef = doc(messagesRef);

        // Create timestamp with incremental offset (50ms per message)
        const messageTimestamp = new Timestamp(
          baseTimestamp.seconds,
          baseTimestamp.nanoseconds + (i * 50000000) // 50ms = 50,000,000 nanoseconds
        );

        // Create forwarded message
        const forwardedMessage: Message = {
          messageId: newMessageRef.id,
          text: originalMessage.text || '',
          senderId: currentUserId,
          senderName: currentUserName,
          timestamp: messageTimestamp,
          createdAt: messageTimestamp,
          status: MessageStatus.SENT,
          type: originalMessage.type,
          readBy: {},
          deliveredTo: {},
          isForwarded: true,
          ...(originalMessage.mediaUrl && { mediaUrl: originalMessage.mediaUrl }),
          ...(originalMessage.mediaMetadata && { mediaMetadata: originalMessage.mediaMetadata }),
          ...(originalMessage.mediaItems && { mediaItems: originalMessage.mediaItems }),
        };

        currentBatch.set(newMessageRef, forwardedMessage);
        batchCount++;
      }

      // Commit all batches
      await Promise.all(batches.map(b => b.commit()));

      const successCount = validMessages.length;
      const failedCount = messageIds.length - successCount;

      return Resource.success({ successCount, failedCount });
    } catch (error: any) {
      console.error('Error forwarding messages:', error);
      return Resource.error(error.message || 'Failed to forward messages');
    }
  }

  /**
   * Delete message for current user only (soft delete)
   * Adds user to hideFrom map - message remains visible to others
   * Restriction: Only messages < 48 hours old can be deleted
   */
  async deleteMessageForMe(
    chatId: string,
    messageIds: string[],
    userId: string,
    isGroupChat: boolean
  ): Promise<Resource<{ successCount: number; failedMessages: string[] }>> {
    try {
      const collection_name = isGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      const timestamp = Timestamp.now();
      const batch = writeBatch(db());
      const failedMessages: string[] = [];
      let successCount = 0;

      // Process each message
      for (const messageId of messageIds) {
        const messageRef = doc(
          db(),
          collection_name,
          chatId,
          this.MESSAGES_SUBCOLLECTION,
          messageId
        );

        const messageDoc = await getDoc(messageRef);
        if (!messageDoc.exists()) {
          failedMessages.push(messageId);
          continue;
        }

        const message = messageDoc.data() as Message;

        // Check if message is within 48 hours
        if (message.timestamp) {
          const messageTime = message.timestamp.toMillis();
          const currentTime = Date.now();
          const hoursDiff = (currentTime - messageTime) / (1000 * 60 * 60);

          if (hoursDiff >= 48) {
            failedMessages.push(messageId);
            continue;
          }
        }

        // Check if user already deleted this message
        if (message.hideFrom && message.hideFrom[userId]) {
          // Already deleted, skip
          successCount++;
          continue;
        }

        // Add user to hideFrom map
        batch.update(messageRef, {
          [`hideFrom.${userId}`]: timestamp,
          updatedAt: timestamp,
        });

        successCount++;
      }

      if (successCount > 0) {
        await batch.commit();
      }

      // Return success with data about successes and failures
      // Caller can check failedMessages.length to show appropriate message
      return Resource.success({ successCount, failedMessages });
    } catch (error: any) {
      console.error('Error deleting messages for me:', error);
      return Resource.error(error.message || 'Gagal menghapus pesan');
    }
  }

  /**
   * Delete message for everyone (hard delete)
   * Sets isDeleted flag - message shows as "Pesan ini dihapus" for all users
   * Restriction: Only own messages < 15 minutes old can be deleted for everyone
   */
  async deleteMessageForEveryone(
    chatId: string,
    messageIds: string[],
    userId: string,
    isGroupChat: boolean
  ): Promise<Resource<{ successCount: number; failedMessages: string[] }>> {
    try {
      const collection_name = isGroupChat
        ? this.GROUP_CHATS_COLLECTION
        : this.DIRECT_CHATS_COLLECTION;

      const timestamp = Timestamp.now();
      const batch = writeBatch(db());
      const failedMessages: string[] = [];
      let successCount = 0;

      // Process each message
      for (const messageId of messageIds) {
        const messageRef = doc(
          db(),
          collection_name,
          chatId,
          this.MESSAGES_SUBCOLLECTION,
          messageId
        );

        const messageDoc = await getDoc(messageRef);
        if (!messageDoc.exists()) {
          failedMessages.push(messageId);
          continue;
        }

        const message = messageDoc.data() as Message;

        // Check if user is the sender
        if (message.senderId !== userId) {
          failedMessages.push(messageId);
          continue;
        }

        // Check if message is within 15 minutes
        if (message.timestamp) {
          const messageTime = message.timestamp.toMillis();
          const currentTime = Date.now();
          const minutesDiff = (currentTime - messageTime) / (1000 * 60);

          if (minutesDiff >= 15) {
            failedMessages.push(messageId);
            continue;
          }
        }

        // Set isDeleted flag
        batch.update(messageRef, {
          isDeleted: true,
          updatedAt: timestamp,
        });

        successCount++;
      }

      if (successCount > 0) {
        await batch.commit();

        // Update last message if needed
        const chatRef = doc(db(), collection_name, chatId);
        const chatSnapshot = await getDoc(chatRef);
        const lastMessage = chatSnapshot.get('lastMessage');

        if (lastMessage && lastMessage.timestamp) {
          // Check if any of the deleted messages was the last message
          for (const messageId of messageIds) {
            if (failedMessages.includes(messageId)) continue;

            const messageRef = doc(
              db(),
              collection_name,
              chatId,
              this.MESSAGES_SUBCOLLECTION,
              messageId
            );
            const messageSnapshot = await getDoc(messageRef);
            const messageTimestamp = messageSnapshot.get('timestamp');

            if (messageTimestamp && messageTimestamp.seconds === lastMessage.timestamp.seconds) {
              // Update chat's last message
              await updateDoc(chatRef, {
                'lastMessage.text': 'Pesan ini dihapus',
                updatedAt: timestamp,
              });

              // Update userChats for all participants
              const participants = chatSnapshot.get('participants') as string[];
              if (participants && participants.length > 0) {
                for (const participantId of participants) {
                  if (isGroupChat) {
                    await this.updateUserChatForGroupChat(
                      participantId,
                      chatId,
                      chatSnapshot.get('name') || 'Group Chat',
                      chatSnapshot.get('imageURL') || chatSnapshot.get('avatarUrl') || chatSnapshot.get('avatar'),
                      'Pesan ini dihapus',
                      timestamp,
                      lastMessage.senderId
                    );
                  } else {
                    await this.updateUserChat(
                      participantId,
                      chatId,
                      'Pesan ini dihapus',
                      timestamp,
                      lastMessage.senderId,
                      participants
                    );
                  }
                }
              }
              break;
            }
          }
        }
      }

      // Return success with data about successes and failures
      // Caller can check failedMessages.length to show appropriate message
      return Resource.success({ successCount, failedMessages });
    } catch (error: any) {
      console.error('Error deleting messages for everyone:', error);
      return Resource.error(error.message || 'Gagal menghapus pesan');
    }
  }
}
