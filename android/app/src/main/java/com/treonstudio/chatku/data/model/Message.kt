package com.treonstudio.chatku.data.model

import com.google.firebase.Timestamp

data class Message(
    val messageId: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val senderAvatar: String? = null,
    val text: String = "",
    val type: MessageType = MessageType.TEXT,
    val mediaUrl: String? = null, // URL if type is media
    val mediaMetadata: MediaMetadata? = null, // For media messages
    val readBy: Map<String, Timestamp> = emptyMap(), // Read receipts
    val deliveredTo: Map<String, Timestamp> = emptyMap(), // Delivery receipts (for groups)
    val timestamp: Timestamp? = null,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)
