package com.treonstudio.chatku.data.model

import com.google.firebase.Timestamp

data class User(
    val userId: String = "",
    val displayName: String = "",
    val email: String = "",
    val avatarUrl: String? = null,
    val status: UserStatus = UserStatus.OFFLINE,
    val lastSeen: Timestamp? = null,
    val fcmToken: String? = null,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

enum class UserStatus {
    ONLINE,
    OFFLINE
}
