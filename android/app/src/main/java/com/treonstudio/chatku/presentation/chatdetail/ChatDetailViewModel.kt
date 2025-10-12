package com.treonstudio.chatku.presentation.chatdetail

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.storage.FirebaseStorage
import com.treonstudio.chatku.data.model.MediaMetadata
import com.treonstudio.chatku.data.model.Message
import com.treonstudio.chatku.data.model.MessageType
import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.domain.usecase.GetMessagesUseCase
import com.treonstudio.chatku.domain.usecase.GetOrCreateDirectChatUseCase
import com.treonstudio.chatku.domain.usecase.GetUserByIdUseCase
import com.treonstudio.chatku.domain.usecase.MarkMessagesAsReadUseCase
import com.treonstudio.chatku.domain.usecase.SendMessageUseCase
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.*

data class ChatDetailState(
    val messages: List<Message> = emptyList(),
    val uploadingMessages: List<Message> = emptyList(),
    val otherUser: User? = null,
    val currentUserId: String = "",
    val chatId: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val messageText: String = ""
)

class ChatDetailViewModel(
    private val otherUserId: String,
    private val currentUserId: String,
    private val getUserByIdUseCase: GetUserByIdUseCase,
    private val getOrCreateDirectChatUseCase: GetOrCreateDirectChatUseCase,
    private val getMessagesUseCase: GetMessagesUseCase,
    private val sendMessageUseCase: SendMessageUseCase,
    private val markMessagesAsReadUseCase: MarkMessagesAsReadUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(ChatDetailState(currentUserId = currentUserId))
    val state: StateFlow<ChatDetailState> = _state.asStateFlow()

    // Track the last message count to detect new messages
    private var lastMessageCount = 0

    // Track if screen is currently visible
    private var isScreenVisible = false

    init {
        loadChatData()
    }

    /**
     * Called from UI to indicate screen visibility
     */
    fun setScreenVisible(visible: Boolean) {
        isScreenVisible = visible

        // When screen becomes visible, mark all unread messages as read
        if (visible) {
            _state.value.chatId?.let { chatId ->
                markAsRead(chatId)
            }
        }
    }

    private fun loadChatData() {
        loadOtherUserData()
        loadOrCreateDirectChat()
    }

    /**
     * Load other user's data from users/{otherUserId}
     */
    private fun loadOtherUserData() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)

            when (val result = getUserByIdUseCase(otherUserId)) {
                is Resource.Success -> {
                    _state.value = _state.value.copy(
                        otherUser = result.data,
                        isLoading = false
                    )
                }
                is Resource.Error -> {
                    _state.value = _state.value.copy(
                        error = result.message,
                        isLoading = false
                    )
                }
                is Resource.Loading -> {
                    _state.value = _state.value.copy(isLoading = true)
                }
            }
        }
    }

    /**
     * Load or create direct chat between current user and other user
     */
    private fun loadOrCreateDirectChat() {
        viewModelScope.launch {
            when (val result = getOrCreateDirectChatUseCase(currentUserId, otherUserId)) {
                is Resource.Success -> {
                    val chatId = result.data?.chatId
                    _state.value = _state.value.copy(chatId = chatId)

                    // Once we have chatId, load messages
                    if (chatId != null) {
                        loadMessages(chatId)
                    }
                }
                is Resource.Error -> {
                    _state.value = _state.value.copy(error = result.message)
                }
                is Resource.Loading -> {
                    _state.value = _state.value.copy(isLoading = true)
                }
            }
        }
    }

    /**
     * Listen to messages from directChats/{chatId}/messages
     */
    private fun loadMessages(chatId: String) {
        viewModelScope.launch {
            getMessagesUseCase(chatId, isGroupChat = false).collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        _state.value = _state.value.copy(isLoading = true)
                    }
                    is Resource.Success -> {
                        val messages = result.data ?: emptyList()
                        val currentMessageCount = messages.size

                        _state.value = _state.value.copy(
                            messages = messages,
                            isLoading = false
                        )

                        // Only mark messages as read if:
                        // 1. Screen is currently visible (user is actively viewing)
                        // 2. AND (first time loading OR new messages arrived)
                        if (isScreenVisible && (lastMessageCount == 0 || currentMessageCount > lastMessageCount)) {
                            // Mark as read immediately - no delay
                            // This ensures unread count is reset ASAP
                            markAsRead(chatId)
                        }

                        // Update the message count tracker
                        lastMessageCount = currentMessageCount
                    }
                    is Resource.Error -> {
                        _state.value = _state.value.copy(
                            error = result.message,
                            isLoading = false
                        )
                    }
                }
            }
        }
    }

    /**
     * Mark messages as read
     */
    private fun markAsRead(chatId: String) {
        viewModelScope.launch {
            markMessagesAsReadUseCase(chatId, currentUserId, isGroupChat = false)
        }
    }

    fun updateMessageText(text: String) {
        _state.value = _state.value.copy(messageText = text)
    }

    fun sendMessage() {
        val messageText = _state.value.messageText.trim()
        if (messageText.isBlank()) return

        val chatId = _state.value.chatId ?: return
        val otherUser = _state.value.otherUser ?: return

        viewModelScope.launch {
            val message = Message(
                senderId = currentUserId,
                senderName = "", // TODO: Get current user's name
                text = messageText,
                type = MessageType.TEXT
            )
            // force set chat box immediataly empty
            _state.value = _state.value.copy(messageText = "")

            when (sendMessageUseCase(chatId, message, isGroupChat = false)) {
                is Resource.Success -> {

                }
                is Resource.Error -> {
                    // TODO: Show error to user
                }
                is Resource.Loading -> {
                    // Sending...
                }
            }
        }
    }

    fun uploadImageAndSendMessage(
        context: Context,
        imageUri: Uri,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val chatId = _state.value.chatId
        if (chatId == null) {
            onError("Chat not initialized")
            return
        }

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
                    .child("chats/direct/$chatId/${UUID.randomUUID()}/$fileName")

                val uploadTask = storageRef.putFile(imageUri).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                // Create media metadata
                val mediaMetadata = MediaMetadata(
                    fileName = fileName,
                    fileSize = fileSize,
                    mimeType = mimeType,
                    thumbnailUrl = downloadUrl // For images, use the same URL
                )

                _state.value = _state.value.copy(
                    uploadingMessages = _state.value.uploadingMessages.filter { it.messageId != tempMessageId }
                )

                // Send message with image
                val message = Message(
                    senderId = currentUserId,
                    senderName = "", // TODO: Get current user's name
                    text = "🖼️ Photo",
                    type = MessageType.IMAGE,
                    mediaUrl = downloadUrl,
                    mediaMetadata = mediaMetadata
                )

                when (sendMessageUseCase(chatId, message, isGroupChat = false)) {
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
        val chatId = _state.value.chatId
        if (chatId == null) {
            onError("Chat not initialized")
            return
        }

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
                    .child("chats/direct/$chatId/${UUID.randomUUID()}/$fileName")

                val uploadTask = storageRef.putFile(videoUri).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                // Create media metadata
                val mediaMetadata = MediaMetadata(
                    fileName = fileName,
                    fileSize = fileSize,
                    mimeType = mimeType,
                    thumbnailUrl = null // Videos don't have thumbnails yet
                )

                _state.value = _state.value.copy(
                    uploadingMessages = _state.value.uploadingMessages.filter { it.messageId != tempMessageId }
                )

                // Send message with video
                val message = Message(
                    senderId = currentUserId,
                    senderName = "", // TODO: Get current user's name
                    text = "🎥 Video",
                    type = MessageType.VIDEO,
                    mediaUrl = downloadUrl,
                    mediaMetadata = mediaMetadata
                )

                when (sendMessageUseCase(chatId, message, isGroupChat = false)) {
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
        val chatId = _state.value.chatId
        if (chatId == null) {
            onError("Chat not initialized")
            return
        }

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
                    .child("chats/direct/$chatId/documents/${UUID.randomUUID()}/$fileName")

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
                    senderName = "", // TODO: Get current user's name
                    text = "📄 $fileName",
                    type = MessageType.DOCUMENT,
                    mediaUrl = downloadUrl,
                    mediaMetadata = mediaMetadata
                )

                when (sendMessageUseCase(chatId, message, isGroupChat = false)) {
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
