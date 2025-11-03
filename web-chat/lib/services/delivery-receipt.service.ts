/**
 * Delivery Receipt Service (Simple - No FCM)
 *
 * Listens to userChats collection for new messages
 * Automatically marks messages as DELIVERED when user has web open
 *
 * How it works:
 * 1. Listen to userChats/{userId} for lastMessageTime changes
 * 2. When new message detected → get chat details
 * 3. Get latest undelivered message from that chat
 * 4. Mark as DELIVERED (since user has web open)
 *
 * Note: User must have web open for messages to be marked as DELIVERED
 */

import { doc, onSnapshot, collection, query, where, orderBy, limit, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { ChatItem, MessageStatus } from '@/types/models';

export class DeliveryReceiptService {
  private unsubscribe: (() => void) | null = null;
  private processedMessages = new Set<string>(); // Track already processed messages
  private lastProcessedTimes = new Map<string, number>(); // Track last message time per chat

  /**
   * Start listening to userChats for new messages
   * Automatically marks new messages as DELIVERED
   */
  startListening(userId: string): void {
    if (this.unsubscribe) {
      console.warn('[DeliveryReceipt] Already listening, stopping previous listener');
      this.stopListening();
    }

    const firestore = db();
    const userChatsRef = doc(firestore, 'userChats', userId);

    console.log('[DeliveryReceipt] Started listening for user:', userId);

    this.unsubscribe = onSnapshot(
      userChatsRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data();
        const chats = (data.chats || []) as ChatItem[];

        // Check each chat for new messages
        for (const chat of chats) {
          await this.checkChatForNewMessages(chat, userId);
        }
      },
      (error) => {
        console.error('[DeliveryReceipt] Error listening to userChats:', error);
      }
    );
  }

  /**
   * Check if chat has new messages and mark them as delivered
   */
  private async checkChatForNewMessages(chat: ChatItem, userId: string): Promise<void> {
    const chatId = chat.chatId;
    const isGroupChat = chat.chatType === 'GROUP';

    // Get last message time for this chat
    const lastMessageTime = chat.lastMessageTime;
    if (!lastMessageTime) return;

    const lastMessageMillis = this.getTimestampMillis(lastMessageTime);

    // Check if this is a new message (compared to last processed time)
    const previousTime = this.lastProcessedTimes.get(chatId);
    if (previousTime && lastMessageMillis <= previousTime) {
      // No new messages
      return;
    }

    // Update last processed time
    this.lastProcessedTimes.set(chatId, lastMessageMillis);

    // Skip if there's no unread count (no new messages for this user)
    if (!chat.unreadCount || chat.unreadCount === 0) {
      return;
    }

    console.log('[DeliveryReceipt] New message detected in chat:', chatId, 'isGroup:', isGroupChat);

    // Get undelivered messages from this chat
    await this.markUndeliveredMessagesAsDelivered(chatId, userId, isGroupChat);
  }

  /**
   * Get undelivered messages and mark them as delivered
   */
  private async markUndeliveredMessagesAsDelivered(
    chatId: string,
    userId: string,
    isGroupChat: boolean
  ): Promise<void> {
    try {
      const firestore = db();
      const collectionPath = isGroupChat ? 'groupChats' : 'directChats';
      const messagesRef = collection(firestore, collectionPath, chatId, 'messages');

      // Query for messages that are:
      // 1. NOT sent by current user
      // 2. Have status SENT (not already DELIVERED or READ)
      // 3. Not yet delivered to current user
      const q = query(
        messagesRef,
        where('status', '==', MessageStatus.SENT),
        orderBy('timestamp', 'desc'),
        limit(10) // Only check last 10 messages for performance
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return;
      }

      // Process each undelivered message
      const updates: Promise<void>[] = [];

      snapshot.docs.forEach((docSnap) => {
        const message = docSnap.data();
        const messageId = docSnap.id;

        // Skip if message is from current user
        if (message.senderId === userId) {
          return;
        }

        // Skip if already delivered to this user
        const deliveredTo = message.deliveredTo || {};
        if (deliveredTo[userId]) {
          return;
        }

        // Skip if already processed (in this session)
        const processKey = `${chatId}_${messageId}`;
        if (this.processedMessages.has(processKey)) {
          return;
        }

        // Mark as processed
        this.processedMessages.add(processKey);

        // Mark as delivered
        console.log('[DeliveryReceipt] Marking message as DELIVERED:', messageId);

        const updatePromise = updateDoc(docSnap.ref, {
          status: MessageStatus.DELIVERED,
          [`deliveredTo.${userId}`]: Timestamp.now()
        }).catch(error => {
          console.error('[DeliveryReceipt] Error marking message as delivered:', error);
          // Remove from processed set so it can be retried
          this.processedMessages.delete(processKey);
        });

        updates.push(updatePromise);
      });

      // Wait for all updates to complete
      await Promise.all(updates);

      if (updates.length > 0) {
        console.log(`[DeliveryReceipt] ✅ Marked ${updates.length} messages as DELIVERED in chat ${chatId}`);
      }
    } catch (error) {
      console.error('[DeliveryReceipt] Error marking messages as delivered:', error);
    }
  }

  /**
   * Helper to convert Firestore timestamp to milliseconds
   */
  private getTimestampMillis(timestamp: any): number {
    if (!timestamp) return 0;

    // If it's a Firestore Timestamp
    if (typeof timestamp.toMillis === 'function') {
      return timestamp.toMillis();
    }

    // If it's a plain object with seconds
    if (timestamp.seconds !== undefined) {
      return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
    }

    return 0;
  }

  /**
   * Stop listening to userChats
   */
  stopListening(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log('[DeliveryReceipt] Stopped listening');
    }

    // Clear tracking
    this.processedMessages.clear();
    this.lastProcessedTimes.clear();
  }
}

// Singleton instance
let deliveryReceiptService: DeliveryReceiptService | null = null;

/**
 * Get singleton instance of delivery receipt service
 */
export function getDeliveryReceiptService(): DeliveryReceiptService {
  if (!deliveryReceiptService) {
    deliveryReceiptService = new DeliveryReceiptService();
  }
  return deliveryReceiptService;
}
