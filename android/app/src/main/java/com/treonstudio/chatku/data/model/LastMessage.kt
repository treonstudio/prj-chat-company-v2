package com.treonstudio.chatku.data.model

import com.google.firebase.Timestamp

data class LastMessage(
    val text: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val timestamp: Timestamp? = null,
    val type: MessageType = MessageType.TEXT
)

enum class MessageType {
    TEXT,
    IMAGE,
    VIDEO,
    DOCUMENT
}
