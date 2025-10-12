package com.treonstudio.chatku.presentation.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.SubcomposeAsyncImage
import com.treonstudio.chatku.data.model.Message
import com.treonstudio.chatku.data.model.MessageType
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun MessageBubble(
    message: Message,
    isFromCurrentUser: Boolean,
    showSenderName: Boolean = false,
    isUploading: Boolean = false,
    onImageClick: ((String, fileName: String) -> Unit)? = null,
    onVideoClick: ((videoUrl: String, fileName: String) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = if (isFromCurrentUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 12.dp,
                        topEnd = 12.dp,
                        bottomStart = if (isFromCurrentUser) 12.dp else 2.dp,
                        bottomEnd = if (isFromCurrentUser) 2.dp else 12.dp
                    )
                )
                .background(
                    if (isFromCurrentUser) {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    }
                )
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Column {
                // Sender name (for group chats)
                if (showSenderName && !isFromCurrentUser) {
                    Text(
                        text = message.senderName,
                        fontSize = 12.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }

                // Message content based on type
                when (message.type) {
                    MessageType.IMAGE -> {
                        // Image message
                        if (isUploading) {
                            // Show placeholder with loading indicator
                            Box(
                                modifier = Modifier
                                    .widthIn(max = 250.dp)
                                    .heightIn(min = 150.dp, max = 300.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(32.dp)
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "Uploading...",
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        } else {
                            message.mediaUrl?.let { imageUrl ->
                                SubcomposeAsyncImage(
                                    model = imageUrl,
                                    contentDescription = "Shared image",
                                    modifier = Modifier
                                        .widthIn(max = 250.dp)
                                        .heightIn(max = 300.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable {
                                            val fileName = message.mediaMetadata?.fileName ?: "Image"
                                            onImageClick?.invoke(imageUrl,fileName)
                                        },
                                    contentScale = ContentScale.Crop,
                                    loading = {
                                        Box(
                                            modifier = Modifier
                                                .size(100.dp)
                                                .background(MaterialTheme.colorScheme.surfaceVariant),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(24.dp)
                                            )
                                        }
                                    },
                                    error = {
                                        Box(
                                            modifier = Modifier
                                                .size(100.dp)
                                                .background(MaterialTheme.colorScheme.errorContainer),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = "Failed to load",
                                                fontSize = 12.sp,
                                                color = MaterialTheme.colorScheme.onErrorContainer
                                            )
                                        }
                                    }
                                )
                            }
                        }
                    }
                    MessageType.VIDEO -> {
                        // Video message with play button overlay
                        Box(
                            modifier = Modifier
                                .widthIn(max = 250.dp)
                                .heightIn(min = 150.dp, max = 300.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF1E1E1E))
                                .clickable(enabled = !isUploading) {
                                    message.mediaUrl?.let { videoUrl ->
                                        val fileName = message.mediaMetadata?.fileName ?: "Video"
                                        onVideoClick?.invoke(videoUrl, fileName)
                                    }
                                }
                        ) {
                            // Video thumbnail or placeholder
                            Column(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                if (isUploading) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(48.dp),
                                        color = Color.White
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "Uploading...",
                                        fontSize = 14.sp,
                                        color = Color.White
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.PlayCircle,
                                        contentDescription = "Play video",
                                        modifier = Modifier.size(64.dp),
                                        tint = Color.White
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = message.text,
                                        fontSize = 14.sp,
                                        color = Color.White
                                    )
                                }
                                message.mediaMetadata?.let { metadata ->
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = formatFileSize(metadata.fileSize),
                                        fontSize = 12.sp,
                                        color = Color.White.copy(alpha = 0.7f)
                                    )
                                }
                            }
                        }
                    }
                    MessageType.TEXT -> {
                        // Text message
                        Text(
                            text = message.text,
                            fontSize = 15.sp,
                            color = if (isFromCurrentUser) {
                                MaterialTheme.colorScheme.onPrimaryContainer
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    }
                    MessageType.DOCUMENT -> {
                        // Document message
                        val context = LocalContext.current
                        Box(
                            modifier = Modifier
                                .widthIn(max = 250.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (isFromCurrentUser) {
                                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
                                    } else {
                                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                    }
                                )
                                .clickable(enabled = !isUploading) {
                                    message.mediaUrl?.let { documentUrl ->
                                        val intent = Intent(Intent.ACTION_VIEW).apply {
                                            data = Uri.parse(documentUrl)
                                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                        }
                                        try {
                                            context.startActivity(intent)
                                        } catch (e: Exception) {
                                            // If no app can handle the document, try to open in browser
                                            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(documentUrl))
                                            context.startActivity(browserIntent)
                                        }
                                    }
                                }
                                .padding(12.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                if (isUploading) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(40.dp),
                                        color = if (isFromCurrentUser) {
                                            MaterialTheme.colorScheme.onPrimaryContainer
                                        } else {
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                        }
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Description,
                                        contentDescription = "Document",
                                        modifier = Modifier.size(40.dp),
                                        tint = if (isFromCurrentUser) {
                                            MaterialTheme.colorScheme.onPrimaryContainer
                                        } else {
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                        }
                                    )
                                }

                                Column(
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(
                                        text = message.mediaMetadata?.fileName ?: "Document",
                                        fontSize = 14.sp,
                                        fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                                        color = if (isFromCurrentUser) {
                                            MaterialTheme.colorScheme.onPrimaryContainer
                                        } else {
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                        },
                                        maxLines = 2
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = if (isUploading) {
                                            "Uploading..."
                                        } else {
                                            message.mediaMetadata?.let { formatFileSize(it.fileSize) } ?: ""
                                        },
                                        fontSize = 12.sp,
                                        color = if (isFromCurrentUser) {
                                            MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                                        } else {
                                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                                        }
                                    )
                                }
                            }
                        }
                    }
                    else -> {
                        // Fallback for unknown message types
                        Text(
                            text = message.text.ifEmpty { "[Media message]" },
                            fontSize = 15.sp,
                            color = if (isFromCurrentUser) {
                                MaterialTheme.colorScheme.onPrimaryContainer
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    }
                }

                // Timestamp with read status
                message.timestamp?.let { timestamp ->
                    val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
                    val timeString = timeFormat.format(timestamp.toDate())

                    Row(
                        modifier = Modifier
                            .align(Alignment.End)
                            .padding(top = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = timeString,
                            fontSize = 11.sp,
                            color = if (isFromCurrentUser) {
                                MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f)
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                            }
                        )

                        // Show read/unread status only for sender's messages
                        if (isFromCurrentUser) {
                            // Check if anyone OTHER than the sender has read the message
                            val isRead = message.readBy.any { (userId, _) ->
                                userId != message.senderId
                            }

                            Icon(
                                imageVector = if (isRead) Icons.Default.DoneAll else Icons.Default.Done,
                                contentDescription = if (isRead) "Read" else "Sent",
                                modifier = Modifier.size(14.dp),
                                tint = if (isRead) {
                                    Color(0xFF4CAF50) // Green for read
                                } else {
                                    MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f) // Gray for sent
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Helper function to format file size in a human-readable format
 */
private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> String.format("%.1f KB", bytes / 1024.0)
        bytes < 1024 * 1024 * 1024 -> String.format("%.1f MB", bytes / (1024.0 * 1024.0))
        else -> String.format("%.1f GB", bytes / (1024.0 * 1024.0 * 1024.0))
    }
}
