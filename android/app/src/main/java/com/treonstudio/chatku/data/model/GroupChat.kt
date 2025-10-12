package com.treonstudio.chatku.data.model

import com.google.firebase.Timestamp

data class GroupChat(
    val chatId: String = "",
    val name: String = "",
    val description: String = "",
    val avatarUrl: String? = null,
    val participants: List<String> = emptyList(), // Array of user IDs
    val participantsMap: Map<String, Boolean> = emptyMap(), // For easier querying
    val admins: List<String> = emptyList(), // Array of admin user IDs
    val createdBy: String = "",
    val lastMessage: LastMessage? = null,
    val unreadCount: Map<String, Int> = emptyMap(), // Unread count per user
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)
