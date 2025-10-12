package com.treonstudio.chatku.data.model

data class Chat(
    val id: String,
    val userName: String,
    val userProfilePhoto: String?, // URL or null for placeholder
    val lastMessage: String,
    val lastMessageTime: Long, // Timestamp in milliseconds
    val messageStatus: MessageStatus,
    val unreadCount: Int = 0
)

enum class MessageStatus {
    SENT,    // Two gray checkmarks
    READ     // Two green checkmarks
}
