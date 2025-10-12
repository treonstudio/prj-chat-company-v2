package com.treonstudio.chatku.presentation.groupchatdetail

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.storage.FirebaseStorage
import com.treonstudio.chatku.data.model.MediaMetadata
import com.treonstudio.chatku.data.model.Message
import com.treonstudio.chatku.data.model.MessageType
import com.treonstudio.chatku.data.repository.GroupChatRepositoryImpl
import com.treonstudio.chatku.domain.usecase.GetMessagesUseCase
import com.treonstudio.chatku.domain.usecase.MarkMessagesAsReadUseCase
import com.treonstudio.chatku.domain.usecase.SendMessageUseCase
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.*

data class GroupChatDetailState(
    val messages: List<Message> = emptyList(),
    val uploadingMessages: List<Message> = emptyList(),
    val groupName: String? = null,
    val participantCount: Int = 0,
    val currentUserId: String = "",
    val groupChatId: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val messageText: String = ""
)

class GroupChatDetailViewModel(
    private val groupChatId: String,
    private val currentUserId: String,
    private val groupChatRepository: GroupChatRepositoryImpl,
    private val getMessagesUseCase: GetMessagesUseCase,
    private val sendMessageUseCase: SendMessageUseCase,
    private val markMessagesAsReadUseCase: MarkMessagesAsReadUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(
        GroupChatDetailState(
            currentUserId = currentUserId,
            groupChatId = groupChatId
        )
    )
    val state: StateFlow<GroupChatDetailState> = _state.asStateFlow()

    // Track the last message count to detect new messages
    private var lastMessageCount = 0

    // Track if screen is currently visible
    private var isScreenVisible = false

    init {
        loadGroupDetails()
        loadMessages()
    }

    private fun loadGroupDetails() {
        viewModelScope.launch {
            try {
                val groupChat = groupChatRepository.getGroupChatById(groupChatId)
                _state.value = _state.value.copy(
                    groupName = groupChat.name,
                    participantCount = groupChat.participants.size
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    error = e.message ?: "Failed to load group details"
                )
            }
        }
    }

    private fun loadMessages() {
        viewModelScope.launch {
            getMessagesUseCase(groupChatId, isGroupChat = true).collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        _state.value = _state.value.copy(isLoading = true)
                    }
                    is Resource.Success -> {
                        val messages = result.data ?: emptyList()
                        val currentMessageCount = messages.size

                        // Get unique sender IDs (excluding current user)
                        val senderIds = messages
                            .map { it.senderId }
                            .filter { it != currentUserId }
                            .distinct()

                        // Fetch user names for all senders
                        val userNameMap = if (senderIds.isNotEmpty()) {
                            fetchUserNames(senderIds)
                        } else {
                            emptyMap()
                        }

                        // Map sender names to messages
                        val messagesWithNames = messages.map { message ->
                            if (message.senderId == currentUserId) {
                                message // Don't update current user's messages
                            } else {
                                val senderName = userNameMap[message.senderId] ?: "Unknown"
                                message.copy(senderName = senderName)
                            }
                        }

                        _state.value = _state.value.copy(
                            messages = messagesWithNames,
                            isLoading = false,
                            error = null
                        )

                        // Only mark messages as read if screen is visible
                        if (isScreenVisible && (lastMessageCount == 0 || currentMessageCount > lastMessageCount)) {
                            markAsRead()
                        }

                        lastMessageCount = currentMessageCount
                    }
                    is Resource.Error -> {
                        _state.value = _state.value.copy(
                            error = result.message ?: "Failed to load messages",
                            isLoading = false
                        )
                    }
                }
            }
        }
    }

    private suspend fun fetchUserNames(userIds: List<String>): Map<String, String> {
        return try {
            val userNameMap = mutableMapOf<String, String>()

            // Fetch users from Firestore
            val firestore = com.google.firebase.firestore.FirebaseFirestore.getInstance()

            // Batch fetch users (Firestore 'in' query supports up to 10 items)
            userIds.chunked(10).forEach { batch ->
                val snapshot = firestore.collection("users")
                    .whereIn(com.google.firebase.firestore.FieldPath.documentId(), batch)
                    .get()
                    .await()

                snapshot.documents.forEach { doc ->
                    val displayName = doc.getString("displayName") ?: "Unknown"
                    userNameMap[doc.id] = displayName
                }
            }

            userNameMap
        } catch (e: Exception) {
            emptyMap()
        }
    }

    fun setScreenVisible(visible: Boolean) {
        isScreenVisible = visible
        // When screen becomes visible, mark all unread messages as read
        if (visible) {
            markAsRead()
        }
    }

    private fun markAsRead() {
        viewModelScope.launch {
            markMessagesAsReadUseCase(groupChatId, currentUserId, isGroupChat = true)
        }
    }

    fun updateMessageText(text: String) {
        _state.value = _state.value.copy(messageText = text)
    }

    fun sendMessage() {
        val messageText = _state.value.messageText.trim()
        if (messageText.isEmpty()) return

        viewModelScope.launch {
            val message = Message(
                senderId = currentUserId,
                text = messageText,
                type = MessageType.TEXT
            )

            sendMessageUseCase(groupChatId,message, isGroupChat = true)

            // Clear message text
            _state.value = _state.value.copy(messageText = "")
        }
    }

    fun uploadImageAndSendMessage(
        context: Context,
        imageUri: Uri,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                // Get file info
                val contentResolver = context.contentResolver
                val fileSize = contentResolver.openInputStream(imageUri)?.use { it.available().toLong() } ?: 0L
                val mimeType = contentResolver.getType(imageUri) ?: "image/jpeg"
                val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "jpg"
                val fileName = "IMG_${System.currentTimeMillis()}.$extension"

                // Create temporary uploading message
                val tempMessageId = UUID.randomUUID().toString()
                val tempMessage = Message(
                    messageId = tempMessageId,
                    senderId = currentUserId,
                    senderName = "",
                    text = "🖼️ Photo",
                    type = MessageType.IMAGE,
                    mediaMetadata = MediaMetadata(
                        fileName = fileName,
                        fileSize = fileSize,
                        mimeType = mimeType
                    )
                )

                // Add temporary message to uploading list
                _state.value = _state.value.copy(
                    uploadingMessages = _state.value.uploadingMessages + tempMessage
                )

                // Upload to Firebase Storage
                val storage = FirebaseStorage.getInstance()
                val storageRef = storage.reference
                    .child("chats/group/$groupChatId/${UUID.randomUUID()}/$fileName")

                val uploadTask = storageRef.putFile(imageUri).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                // Create media metadata
                val mediaMetadata = MediaMetadata(
                    fileName = fileName,
                    fileSize = fileSize,
                    mimeType = mimeType,
                    thumbnailUrl = downloadUrl
                )

                _state.value = _state.value.copy(
                    uploadingMessages = _state.value.uploadingMessages.filter { it.messageId != tempMessageId }
                )

                // Send message with image
                val message = Message(
                    senderId = currentUserId,
                    senderName = "",
                    text = "🖼️ Photo",
                    type = MessageType.IMAGE,
                    mediaUrl = downloadUrl,
                    mediaMetadata = mediaMetadata
                )

                when (sendMessageUseCase(groupChatId, message, isGroupChat = true)) {
                    is Resource.Success -> {
                        onSuccess()
                    }
                    is Resource.Error -> {
                        onError("Failed to send message")
                    }
                    is Resource.Loading -> {
                        // Uploading...
                    }
                }
            } catch (e: Exception) {
                onError(e.message ?: "Failed to upload image")
            }
        }
    }

    fun uploadVideoAndSendMessage(
        context: Context,
        videoUri: Uri,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                // Get file info
                val contentResolver = context.contentResolver
                val fileSize = contentResolver.openInputStream(videoUri)?.use { it.available().toLong() } ?: 0L
                val mimeType = contentResolver.getType(videoUri) ?: "video/mp4"
                val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "mp4"
                val fileName = "VID_${System.currentTimeMillis()}.$extension"

                // Create temporary uploading message
                val tempMessageId = UUID.randomUUID().toString()
                val tempMessage = Message(
                    messageId = tempMessageId,
                    senderId = currentUserId,
                    senderName = "",
                    text = "🎥 Video",
                    type = MessageType.VIDEO,
                    mediaMetadata = MediaMetadata(
                        fileName = fileName,
                        fileSize = fileSize,
                        mimeType = mimeType
                    )
                )

                // Add temporary message to uploading list
                _state.value = _state.value.copy(
                    uploadingMessages = _state.value.uploadingMessages + tempMessage
                )

                // Upload to Firebase Storage
                val storage = FirebaseStorage.getInstance()
                val storageRef = storage.reference
                    .child("chats/group/$groupChatId/${UUID.randomUUID()}/$fileName")

                val uploadTask = storageRef.putFile(videoUri).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                // Create media metadata
                val mediaMetadata = MediaMetadata(
                    fileName = fileName,
                    fileSize = fileSize,
                    mimeType = mimeType,
                    thumbnailUrl = null
                )

                _state.value = _state.value.copy(
                    uploadingMessages = _state.value.uploadingMessages.filter { it.messageId != tempMessageId }
                )

                // Send message with video
                val message = Message(
                    senderId = currentUserId,
                    senderName = "",
                    text = "🎥 Video",
                    type = MessageType.VIDEO,
                    mediaUrl = downloadUrl,
                    mediaMetadata = mediaMetadata
                )

                when (sendMessageUseCase(groupChatId, message, isGroupChat = true)) {
                    is Resource.Success -> {
                        onSuccess()
                    }
                    is Resource.Error -> {
                        onError("Failed to send message")
                    }
                    is Resource.Loading -> {
                        // Uploading...
                    }
                }
            } catch (e: Exception) {
                onError(e.message ?: "Failed to upload video")
            }
        }
    }

    fun uploadDocumentAndSendMessage(
        context: Context,
        documentUri: Uri,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                // Get file info
                val contentResolver = context.contentResolver
                val fileSize = contentResolver.openInputStream(documentUri)?.use { it.available().toLong() } ?: 0L
                val mimeType = contentResolver.getType(documentUri) ?: "application/octet-stream"

                // Get actual file name from URI
                val fileName = contentResolver.query(documentUri, null, null, null, null)?.use { cursor ->
                    val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    cursor.moveToFirst()
                    cursor.getString(nameIndex)
                } ?: "DOC_${System.currentTimeMillis()}.${MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "pdf"}"

                // Create temporary uploading message
                val tempMessageId = UUID.randomUUID().toString()
                val tempMessage = Message(
                    messageId = tempMessageId,
                    senderId = currentUserId,
                    senderName = "",
                    text = "📄 $fileName",
                    type = MessageType.DOCUMENT,
                    mediaMetadata = MediaMetadata(
                        fileName = fileName,
                        fileSize = fileSize,
                        mimeType = mimeType
                    )
                )

                // Add temporary message to uploading list
                _state.value = _state.value.copy(
                    uploadingMessages = _state.value.uploadingMessages + tempMessage
                )

                // Upload to Firebase Storage
                val storage = FirebaseStorage.getInstance()
                val storageRef = storage.reference
                    .child("chats/group/$groupChatId/documents/${UUID.randomUUID()}/$fileName")

                val uploadTask = storageRef.putFile(documentUri).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                // Create media metadata
                val mediaMetadata = MediaMetadata(
                    fileName = fileName,
                    fileSize = fileSize,
                    mimeType = mimeType,
                    thumbnailUrl = null
                )

                _state.value = _state.value.copy(
                    uploadingMessages = _state.value.uploadingMessages.filter { it.messageId != tempMessageId }
                )

                // Send message with document
                val message = Message(
                    senderId = currentUserId,
                    senderName = "",
                    text = "📄 $fileName",
                    type = MessageType.DOCUMENT,
                    mediaUrl = downloadUrl,
                    mediaMetadata = mediaMetadata
                )

                when (sendMessageUseCase(groupChatId, message, isGroupChat = true)) {
                    is Resource.Success -> {
                        onSuccess()
                    }
                    is Resource.Error -> {
                        onError("Failed to send message")
                    }
                    is Resource.Loading -> {
                        // Uploading...
                    }
                }
            } catch (e: Exception) {
                onError(e.message ?: "Failed to upload document")
            }
        }
    }
}
