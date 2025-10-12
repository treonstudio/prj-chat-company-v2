package com.treonstudio.chatku.presentation.creategroup

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.ui.theme.ChatkuTheme
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class CreateGroupActivity : ComponentActivity() {

    private val firestore = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    companion object {
        fun createIntent(context: Context): Intent {
            return Intent(context, CreateGroupActivity::class.java)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            ChatkuTheme {
                CreateGroupScreen(
                    onBackPressed = { finish() },
                    onCreateGroup = { groupName, selectedUsers ->
                        createGroup(groupName, selectedUsers)
                    }
                )
            }
        }
    }

    private fun createGroup(groupName: String, selectedUsers: List<User>) {
        lifecycleScope.launch {
            try {
                val currentUserId = auth.currentUser?.uid ?: return@launch

                // Create list of participant IDs (including current user)
                val participantIds = selectedUsers.map { it.userId }.toMutableList()
                participantIds.add(currentUserId)

                // Create participantsMap for easier querying
                val participantsMap = participantIds.associateWith { true }

                // Create unreadCount map (all 0 initially)
                val unreadCountMap = participantIds.associateWith { 0 }

                // Create group chat document
                val groupChatId = firestore.collection("groupChats").document().id

                val groupData = hashMapOf(
                    "chatId" to groupChatId,
                    "name" to groupName,
                    "description" to "", // Empty initially, can be added later
                    "avatarUrl" to "", // Empty initially, can be added later
                    "participants" to participantIds,
                    "participantsMap" to participantsMap,
                    "admins" to listOf(currentUserId), // Creator is admin
                    "createdBy" to currentUserId,
                    "lastMessage" to hashMapOf(
                        "text" to "",
                        "senderId" to "",
                        "senderName" to "",
                        "timestamp" to Timestamp.now(),
                        "type" to "text"
                    ),
                    "unreadCount" to unreadCountMap,
                    "createdAt" to Timestamp.now(),
                    "updatedAt" to Timestamp.now()
                )

                firestore.collection("groupChats")
                    .document(groupChatId)
                    .set(groupData)
                    .await()

                // Update userChats for all participants
                participantIds.forEach { userId ->
                    val userChatRef = firestore.collection("userChats").document(userId)
                    val userChatSnapshot = userChatRef.get().await()

                    val existingChats = userChatSnapshot.get("chats") as? List<*> ?: emptyList<Any>()
                    val mutableChats = existingChats.toMutableList()

                    val newChat = hashMapOf(
                        "chatId" to groupChatId,
                        "chatType" to "GROUP",
                        "groupName" to groupName,
                        "lastMessage" to "",
                        "lastMessageTime" to Timestamp.now(),
                        "unreadCount" to 0
                    )

                    mutableChats.add(newChat)

                    userChatRef.set(
                        hashMapOf(
                            "userId" to userId,
                            "chats" to mutableChats,
                            "updatedAt" to Timestamp.now()
                        )
                    ).await()
                }

                // Navigate back
                finish()

            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGroupScreen(
    onBackPressed: () -> Unit,
    onCreateGroup: (String, List<User>) -> Unit
) {
    var groupName by remember { mutableStateOf("") }
    var selectedUsers by remember { mutableStateOf<List<User>>(emptyList()) }
    var allUsers by remember { mutableStateOf<List<User>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    val firestore = FirebaseFirestore.getInstance()
    val auth = FirebaseAuth.getInstance()

    // Load all users
    LaunchedEffect(Unit) {
        try {
            val currentUserId = auth.currentUser?.uid ?: return@LaunchedEffect
            val snapshot = firestore.collection("users").get().await()

            allUsers = snapshot.documents.mapNotNull { doc ->
                val user = doc.toObject(User::class.java)
                // Exclude current user
                if (user?.userId != currentUserId) user else null
            }
            isLoading = false
        } catch (e: Exception) {
            e.printStackTrace()
            isLoading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Create Group") },
                navigationIcon = {
                    IconButton(onClick = onBackPressed) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            if (groupName.isNotBlank() && selectedUsers.isNotEmpty()) {
                                onCreateGroup(groupName, selectedUsers)
                            }
                        },
                        enabled = groupName.isNotBlank() && selectedUsers.isNotEmpty()
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Create",
                            tint = if (groupName.isNotBlank() && selectedUsers.isNotEmpty()) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            }
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Group name input
            OutlinedTextField(
                value = groupName,
                onValueChange = { groupName = it },
                label = { Text("Group name") },
                placeholder = { Text("Enter group name") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                singleLine = true
            )

            HorizontalDivider()

            // Selected users count
            if (selectedUsers.isNotEmpty()) {
                Text(
                    text = "${selectedUsers.size} participant${if (selectedUsers.size > 1) "s" else ""} selected",
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
            }

            // User list
            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                allUsers.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No users found",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(allUsers) { user ->
                            val isSelected = selectedUsers.any { it.userId == user.userId }

                            UserSelectionItem(
                                user = user,
                                isSelected = isSelected,
                                onSelectionChanged = { selected ->
                                    selectedUsers = if (selected) {
                                        selectedUsers + user
                                    } else {
                                        selectedUsers.filter { it.userId != user.userId }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun UserSelectionItem(
    user: User,
    isSelected: Boolean,
    onSelectionChanged: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onSelectionChanged(!isSelected) }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Avatar
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        // User info
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = user.displayName,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
            if (user.email.isNotEmpty()) {
                Text(
                    text = user.email,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Checkbox
        Checkbox(
            checked = isSelected,
            onCheckedChange = onSelectionChanged
        )
    }
}
