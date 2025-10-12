package com.treonstudio.chatku.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.treonstudio.chatku.data.model.ChatItem
import com.treonstudio.chatku.data.model.ChatType
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun UserChatItem(
    chatItem: ChatItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Profile Photo
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (chatItem.chatType == ChatType.GROUP) {
                    Icons.Default.Group
                } else {
                    Icons.Default.Person
                },
                contentDescription = "Profile Photo",
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Name, Last Message, and Unread Badge
        Column(
            modifier = Modifier.weight(1f)
        ) {
            // Chat Name (User or Group)
            Text(
                text = when (chatItem.chatType) {
                    ChatType.DIRECT -> chatItem.otherUserName ?: "Unknown"
                    ChatType.GROUP -> chatItem.groupName ?: "Group Chat"
                },
                fontSize = 16.sp,
                fontWeight = if (chatItem.unreadCount > 0) FontWeight.Bold else FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Last Message
            Text(
                text = chatItem.lastMessage.ifEmpty { "No messages yet" },
                fontSize = 14.sp,
                fontWeight = if (chatItem.unreadCount > 0) FontWeight.Medium else FontWeight.Normal,
                color = if (chatItem.unreadCount > 0) {
                    MaterialTheme.colorScheme.onSurface
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Time and Unread Badge
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Last Message Time
            Text(
                text = chatItem.lastMessageTime?.let { formatMessageTime(it.toDate().time) } ?: "",
                fontSize = 12.sp,
                color = if (chatItem.unreadCount > 0) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )

            // Unread Count Badge
            if (chatItem.unreadCount > 0) {
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (chatItem.unreadCount > 99) "99+" else chatItem.unreadCount.toString(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }
        }
    }
}

private fun formatMessageTime(timestamp: Long): String {
    val messageDate = Calendar.getInstance().apply {
        timeInMillis = timestamp
    }
    val today = Calendar.getInstance()

    return if (isSameDay(messageDate, today)) {
        // Today: show time in HH:mm a.m/p.m format
        val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
        timeFormat.format(Date(timestamp))
    } else {
        // Other days: show date in yyyy-MM-dd format
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        dateFormat.format(Date(timestamp))
    }
}

private fun isSameDay(cal1: Calendar, cal2: Calendar): Boolean {
    return cal1.get(Calendar.YEAR) == cal2.get(Calendar.YEAR) &&
            cal1.get(Calendar.DAY_OF_YEAR) == cal2.get(Calendar.DAY_OF_YEAR)
}
