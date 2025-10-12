package com.treonstudio.chatku.data.model

import com.google.firebase.Timestamp

data class Call(
    val callId: String = "",
    val callerId: String = "",
    val receiverId: String = "",
    val callerName: String = "",
    val callerAvatar: String? = null,
    val receiverName: String = "",
    val status: String = "ringing", // ringing, accepted, declined, cancelled, missed, ended
    val type: String = "voice", // voice or video
    val timestamp: Timestamp? = null,
    val acceptedAt: Timestamp? = null,
    val endedAt: Timestamp? = null,
    val duration: Int = 0 // in seconds
)

object CallStatus {
    const val RINGING = "ringing"
    const val ACCEPTED = "accepted"
    const val DECLINED = "declined"
    const val CANCELLED = "cancelled"
    const val MISSED = "missed"
    const val ENDED = "ended"
}

object CallType {
    const val VOICE = "voice"
    const val VIDEO = "video"
}
