package com.treonstudio.chatku.data.model

import com.google.firebase.Timestamp

data class DirectChat(
    val chatId: String = "",
    val participants: List<String> = emptyList(), // Array of user IDs (always 2)
    val participantsMap: Map<String, Boolean> = emptyMap(), // For easier querying
    val lastMessage: LastMessage? = null,
    val unreadCount: Map<String, Int> = emptyMap(), // Unread count per user
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)
