package com.treonstudio.chatku.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.treonstudio.chatku.data.model.Chat
import com.treonstudio.chatku.data.model.MessageStatus
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ChatItem(
    chat: Chat,
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
            // Placeholder icon if no profile photo
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = "Profile Photo",
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Name, Last Message, and Status
        Column(
            modifier = Modifier.weight(1f)
        ) {
            // User Name
            Text(
                text = chat.userName,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Last Message with Status Icon
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Message Status Icon
                Icon(
                    imageVector = if (chat.messageStatus == MessageStatus.READ) {
                        Icons.Default.DoneAll
                    } else {
                        Icons.Default.DoneAll
                    },
                    contentDescription = if (chat.messageStatus == MessageStatus.READ) {
                        "Read"
                    } else {
                        "Sent"
                    },
                    modifier = Modifier.size(16.dp),
                    tint = if (chat.messageStatus == MessageStatus.READ) {
                        Color(0xFF4CAF50) // Green for read
                    } else {
                        Color.Gray // Gray for sent
                    }
                )

                Spacer(modifier = Modifier.width(4.dp))

                // Last Message Text
                Text(
                    text = chat.lastMessage,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Last Message Time
        Text(
            text = formatMessageTime(chat.lastMessageTime),
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
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
