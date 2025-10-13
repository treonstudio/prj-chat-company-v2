import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { DirectChat, UserChats, ChatItem, GroupChat } from '@/types/models';
import { Resource } from '@/types/resource';

export class ChatRepository {
  private readonly DIRECT_CHATS_COLLECTION = 'directChats';
  private readonly GROUP_CHATS_COLLECTION = 'groupChats';
  private readonly USER_CHATS_COLLECTION = 'userChats';

  /**
   * Get or create direct chat between two users
   */
  async getOrCreateDirectChat(
    currentUserId: string,
    otherUserId: string
  ): Promise<Resource<DirectChat>> {
    try {
      // Create a deterministic chat ID based on user IDs (sorted)
      const participants = [currentUserId, otherUserId].sort();
      const chatId = `direct_${participants[0]}_${participants[1]}`;

      const chatRef = doc(db, this.DIRECT_CHATS_COLLECTION, chatId);
      const chatDoc = await getDoc(chatRef);

      if (chatDoc.exists()) {
        const data = chatDoc.data() as DirectChat;
        return Resource.success({ ...data, chatId });
      }

      // Create new direct chat
      const newChat: DirectChat = {
        chatId,
        participants,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(chatRef, newChat);
      return Resource.success(newChat);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to get or create chat');
    }
  }

  /**
   * Get group chat by ID
   */
  async getGroupChat(chatId: string): Promise<Resource<GroupChat>> {
    try {
      const chatRef = doc(db, this.GROUP_CHATS_COLLECTION, chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        return Resource.error('Group chat not found');
      }

      const data = chatDoc.data() as GroupChat;
      return Resource.success({ ...data, chatId });
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to get group chat');
    }
  }

  /**
   * Get user chats with real-time updates
   */
  getUserChats(
    userId: string,
    onUpdate: (chats: ChatItem[]) => void,
    onError: (error: string) => void
  ): () => void {
    const userChatsRef = doc(db, this.USER_CHATS_COLLECTION, userId);

    const unsubscribe = onSnapshot(
      userChatsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserChats;
          // Sort chats by last message time (descending)
          const sortedChats = [...data.chats].sort((a, b) => {
            return b.lastMessageTime.seconds - a.lastMessageTime.seconds;
          });
          onUpdate(sortedChats);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        onError(error.message || 'Failed to fetch chats');
      }
    );

    return unsubscribe;
  }
}
