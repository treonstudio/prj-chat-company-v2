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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { Message, MessageType, MediaMetadata } from '@/types/models';
import { Resource } from '@/types/resource';
import imageCompression from 'browser-image-compression';

export class MessageRepository {
  private readonly DIRECT_CHATS_COLLECTION = 'directChats';
  private readonly GROUP_CHATS_COLLECTION = 'groupChats';
  private readonly MESSAGES_SUBCOLLECTION = 'messages';

  /**
   * Get messages with real-time updates
   */
  getMessages(
    chatId: string,
    isGroupChat: boolean,
    onUpdate: (messages: Message[]) => void,
    onError: (error: string) => void
  ): () => void {
    const collection_name = isGroupChat
      ? this.GROUP_CHATS_COLLECTION
      : this.DIRECT_CHATS_COLLECTION;

    const messagesRef = collection(
      db,
      collection_name,
      chatId,
      this.MESSAGES_SUBCOLLECTION
    );

    const q = query(messagesRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messages = snapshot.docs.map((doc) => ({
          ...doc.data(),
          messageId: doc.id,
        })) as Message[];

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

      // 1. Add message to messages subcollection
      const messagesRef = collection(
        db,
        collection_name,
        chatId,
        this.MESSAGES_SUBCOLLECTION
      );

      const messageWithTimestamp = {
        ...message,
        timestamp,
        createdAt: timestamp,
      };

      const messageDoc = await addDoc(messagesRef, messageWithTimestamp);

      // 2. Update lastMessage in the chat document
      const chatRef = doc(db, collection_name, chatId);
      await updateDoc(chatRef, {
        'lastMessage.text': message.text,
        'lastMessage.senderId': message.senderId,
        'lastMessage.senderName': message.senderName,
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
              chatSnapshot.get('avatarUrl'),
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
   * Upload and send image message
   */
  async uploadAndSendImage(
    chatId: string,
    currentUserId: string,
    currentUserName: string,
    imageFile: File,
    isGroupChat: boolean,
    shouldCompress: boolean
  ): Promise<Resource<void>> {
    try {
      let fileToUpload = imageFile;

      // Compress image if requested
      if (shouldCompress && imageFile.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        fileToUpload = await imageCompression(imageFile, options);
      }

      // Upload to Firebase Storage
      const collection_name = isGroupChat ? 'group' : 'direct';
      const fileName = `IMG_${Date.now()}.${fileToUpload.name.split('.').pop()}`;
      const storageRef = ref(
        storage,
        `chats/${collection_name}/${chatId}/${crypto.randomUUID()}/${fileName}`
      );

      await uploadBytes(storageRef, fileToUpload);
      const downloadUrl = await getDownloadURL(storageRef);

      // Create media metadata
      const mediaMetadata: MediaMetadata = {
        fileName,
        fileSize: fileToUpload.size,
        mimeType: fileToUpload.type,
        thumbnailUrl: downloadUrl, // For images, use the same URL
      };

      // Send message with image
      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        text: '🖼️ Photo',
        type: MessageType.IMAGE,
        mediaUrl: downloadUrl,
        mediaMetadata,
        readBy: {},
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
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      // Upload to Firebase Storage
      const collection_name = isGroupChat ? 'group' : 'direct';
      const fileName = `VID_${Date.now()}.${videoFile.name.split('.').pop()}`;
      const storageRef = ref(
        storage,
        `chats/${collection_name}/${chatId}/${crypto.randomUUID()}/${fileName}`
      );

      await uploadBytes(storageRef, videoFile);
      const downloadUrl = await getDownloadURL(storageRef);

      // Create media metadata
      const mediaMetadata: MediaMetadata = {
        fileName,
        fileSize: videoFile.size,
        mimeType: videoFile.type,
      };

      // Send message with video
      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        text: '🎥 Video',
        type: MessageType.VIDEO,
        mediaUrl: downloadUrl,
        mediaMetadata,
        readBy: {},
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
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      // Upload to Firebase Storage
      const collection_name = isGroupChat ? 'group' : 'direct';
      const fileName = documentFile.name;
      const storageRef = ref(
        storage,
        `chats/${collection_name}/${chatId}/documents/${crypto.randomUUID()}/${fileName}`
      );

      await uploadBytes(storageRef, documentFile);
      const downloadUrl = await getDownloadURL(storageRef);

      // Create media metadata
      const mediaMetadata: MediaMetadata = {
        fileName,
        fileSize: documentFile.size,
        mimeType: documentFile.type,
      };

      // Send message with document
      const message: Message = {
        messageId: '',
        senderId: currentUserId,
        senderName: currentUserName,
        text: `📄 ${fileName}`,
        type: MessageType.DOCUMENT,
        mediaUrl: downloadUrl,
        mediaMetadata,
        readBy: {},
      };

      return await this.sendMessage(chatId, message, isGroupChat);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      return Resource.error(error.message || 'Failed to upload document');
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
      const userChatRef = doc(db, 'userChats', userId);
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

      // SECOND: Get ALL messages in the chat and mark as read
      const messagesRef = collection(
        db,
        collection_name,
        chatId,
        this.MESSAGES_SUBCOLLECTION
      );
      const messagesSnapshot = await getDocs(messagesRef);

      // Batch update to mark all as read
      const batch = writeBatch(db);
      let updateCount = 0;

      messagesSnapshot.docs.forEach((doc) => {
        const readBy = (doc.get('readBy') as Record<string, Timestamp>) || {};
        const senderId = doc.get('senderId');

        // Only update if:
        // 1. This user hasn't read it yet
        // 2. This user is NOT the sender
        if (!readBy[userId] && senderId !== userId) {
          const messageRef = doc.ref;
          batch.update(messageRef, {
            [`readBy.${userId}`]: timestamp,
          });
          updateCount++;
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
      const userChatRef = doc(db, 'userChats', userId);
      const userChatSnapshot = await getDoc(userChatRef);

      // Get other user ID
      const otherUserId = participants.find((id) => id !== userId);
      if (!otherUserId) {
        return;
      }

      // Get other user's data
      const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
      if (!otherUserDoc.exists()) {
        return;
      }

      const otherUserName = otherUserDoc.get('displayName') || 'Unknown';
      const otherUserAvatar = otherUserDoc.get('avatarUrl');

      // Determine unread count
      const isSender = senderId === userId;
      let currentUnreadCount = 0;

      if (userChatSnapshot.exists()) {
        const chats = userChatSnapshot.get('chats') as any[];
        const existingChat = chats.find((chat) => chat.chatId === chatId);
        currentUnreadCount = existingChat?.unreadCount || 0;
      }

      const newUnreadCount = isSender ? 0 : currentUnreadCount + 1;

      // Create chat item
      const chatItem = {
        chatId,
        chatType: 'DIRECT',
        otherUserId,
        otherUserName,
        lastMessage,
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
              index === existingChatIndex ? chatItem : chat
            )
            : [chatItem, ...existingChats];

        await updateDoc(userChatRef, {
          chats: updatedChats,
          updatedAt: lastMessageTime,
        });
      } else {
        await setDoc(userChatRef, {
          userId,
          chats: [chatItem],
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
      const userChatRef = doc(db, 'userChats', userId);
      const userChatSnapshot = await getDoc(userChatRef);

      // Determine unread count
      const isSender = senderId === userId;
      let currentUnreadCount = 0;

      if (userChatSnapshot.exists()) {
        const chats = userChatSnapshot.get('chats') as any[];
        const existingChat = chats.find((chat) => chat.chatId === chatId);
        currentUnreadCount = existingChat?.unreadCount || 0;
      }

      const newUnreadCount = isSender ? 0 : currentUnreadCount + 1;

      // Create chat item for group
      const chatItem = {
        chatId,
        chatType: 'GROUP',
        groupName,
        groupAvatar,
        lastMessage,
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
              index === existingChatIndex ? chatItem : chat
            )
            : [chatItem, ...existingChats];

        await updateDoc(userChatRef, {
          chats: updatedChats,
          updatedAt: lastMessageTime,
        });
      } else {
        await setDoc(userChatRef, {
          userId,
          chats: [chatItem],
          updatedAt: lastMessageTime,
        });
      }
    } catch (error) {
      console.error('Error updating user chat for group:', error);
    }
  }
}
