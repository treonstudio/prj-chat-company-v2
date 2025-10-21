import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { DirectChat, UserChats, ChatItem, GroupChat, ChatType } from '@/types/models';
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
      const chatId = `${participants[0]}_${participants[1]}`;

      const chatRef = doc(db(), this.DIRECT_CHATS_COLLECTION, chatId);
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
      const chatRef = doc(db(), this.GROUP_CHATS_COLLECTION, chatId);
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
   * Create a new group chat
   */
  async createGroupChat(
    groupName: string,
    creatorId: string,
    memberIds: string[],
    imageUrl?: string
  ): Promise<Resource<GroupChat>> {
    try {
      // Create unique group chat ID
      const groupChatRef = doc(collection(db(), this.GROUP_CHATS_COLLECTION));
      const chatId = groupChatRef.id;

      // Ensure creator is in the participants list
      const participants = Array.from(new Set([creatorId, ...memberIds]));

      // Initialize usersJoinedAt for all founding members
      const now = Timestamp.now();
      const usersJoinedAt: Record<string, Timestamp> = {};
      participants.forEach(userId => {
        usersJoinedAt[userId] = now;
      });

      const newGroupChat: GroupChat = {
        chatId,
        name: groupName,
        ...(imageUrl && { avatarUrl: imageUrl }),
        participants,
        admins: [creatorId], // Creator is automatically admin
        usersJoinedAt, // Track join dates for message filtering on rejoin
        createdAt: now,
        updatedAt: now,
      };

      // Use batch write to create group chat and update all participants' userChats
      const batch = writeBatch(db());

      // Create group chat document
      batch.set(groupChatRef, newGroupChat);

      // Create chat item for each participant
      const chatItem: ChatItem = {
        chatId,
        chatType: ChatType.GROUP,
        groupName,
        ...(imageUrl && { groupAvatar: imageUrl }),
        lastMessage: 'Group created',
        lastMessageTime: Timestamp.now(),
        unreadCount: 0,
      };

      // Update each participant's userChats
      for (const participantId of participants) {
        const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, participantId);
        const userChatsDoc = await getDoc(userChatsRef);

        if (userChatsDoc.exists()) {
          // User has existing chats, check if chat already exists
          const data = userChatsDoc.data() as UserChats;
          const existingChatIndex = data.chats.findIndex((c) => c.chatId === chatId);

          if (existingChatIndex === -1) {
            // Chat doesn't exist, add it
            batch.update(userChatsRef, {
              chats: arrayUnion(chatItem),
              updatedAt: Timestamp.now(),
            });
          }
          // If chat exists, skip adding (no need to update)
        } else {
          // Create new userChats document
          batch.set(userChatsRef, {
            userId: participantId,
            chats: [chatItem],
            updatedAt: Timestamp.now(),
          });
        }
      }

      await batch.commit();
      return Resource.success(newGroupChat);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to create group chat');
    }
  }

  /**
   * Start a direct chat with another user (or get existing)
   */
  async startDirectChat(
    currentUserId: string,
    currentUserName: string,
    otherUserId: string,
    otherUserName: string,
    otherUserAvatar?: string
  ): Promise<Resource<string>> {
    try {
      // Get or create direct chat
      const chatResult = await this.getOrCreateDirectChat(currentUserId, otherUserId);

      if (chatResult.status !== 'success') {
        return Resource.error(chatResult.status === 'error' ? chatResult.message : 'Failed to create chat');
      }

      const chat = chatResult.data;

      // Check if chat item already exists in userChats for both users
      const currentUserChatsRef = doc(db(), this.USER_CHATS_COLLECTION, currentUserId);
      const otherUserChatsRef = doc(db(), this.USER_CHATS_COLLECTION, otherUserId);

      const [currentUserChatsDoc, otherUserChatsDoc] = await Promise.all([
        getDoc(currentUserChatsRef),
        getDoc(otherUserChatsRef),
      ]);

      // Check if current user already has this chat
      let currentUserHasChat = false;
      if (currentUserChatsDoc.exists()) {
        const data = currentUserChatsDoc.data() as UserChats;
        currentUserHasChat = data.chats.some((c) => c.chatId === chat.chatId);
      }

      // Check if other user already has this chat
      let otherUserHasChat = false;
      if (otherUserChatsDoc.exists()) {
        const data = otherUserChatsDoc.data() as UserChats;
        otherUserHasChat = data.chats.some((c) => c.chatId === chat.chatId);
      }

      // If both users already have the chat, just return the chatId
      if (currentUserHasChat && otherUserHasChat) {
        return Resource.success(chat.chatId);
      }

      const batch = writeBatch(db());

      // Add chat to current user's chat list if not exists
      if (!currentUserHasChat) {
        const chatItemForCurrentUser: ChatItem = {
          chatId: chat.chatId,
          chatType: ChatType.DIRECT,
          otherUserId,
          otherUserName,
          ...(otherUserAvatar && { otherUserAvatar }),
          lastMessage: 'Start conversation',
          lastMessageTime: Timestamp.now(),
          unreadCount: 0,
        };

        if (currentUserChatsDoc.exists()) {
          batch.update(currentUserChatsRef, {
            chats: arrayUnion(chatItemForCurrentUser),
            updatedAt: Timestamp.now(),
          });
        } else {
          batch.set(currentUserChatsRef, {
            userId: currentUserId,
            chats: [chatItemForCurrentUser],
            updatedAt: Timestamp.now(),
          });
        }
      }

      // Add chat to other user's chat list if not exists
      if (!otherUserHasChat) {
        const chatItemForOtherUser: ChatItem = {
          chatId: chat.chatId,
          chatType: ChatType.DIRECT,
          otherUserId: currentUserId,
          otherUserName: currentUserName,
          // Note: Current user avatar not passed, would need to be added if available
          lastMessage: 'Start conversation',
          lastMessageTime: Timestamp.now(),
          unreadCount: 0,
        };

        if (otherUserChatsDoc.exists()) {
          batch.update(otherUserChatsRef, {
            chats: arrayUnion(chatItemForOtherUser),
            updatedAt: Timestamp.now(),
          });
        } else {
          batch.set(otherUserChatsRef, {
            userId: otherUserId,
            chats: [chatItemForOtherUser],
            updatedAt: Timestamp.now(),
          });
        }
      }

      await batch.commit();
      return Resource.success(chat.chatId);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to start chat');
    }
  }

  /**
   * Leave a group chat (voluntary leave)
   * Based on: LEAVE_GROUP_FEATURE.md
   */
  async leaveGroupChat(
    userId: string,
    chatId: string,
    userName: string
  ): Promise<Resource<void>> {
    try {
      // Remove any prefix from chatId if exists
      const cleanChatId = chatId.replace('direct_', '').replace('group_', '');

      // Get group chat to verify it exists and user is a participant
      const groupChatRef = doc(db(), this.GROUP_CHATS_COLLECTION, cleanChatId);
      const groupChatDoc = await getDoc(groupChatRef);

      if (!groupChatDoc.exists()) {
        console.error('Group chat not found:', {
          originalChatId: chatId,
          cleanChatId,
          collection: this.GROUP_CHATS_COLLECTION
        });
        return Resource.error('Group chat not found');
      }

      const groupChat = groupChatDoc.data() as GroupChat;

      // Check if user is a participant
      if (!groupChat.participants.includes(userId)) {
        return Resource.error('You are not a member of this group');
      }

      const batch = writeBatch(db());
      const now = Timestamp.now();

      // 1. Remove user from participants array
      const updatedParticipants = groupChat.participants.filter(
        (id) => id !== userId
      );

      // 2. Remove user from participantsMap
      const updatedParticipantsMap = { ...(groupChat.participantsMap || {}) };
      delete updatedParticipantsMap[userId];

      // 3. Remove user from admins if applicable
      const isAdmin = (groupChat.admins || []).includes(userId);
      let updatedAdmins = [...(groupChat.admins || [])];

      if (isAdmin) {
        updatedAdmins = updatedAdmins.filter((id) => id !== userId);

        // If last admin leaves and there are other participants, randomly pick new admin
        if (updatedParticipants.length > 0 && updatedAdmins.length === 0) {
          const randomIndex = Math.floor(Math.random() * updatedParticipants.length);
          const newAdmin = updatedParticipants[randomIndex];
          updatedAdmins = [newAdmin];
        }
      }

      // 4. Remove user from unreadCount
      const updatedUnreadCount = { ...(groupChat.unreadCount || {}) };
      delete updatedUnreadCount[userId];

      // 5. Add user to leftMembers with timestamp
      const updatedLeftMembers = { ...(groupChat.leftMembers || {}) };
      updatedLeftMembers[userId] = now;

      // 6. Update group chat document
      // NOTE: usersJoinedAt is NOT modified (preserved for rejoin)
      batch.update(groupChatRef, {
        participants: updatedParticipants,
        participantsMap: updatedParticipantsMap,
        admins: updatedAdmins,
        unreadCount: updatedUnreadCount,
        leftMembers: updatedLeftMembers,
        updatedAt: now,
      });

      // 7. Create system message for leave notification
      const messagesRef = collection(
        db(),
        this.GROUP_CHATS_COLLECTION,
        cleanChatId,
        'messages'
      );
      const systemMessageRef = doc(messagesRef);

      batch.set(systemMessageRef, {
        messageId: systemMessageRef.id,
        senderId: 'system',
        senderName: 'System',
        text: `${userName} keluar`,
        type: 'TEXT',
        timestamp: now,
        createdAt: now,
        status: 'SENT',
        readBy: {},
      });

      // 8. Update last message in remaining participants' userChats
      const systemMessageText = `${userName} keluar`;
      for (const participantId of updatedParticipants) {
        const participantChatsRef = doc(db(), this.USER_CHATS_COLLECTION, participantId);
        const participantChatsDoc = await getDoc(participantChatsRef);

        if (participantChatsDoc.exists()) {
          const participantData = participantChatsDoc.data() as UserChats;
          const updatedChats = participantData.chats.map((chat) => {
            if (chat.chatId === cleanChatId) {
              return {
                ...chat,
                lastMessage: systemMessageText,
                lastMessageTime: now,
              };
            }
            return chat;
          });

          batch.update(participantChatsRef, {
            chats: updatedChats,
            updatedAt: now,
          });
        }
      }

      // 9. Delete group from user's userChats collection
      const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, userId);
      const userChatsDoc = await getDoc(userChatsRef);

      if (userChatsDoc.exists()) {
        const userData = userChatsDoc.data() as UserChats;
        const updatedChats = userData.chats.filter(
          (chat) => chat.chatId !== cleanChatId
        );

        batch.update(userChatsRef, {
          chats: updatedChats,
          updatedAt: now,
        });
      }

      await batch.commit();
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to leave group chat');
    }
  }

  /**
   * Remove participants from group chat (admin action)
   * Based on: LEAVE_GROUP_FEATURE.md
   */
  async removeGroupMember(
    chatId: string,
    adminId: string,
    adminName: string,
    userIdToRemove: string
  ): Promise<Resource<void>> {
    try {
      // Get group chat to verify it exists
      const groupChatRef = doc(db(), this.GROUP_CHATS_COLLECTION, chatId);
      const groupChatDoc = await getDoc(groupChatRef);

      if (!groupChatDoc.exists()) {
        return Resource.error('Group chat not found');
      }

      const groupChat = groupChatDoc.data() as GroupChat;

      // Verify admin permission
      if (!groupChat.admins?.includes(adminId)) {
        return Resource.error('Only admins can remove participants');
      }

      // Check if user is a participant
      if (!groupChat.participants.includes(userIdToRemove)) {
        return Resource.error('User is not a member of this group');
      }

      // Safety check: Prevent removing all participants
      if (groupChat.participants.length === 1) {
        return Resource.error('Cannot remove all participants');
      }

      // Safety check: Ensure at least one admin remains
      const isRemovedUserAdmin = groupChat.admins?.includes(userIdToRemove);
      if (isRemovedUserAdmin) {
        const remainingAdmins = groupChat.admins.filter(id => id !== userIdToRemove);
        if (remainingAdmins.length === 0) {
          return Resource.error('Cannot remove all admins. At least one admin must remain.');
        }
      }

      // Get removed member's name for system message
      const removedMemberRef = doc(db(), 'users', userIdToRemove);
      const removedMemberDoc = await getDoc(removedMemberRef);
      const removedMemberName = removedMemberDoc.exists()
        ? (removedMemberDoc.data().displayName || 'User')
        : 'User';

      // Use batch to update group chat and user's chat list
      const batch = writeBatch(db());
      const now = Timestamp.now();

      // 1. Remove user from participants array
      const updatedParticipants = groupChat.participants.filter(
        (id) => id !== userIdToRemove
      );

      // 2. Remove user from participantsMap
      const updatedParticipantsMap = { ...(groupChat.participantsMap || {}) };
      delete updatedParticipantsMap[userIdToRemove];

      // 3. Remove from admins if they are an admin
      const updatedAdmins = (groupChat.admins || []).filter(
        (id) => id !== userIdToRemove
      );

      // 4. Remove user from unreadCount
      const updatedUnreadCount = { ...(groupChat.unreadCount || {}) };
      delete updatedUnreadCount[userIdToRemove];

      // 5. Add to leftMembers with timestamp
      const updatedLeftMembers = { ...(groupChat.leftMembers || {}) };
      updatedLeftMembers[userIdToRemove] = now;

      // 6. Update group chat document
      // NOTE: usersJoinedAt is NOT modified (preserved for rejoin)
      batch.update(groupChatRef, {
        participants: updatedParticipants,
        participantsMap: updatedParticipantsMap,
        admins: updatedAdmins,
        unreadCount: updatedUnreadCount,
        leftMembers: updatedLeftMembers,
        updatedAt: now,
      });

      // 7. Create system message for removing member
      const messagesRef = collection(db(), this.GROUP_CHATS_COLLECTION, chatId, 'messages');
      const systemMessageRef = doc(messagesRef);
      const systemMessageText = `${adminName} mengeluarkan ${removedMemberName}`;

      batch.set(systemMessageRef, {
        messageId: systemMessageRef.id,
        senderId: 'system',
        senderName: 'System',
        text: systemMessageText,
        type: 'TEXT',
        timestamp: now,
        createdAt: now,
        status: 'SENT',
        readBy: {},
      });

      // 8. Update lastMessage for all remaining participants
      for (const participantId of updatedParticipants) {
        const participantChatsRef = doc(db(), this.USER_CHATS_COLLECTION, participantId);
        const participantChatsDoc = await getDoc(participantChatsRef);

        if (participantChatsDoc.exists()) {
          const participantChats = participantChatsDoc.data() as UserChats;
          const updatedChats = participantChats.chats.map((chat) => {
            if (chat.chatId === chatId) {
              return {
                ...chat,
                lastMessage: systemMessageText,
                lastMessageTime: now,
              };
            }
            return chat;
          });

          batch.update(participantChatsRef, {
            chats: updatedChats,
            updatedAt: now,
          });
        }
      }

      // 9. Delete group from removed user's userChats collection
      const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, userIdToRemove);
      const userChatsDoc = await getDoc(userChatsRef);

      if (userChatsDoc.exists()) {
        const userData = userChatsDoc.data() as UserChats;
        const updatedChats = userData.chats.filter(
          (chat) => chat.chatId !== chatId
        );

        batch.update(userChatsRef, {
          chats: updatedChats,
          updatedAt: now,
        });
      }

      await batch.commit();
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to remove group member');
    }
  }

  /**
   * Promote member to admin
   */
  async promoteToAdmin(
    chatId: string,
    userId: string
  ): Promise<Resource<void>> {
    try {
      const groupChatRef = doc(db(), this.GROUP_CHATS_COLLECTION, chatId);
      const groupChatDoc = await getDoc(groupChatRef);

      if (!groupChatDoc.exists()) {
        return Resource.error('Group chat not found');
      }

      const groupChat = groupChatDoc.data() as GroupChat;

      // Check if user is a participant
      if (!groupChat.participants.includes(userId)) {
        return Resource.error('User is not a member of this group');
      }

      // Check if user is already an admin
      if (groupChat.admins?.includes(userId)) {
        return Resource.error('User is already an admin');
      }

      // Check max admin limit (5 admins)
      const currentAdminCount = groupChat.admins?.length || 0;
      if (currentAdminCount >= 5) {
        return Resource.error('Maksimal 5 admin per grup. Hapus admin lain terlebih dahulu.');
      }

      // Add user to admins list
      await updateDoc(groupChatRef, {
        admins: arrayUnion(userId),
        updatedAt: Timestamp.now(),
      });

      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to promote user to admin');
    }
  }

  /**
   * Demote admin to regular member
   */
  async demoteFromAdmin(
    chatId: string,
    userId: string
  ): Promise<Resource<void>> {
    try {
      const groupChatRef = doc(db(), this.GROUP_CHATS_COLLECTION, chatId);
      const groupChatDoc = await getDoc(groupChatRef);

      if (!groupChatDoc.exists()) {
        return Resource.error('Group chat not found');
      }

      const groupChat = groupChatDoc.data() as GroupChat;

      // Check if user is an admin
      if (!groupChat.admins?.includes(userId)) {
        return Resource.error('User is not an admin');
      }

      // Cannot demote if they are the last admin
      if (groupChat.admins.length === 1) {
        return Resource.error('Cannot remove the last admin');
      }

      // Remove user from admins list
      await updateDoc(groupChatRef, {
        admins: arrayRemove(userId),
        updatedAt: Timestamp.now(),
      });

      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to demote admin');
    }
  }

  /**
   * Add member to group chat
   */
  async addGroupMember(
    chatId: string,
    newMemberId: string,
    groupName: string,
    groupAvatar?: string
  ): Promise<Resource<void>> {
    try {
      const groupChatRef = doc(db(), this.GROUP_CHATS_COLLECTION, chatId);
      const groupChatDoc = await getDoc(groupChatRef);

      if (!groupChatDoc.exists()) {
        return Resource.error('Group chat not found');
      }

      const groupChat = groupChatDoc.data() as GroupChat;

      // Check if user is already a participant
      if (groupChat.participants.includes(newMemberId)) {
        return Resource.error('User is already a member of this group');
      }

      // Get new member's name
      const newMemberRef = doc(db(), 'users', newMemberId);
      const newMemberDoc = await getDoc(newMemberRef);
      const newMemberName = newMemberDoc.exists()
        ? (newMemberDoc.data().displayName || 'User')
        : 'User';

      const batch = writeBatch(db());
      const now = Timestamp.now();

      // Remove user from leftMembers if they were previously left
      const leftMembers = groupChat.leftMembers || {};
      if (leftMembers[newMemberId]) {
        delete leftMembers[newMemberId];
      }

      // Update usersJoinedAt - set join timestamp (overwrites if rejoining)
      const usersJoinedAt = groupChat.usersJoinedAt || {};
      usersJoinedAt[newMemberId] = now;  // CRITICAL: This overwrites previous timestamp for rejoin scenarios

      // Add user to group participants
      batch.update(groupChatRef, {
        participants: arrayUnion(newMemberId),
        leftMembers: leftMembers,
        usersJoinedAt: usersJoinedAt,  // Track join date for message filtering
        updatedAt: now,
      });

      // Create system message for adding member
      const messagesRef = collection(db(), this.GROUP_CHATS_COLLECTION, chatId, 'messages');
      const systemMessageRef = doc(messagesRef);
      batch.set(systemMessageRef, {
        messageId: systemMessageRef.id,
        senderId: 'system',
        senderName: 'System',
        text: `${newMemberName} telah ditambahkan ke grup`,
        type: 'TEXT',
        timestamp: now,
        createdAt: now,
        status: 'SENT',
        readBy: {},
      });

      // Update lastMessage for all participants
      const systemMessageText = `${newMemberName} telah ditambahkan ke grup`;
      for (const participantId of groupChat.participants) {
        const participantChatsRef = doc(db(), this.USER_CHATS_COLLECTION, participantId);
        const participantChatsDoc = await getDoc(participantChatsRef);

        if (participantChatsDoc.exists()) {
          const participantChats = participantChatsDoc.data() as UserChats;
          const updatedChats = participantChats.chats.map((chat) => {
            if (chat.chatId === chatId) {
              return {
                ...chat,
                lastMessage: systemMessageText,
                lastMessageTime: now,
                unreadCount: participantId === newMemberId ? 0 : chat.unreadCount + 1,
              };
            }
            return chat;
          });

          batch.update(participantChatsRef, {
            chats: updatedChats,
            updatedAt: now,
          });
        }
      }

      // Add chat to new member's chat list
      const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, newMemberId);
      const userChatsDoc = await getDoc(userChatsRef);

      const chatItem: ChatItem = {
        chatId,
        chatType: ChatType.GROUP,
        groupName,
        ...(groupAvatar && { groupAvatar }),
        lastMessage: systemMessageText,
        lastMessageTime: now,
        unreadCount: 0,
      };

      if (userChatsDoc.exists()) {
        batch.update(userChatsRef, {
          chats: arrayUnion(chatItem),
          updatedAt: now,
        });
      } else {
        batch.set(userChatsRef, {
          userId: newMemberId,
          chats: [chatItem],
          updatedAt: now,
        });
      }

      await batch.commit();
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to add member to group');
    }
  }

  /**
   * Update group name
   */
  async updateGroupName(
    chatId: string,
    newName: string
  ): Promise<Resource<void>> {
    try {
      const groupChatRef = doc(db(), this.GROUP_CHATS_COLLECTION, chatId);
      const groupChatDoc = await getDoc(groupChatRef);

      if (!groupChatDoc.exists()) {
        return Resource.error('Group chat not found');
      }

      const groupChat = groupChatDoc.data() as GroupChat;

      const batch = writeBatch(db());

      // Update group chat name
      batch.update(groupChatRef, {
        name: newName,
        updatedAt: Timestamp.now(),
      });

      // Update name in all participants' userChats
      for (const participantId of groupChat.participants) {
        const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, participantId);
        const userChatsDoc = await getDoc(userChatsRef);

        if (userChatsDoc.exists()) {
          const userData = userChatsDoc.data() as UserChats;
          const updatedChats = userData.chats.map((chat) => {
            if (chat.chatId === chatId) {
              return { ...chat, groupName: newName };
            }
            return chat;
          });

          batch.update(userChatsRef, {
            chats: updatedChats,
            updatedAt: Timestamp.now(),
          });
        }
      }

      await batch.commit();
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to update group name');
    }
  }

  /**
   * Update group avatar
   */
  async updateGroupAvatar(
    chatId: string,
    avatarUrl: string
  ): Promise<Resource<void>> {
    try {
      const groupChatRef = doc(db(), this.GROUP_CHATS_COLLECTION, chatId);
      const groupChatDoc = await getDoc(groupChatRef);

      if (!groupChatDoc.exists()) {
        return Resource.error('Group chat not found');
      }

      const groupChat = groupChatDoc.data() as GroupChat;

      const batch = writeBatch(db());

      // Update group chat avatar
      batch.update(groupChatRef, {
        avatar: avatarUrl,
        updatedAt: Timestamp.now(),
      });

      // Update avatar in all participants' userChats
      for (const participantId of groupChat.participants) {
        const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, participantId);
        const userChatsDoc = await getDoc(userChatsRef);

        if (userChatsDoc.exists()) {
          const userData = userChatsDoc.data() as UserChats;
          const updatedChats = userData.chats.map((chat) => {
            if (chat.chatId === chatId) {
              return { ...chat, groupAvatar: avatarUrl };
            }
            return chat;
          });

          batch.update(userChatsRef, {
            chats: updatedChats,
            updatedAt: Timestamp.now(),
          });
        }
      }

      await batch.commit();
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to update group avatar');
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
    const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, userId);

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

  /**
   * Delete chat from user's chat list
   * Note: This only removes the chat from user's list, doesn't delete actual chat or messages
   */
  async deleteChat(
    chatId: string,
    userId: string,
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      // Remove any prefix from chatId if exists
      const cleanChatId = chatId.replace('direct_', '').replace('group_', '');

      // Get user's chats
      const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, userId);
      const userChatsDoc = await getDoc(userChatsRef);

      if (!userChatsDoc.exists()) {
        return Resource.error('User chats not found');
      }

      const userChats = userChatsDoc.data() as UserChats;

      // Find and remove the chat from user's chat list
      const chatPrefix = isGroupChat ? 'group_' : 'direct_';
      const fullChatId = `${chatPrefix}${cleanChatId}`;

      const updatedChats = userChats.chats.filter(
        chat => chat.chatId !== fullChatId && chat.chatId !== cleanChatId
      );

      // Update user's chats
      await updateDoc(userChatsRef, {
        chats: updatedChats,
        updatedAt: Timestamp.now()
      });

      return Resource.success(undefined);
    } catch (error: any) {
      console.error('Delete chat error:', error);
      return Resource.error(error.message || 'Failed to delete chat');
    }
  }

  /**
   * Delete chat history for current user only
   * Sets deleteHistory timestamp - messages before this time will be hidden
   */
  async deleteHistory(
    chatId: string,
    userId: string,
    isGroupChat: boolean
  ): Promise<Resource<void>> {
    try {
      const cleanChatId = chatId.replace('direct_', '').replace('group_', '');
      const timestamp = Timestamp.now();

      // Update chat document with deleteHistory
      const collection = isGroupChat ? this.GROUP_CHATS_COLLECTION : this.DIRECT_CHATS_COLLECTION;
      const chatRef = doc(db(), collection, cleanChatId);

      await updateDoc(chatRef, {
        [`deleteHistory.${userId}`]: timestamp,
        updatedAt: timestamp
      });

      // Remove chat from user's chat list
      const userChatsRef = doc(db(), this.USER_CHATS_COLLECTION, userId);
      const userChatsDoc = await getDoc(userChatsRef);

      if (userChatsDoc.exists()) {
        const userChats = userChatsDoc.data() as UserChats;
        const chatPrefix = isGroupChat ? 'group_' : 'direct_';
        const fullChatId = `${chatPrefix}${cleanChatId}`;

        const updatedChats = userChats.chats.filter(
          chat => chat.chatId !== fullChatId && chat.chatId !== cleanChatId
        );

        await updateDoc(userChatsRef, {
          chats: updatedChats,
          updatedAt: timestamp
        });
      }

      return Resource.success(undefined);
    } catch (error: any) {
      console.error('Delete history error:', error);
      return Resource.error(error.message || 'Failed to delete history');
    }
  }
}
