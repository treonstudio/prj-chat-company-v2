package com.treonstudio.chatku.data.model

import com.google.firebase.Timestamp

/**
 * Denormalized collection for better performance in chat list
 */
data class UserChat(
    val userId: String = "",
    val chats: List<ChatItem> = emptyList(),
    val updatedAt: Timestamp? = null
)

data class ChatItem(
    val chatId: String = "",
    val chatType: ChatType = ChatType.DIRECT,
    // For direct chats
    val otherUserId: String? = null,
    val otherUserName: String? = null,
    val otherUserAvatar: String? = null,
    // For group chats
    val groupName: String? = null,
    val groupAvatar: String? = null,
    // Common fields
    val lastMessage: String = "",
    val lastMessageTime: Timestamp? = null,
    val unreadCount: Int = 0
)

enum class ChatType {
    DIRECT,
    GROUP
}
