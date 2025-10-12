package com.treonstudio.chatku.data.model

data class MediaMetadata(
    val fileName: String = "",
    val fileSize: Long = 0L,
    val mimeType: String = "",
    val thumbnailUrl: String? = null // For images/videos
)
