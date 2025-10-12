package com.treonstudio.chatku.presentation.chatlist

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.treonstudio.chatku.data.local.PreferencesManager
import com.treonstudio.chatku.data.model.ChatType
import com.treonstudio.chatku.data.repository.AuthRepositoryImpl
import com.treonstudio.chatku.data.repository.UserChatRepositoryImpl
import com.treonstudio.chatku.domain.usecase.GetUserChatsUseCase
import com.treonstudio.chatku.presentation.components.UserChatItem

@Composable
fun ChatListScreen(
    onNavigateToContactList: () -> Unit = {},
    onNavigateToCreateGroup: () -> Unit = {},
    onChatClick: (chatId: String, chatType: ChatType, otherUserId: String) -> Unit = { _, _, _ -> },
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var showMenu by remember { mutableStateOf(false) }

    // Manually instantiate dependencies
    val viewModel = remember {
        val firestore = FirebaseFirestore.getInstance()
        val userChatRepository = UserChatRepositoryImpl(firestore)
        val getUserChatsUseCase = GetUserChatsUseCase(userChatRepository)

        // Get current user ID
        val preferencesManager = PreferencesManager(context)
        val authRepository = AuthRepositoryImpl(FirebaseAuth.getInstance(), preferencesManager)
        val currentUserId = authRepository.getCurrentUser()?.userId ?: ""

        ChatListViewModel(getUserChatsUseCase, currentUserId)
    }

    val state by viewModel.state.collectAsState()

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToContactList,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "New Chat",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
        // Sticky Header
        Surface(
            modifier = Modifier.fillMaxWidth(),
            tonalElevation = 3.dp,
            shadowElevation = 3.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // ChatKu Label
                Text(
                    text = "ChatKu",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(start = 8.dp)
                )

                // Icon Buttons
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    IconButton(onClick = { /* TODO: Handle search */ }) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "More Options",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }

                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Create group") },
                                onClick = {
                                    showMenu = false
                                    onNavigateToCreateGroup()
                                }
                            )
                        }
                    }
                }
            }
        }

        // Chat Items List
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            when {
                state.isLoading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                state.error != null -> {
                    Text(
                        text = state.error ?: "Unknown error",
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(16.dp)
                    )
                }
                state.chats.isEmpty() -> {
                    Text(
                        text = "No chats yet.\nStart a conversation!",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(16.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(state.chats) { chatItem ->
                            UserChatItem(
                                chatItem = chatItem,
                                onClick = {
                                    val otherUserId = when (chatItem.chatType) {
                                        ChatType.DIRECT -> chatItem.otherUserId ?: ""
                                        ChatType.GROUP -> ""
                                    }
                                    onChatClick(chatItem.chatId, chatItem.chatType, otherUserId)
                                }
                            )
                            HorizontalDivider(
                                modifier = Modifier.padding(start = 84.dp),
                                thickness = 0.5.dp,
                                color = MaterialTheme.colorScheme.outlineVariant
                            )
                        }
                    }
                }
            }
        }
        }
    }
}
