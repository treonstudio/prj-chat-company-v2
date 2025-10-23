import { MessageRepository } from '@/lib/repositories/message.repository';
import { Message, MessageType, CallMetadata } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

const messageRepository = new MessageRepository();

/**
 * Sends a call history message to a chat
 * @param chatId - The ID of the chat (direct or group)
 * @param currentUserId - The ID of the current user (call initiator)
 * @param currentUserName - The display name of the current user
 * @param currentUserAvatar - The avatar URL of the current user (optional)
 * @param callType - Type of call: "voice" or "video"
 * @param callStatus - Status of the call: "completed", "missed", "declined", "cancelled"
 * @param duration - Duration of the call in seconds (default: 0)
 * @param isGroupChat - Whether this is a group chat
 * @returns Promise with the result of sending the message
 */
export async function sendCallHistoryMessage(
  chatId: string,
  currentUserId: string,
  currentUserName: string,
  currentUserAvatar: string | undefined,
  callType: 'voice' | 'video',
  callStatus: 'completed' | 'missed' | 'declined' | 'cancelled',
  duration: number = 0,
  isGroupChat: boolean = false
) {
  // Create call metadata
  const callMetadata: CallMetadata = {
    callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    duration,
    callType,
    status: callStatus,
  };

  // Determine message type based on call type
  const messageType = callType === 'video' ? MessageType.VIDEO_CALL : MessageType.VOICE_CALL;

  // Create message text for display
  let messageText = '';
  switch (callStatus) {
    case 'completed':
      messageText = callType === 'video' ? '📹 Panggilan video' : '📞 Panggilan suara';
      break;
    case 'missed':
      messageText = '📵 Panggilan tidak terjawab';
      break;
    case 'declined':
      messageText = '🚫 Panggilan ditolak';
      break;
    case 'cancelled':
      messageText = '❌ Panggilan dibatalkan';
      break;
    default:
      messageText = '📞 Panggilan';
  }

  // Create the message object
  const message: Message = {
    messageId: '',
    senderId: currentUserId,
    senderName: currentUserName,
    senderAvatar: currentUserAvatar,
    text: messageText,
    type: messageType,
    callMetadata,
    readBy: {},
    deliveredTo: {},
    timestamp: Timestamp.now(),
  };

  // Send the message
  const result = await messageRepository.sendMessage(chatId, message, isGroupChat);

  return result;
}

/**
 * Helper function to format call duration
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (MM:SS)
 */
export function formatCallDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Helper function to get call status display text
 * @param status - Call status
 * @param isMe - Whether the current user is the sender
 * @returns Display text for the call status
 */
export function getCallStatusText(
  status: 'completed' | 'missed' | 'declined' | 'cancelled',
  isMe: boolean
): string {
  switch (status) {
    case 'completed':
      return isMe ? 'Panggilan keluar' : 'Panggilan masuk';
    case 'missed':
      return 'Panggilan tidak terjawab';
    case 'declined':
      return 'Panggilan ditolak';
    case 'cancelled':
      return 'Panggilan dibatalkan';
    default:
      return 'Panggilan';
  }
}
