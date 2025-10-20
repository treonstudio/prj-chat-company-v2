import { Timestamp } from 'firebase/firestore';

// User models
export enum UserStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export interface User {
  userId: string;
  username?: string;
  displayName: string;
  email: string;
  imageURL?: string; // Firebase uses imageURL (capital URL)
  imageUrl?: string; // Fallback for backward compatibility
  status: UserStatus;
  isActive?: boolean;
  lastSeen?: Timestamp;
  fcmToken?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Message models
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
}

export enum MessageStatus {
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export interface MediaMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;
}

export interface ReplyTo {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string; // Truncated to 100 chars
  type: MessageType;
  mediaUrl?: string | null;
}

export interface Message {
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  mediaMetadata?: MediaMetadata;
  readBy: Record<string, Timestamp>;
  deliveredTo?: Record<string, Timestamp>;
  timestamp?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  editedAt?: Timestamp;
  status?: MessageStatus;
  error?: string;
  isDeleted?: boolean; // For "Delete for Everyone"
  isEdited?: boolean; // Track if message has been edited
  isForwarded?: boolean; // Track if message was forwarded
  hideFrom?: Record<string, Timestamp>; // For "Delete for Me" - maps userId to deletion timestamp
  replyTo?: ReplyTo | null; // For reply/quote message feature
}

// Chat models
export enum ChatType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export interface LastMessage {
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Timestamp;
  type: string;
}

export interface DirectChat {
  chatId: string;
  participants: string[];
  lastMessage?: LastMessage;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GroupChat {
  chatId: string;
  name: string;
  avatar?: string;
  avatarUrl?: string; // Alias for backward compatibility
  participants: string[];
  admins?: string[];
  leftMembers?: Record<string, Timestamp>; // Track when users left
  lastMessage?: LastMessage;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ChatItem {
  chatId: string;
  chatType: ChatType;
  otherUserId?: string;
  otherUserName?: string;
  otherUserAvatar?: string;
  groupName?: string;
  groupAvatar?: string;
  lastMessage: string;
  lastMessageTime: Timestamp;
  unreadCount: number;
}

export interface UserChats {
  userId: string;
  chats: ChatItem[];
  updatedAt?: Timestamp;
}

// Call models (for reference, won't be used in web app)
export enum CallStatus {
  RINGING = 'ringing',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  MISSED = 'missed',
  ENDED = 'ended',
}

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
}

export interface Call {
  callId: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  callerAvatar?: string;
  receiverName: string;
  status: CallStatus;
  type: CallType;
  timestamp?: Timestamp;
  acceptedAt?: Timestamp;
  endedAt?: Timestamp;
  duration: number;
}

// Feature Flags
export interface FeatureFlags {
  allowCall: boolean;
  allowChat: boolean;
  allowCreateGroup: boolean;
  allowSendText: boolean;
  allowSendMedia: boolean;
}
