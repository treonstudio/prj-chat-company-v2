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
  isDeleted?: boolean; // Track if user has been deleted by admin
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
  VOICE_CALL = 'VOICE_CALL',
  VIDEO_CALL = 'VIDEO_CALL',
}

export enum MessageStatus {
  PENDING = 'PENDING', // Queued for offline, will auto-send when online
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

export interface CallMetadata {
  callId: string;
  duration: number; // Duration in seconds
  callType: 'voice' | 'video';
  status: 'completed' | 'missed' | 'declined' | 'cancelled';
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
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
  callMetadata?: CallMetadata; // For call history messages
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
  linkPreview?: LinkPreview | null; // For link preview in text messages
  tempId?: string; // Temporary ID from optimistic message (for deduplication)
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
  imageURL?: string; // Primary field for group avatar (consistent with User model)
  participants: string[];
  participantsMap?: Record<string, boolean>; // For efficient queries
  admins?: string[];
  unreadCount?: Record<string, number>; // Unread count per user
  leftMembers?: Record<string, Timestamp>; // Track when users left
  usersJoinedAt?: Record<string, Timestamp>; // Track when users joined (for message filtering on rejoin)
  lastMessage?: LastMessage;
  createdAt?: Timestamp;
  createdBy?: string; // User ID of the creator
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

// Device Session Models (for device locking)
export type DeviceType = 'mobile' | 'web';

export interface DeviceSession {
  deviceId: string;
  deviceType: DeviceType;
  platform: string; // Android, iOS, Web
  browser?: string; // Chrome, Firefox, Safari, etc
  os?: string; // Windows, macOS, Linux, etc
  deviceName: string; // e.g., "Chrome on Windows"
  userAgent?: string;
  loginAt: Timestamp;
  lastActive: Timestamp;
  status: 'online' | 'offline';
}

export interface KickedSession {
  userId: string;
  deviceType: DeviceType;
  deviceId: string;
  kickedAt: Timestamp;
  reason: 'new_device_login' | 'manual_logout' | 'session_expired';
}
