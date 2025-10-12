package com.treonstudio.chatku.presentation.chatdetail

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.google.firebase.firestore.FirebaseFirestore
import com.treonstudio.chatku.data.model.UserStatus
import com.treonstudio.chatku.data.repository.DirectChatRepositoryImpl
import com.treonstudio.chatku.data.repository.MessageRepositoryImpl
import com.treonstudio.chatku.data.repository.UserRepositoryImpl
import com.treonstudio.chatku.domain.usecase.GetMessagesUseCase
import com.treonstudio.chatku.domain.usecase.GetOrCreateDirectChatUseCase
import com.treonstudio.chatku.domain.usecase.GetUserByIdUseCase
import com.treonstudio.chatku.domain.usecase.MarkMessagesAsReadUseCase
import com.treonstudio.chatku.domain.usecase.SendMessageUseCase
import com.treonstudio.chatku.presentation.components.DateDivider
import com.treonstudio.chatku.presentation.components.MessageBubble
import com.treonstudio.chatku.presentation.dialing.DialingActivity
import com.treonstudio.chatku.presentation.imageviewer.ImageViewerActivity
import com.treonstudio.chatku.presentation.videoviewer.VideoViewerActivity
import com.treonstudio.chatku.ui.theme.ChatkuTheme
import com.treonstudio.chatku.ui.theme.Green40
import com.treonstudio.chatku.ui.theme.Green80
import com.google.firebase.storage.FirebaseStorage
import com.treonstudio.chatku.data.model.MediaMetadata
import com.treonstudio.chatku.data.model.MessageType
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class ChatDetailActivity : ComponentActivity() {

    companion object {
        private const val EXTRA_OTHER_USER_ID = "extra_other_user_id"
        private const val EXTRA_CURRENT_USER_ID = "extra_current_user_id"

        fun createIntent(
            context: Context,
            otherUserId: String,
            currentUserId: String
        ): Intent {
            return Intent(context, ChatDetailActivity::class.java).apply {
                putExtra(EXTRA_OTHER_USER_ID, otherUserId)
                putExtra(EXTRA_CURRENT_USER_ID, currentUserId)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val otherUserId = intent.getStringExtra(EXTRA_OTHER_USER_ID) ?: ""
        val currentUserId = intent.getStringExtra(EXTRA_CURRENT_USER_ID) ?: ""

        setContent {
            ChatkuTheme {
                ChatDetailScreen(
                    otherUserId = otherUserId,
                    currentUserId = currentUserId,
                    onNavigateBack = {
                        finish()
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatDetailScreen(
    otherUserId: String,
    currentUserId: String,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Manually instantiate dependencies
    val viewModel = remember {
        val firestore = FirebaseFirestore.getInstance()

        // Repositories
        val userRepository = UserRepositoryImpl(firestore)
        val directChatRepository = DirectChatRepositoryImpl(firestore)
        val messageRepository = MessageRepositoryImpl(firestore)

        // Use cases
        val getUserByIdUseCase = GetUserByIdUseCase(userRepository)
        val getOrCreateDirectChatUseCase = GetOrCreateDirectChatUseCase(directChatRepository)
        val getMessagesUseCase = GetMessagesUseCase(messageRepository)
        val sendMessageUseCase = SendMessageUseCase(messageRepository)
        val markMessagesAsReadUseCase = MarkMessagesAsReadUseCase(messageRepository)

        ChatDetailViewModel(
            otherUserId = otherUserId,
            currentUserId = currentUserId,
            getUserByIdUseCase = getUserByIdUseCase,
            getOrCreateDirectChatUseCase = getOrCreateDirectChatUseCase,
            getMessagesUseCase = getMessagesUseCase,
            sendMessageUseCase = sendMessageUseCase,
            markMessagesAsReadUseCase = markMessagesAsReadUseCase
        )
    }

    val state by viewModel.state.collectAsState()
    val listState = rememberLazyListState()
    val context = LocalContext.current
    var showAttachmentSheet by remember { mutableStateOf(false) }
    var showMediaSourceSheet by remember { mutableStateOf(false) }
    var selectedMediaType by remember { mutableStateOf<MediaType?>(null) }
    var currentPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var currentVideoUri by remember { mutableStateOf<Uri?>(null) }
    var isUploading by remember { mutableStateOf(false) }

    // Media preview launcher
    val mediaPreviewLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val resultUriString = result.data?.getStringExtra(com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.EXTRA_RESULT_URI)
            val isCompressed = result.data?.getBooleanExtra(com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.EXTRA_IS_COMPRESSED, false) ?: false

            resultUriString?.let { uriString ->
                val resultUri = Uri.parse(uriString)
                isUploading = true

                when (selectedMediaType) {
                    MediaType.IMAGE -> {
                        viewModel.uploadImageAndSendMessage(
                            context = context,
                            imageUri = resultUri,
                            onSuccess = {
                                isUploading = false
                                Toast.makeText(context, "Image sent successfully", Toast.LENGTH_SHORT).show()
                            },
                            onError = { error ->
                                isUploading = false
                                Toast.makeText(context, "Failed to send image: $error", Toast.LENGTH_SHORT).show()
                            }
                        )
                    }
                    MediaType.VIDEO -> {
                        viewModel.uploadVideoAndSendMessage(
                            context = context,
                            videoUri = resultUri,
                            onSuccess = {
                                isUploading = false
                                Toast.makeText(context, "Video sent successfully", Toast.LENGTH_SHORT).show()
                            },
                            onError = { error ->
                                isUploading = false
                                Toast.makeText(context, "Failed to send video: $error", Toast.LENGTH_SHORT).show()
                            }
                        )
                    }
                    else -> {}
                }
            }
        }
    }

    // Gallery launcher for images
    val imageGalleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            val intent = com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.createIntent(
                context = context,
                mediaUri = it,
                mediaType = com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.MEDIA_TYPE_IMAGE
            )
            mediaPreviewLauncher.launch(intent)
        }
    }

    // Gallery launcher for videos
    val videoGalleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            val intent = com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.createIntent(
                context = context,
                mediaUri = it,
                mediaType = com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.MEDIA_TYPE_VIDEO
            )
            mediaPreviewLauncher.launch(intent)
        }
    }

    // Camera launcher for photos
    val cameraPhotoLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && currentPhotoUri != null) {
            val intent = com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.createIntent(
                context = context,
                mediaUri = currentPhotoUri!!,
                mediaType = com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.MEDIA_TYPE_IMAGE
            )
            mediaPreviewLauncher.launch(intent)
        }
    }

    // Camera launcher for videos
    val cameraVideoLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CaptureVideo()
    ) { success ->
        if (success && currentVideoUri != null) {
            val intent = com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.createIntent(
                context = context,
                mediaUri = currentVideoUri!!,
                mediaType = com.treonstudio.chatku.presentation.mediapreview.MediaPreviewActivity.MEDIA_TYPE_VIDEO
            )
            mediaPreviewLauncher.launch(intent)
        }
    }

    // Document picker launcher
    val documentPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            isUploading = true
            viewModel.uploadDocumentAndSendMessage(
                context = context,
                documentUri = it,
                onSuccess = {
                    isUploading = false
                    Toast.makeText(context, "Document sent successfully", Toast.LENGTH_SHORT).show()
                },
                onError = { error ->
                    isUploading = false
                    Toast.makeText(context, "Failed to send document: $error", Toast.LENGTH_SHORT).show()
                }
            )
        }
    }

    // Permission launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            // Permission granted, launch camera based on media type
            when (selectedMediaType) {
                MediaType.IMAGE -> {
                    val photoFile = createImageFile(context)
                    val photoUri = FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.fileprovider",
                        photoFile
                    )
                    currentPhotoUri = photoUri
                    cameraPhotoLauncher.launch(photoUri)
                }
                MediaType.VIDEO -> {
                    val videoFile = createVideoFile(context)
                    val videoUri = FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.fileprovider",
                        videoFile
                    )
                    currentVideoUri = videoUri
                    cameraVideoLauncher.launch(videoUri)
                }
                else -> {
                    Toast.makeText(context, "Please select media type first", Toast.LENGTH_SHORT).show()
                }
            }
        } else {
            Toast.makeText(context, "Camera permission is required", Toast.LENGTH_SHORT).show()
        }
    }

    // Track lifecycle to know when screen is visible
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    // Screen is now visible - enable auto-read
                    viewModel.setScreenVisible(true)
                }
                Lifecycle.Event.ON_PAUSE -> {
                    // Screen is no longer visible - disable auto-read
                    viewModel.setScreenVisible(false)
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                modifier = Modifier.shadow(20.dp),
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                    ) {
                        // Avatar
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primaryContainer),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = "User Avatar",
                                modifier = Modifier.size(24.dp),
                                tint = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        // Name and status
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(0.dp)
                        ) {
                            Text(
                                text = state.otherUser?.displayName ?: "Loading...",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color =  MaterialTheme.colorScheme.onPrimary,
                                lineHeight = 16.sp,
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            state.otherUser?.let { user ->
                                Text(
                                    text = when (user.status) {
                                        UserStatus.ONLINE -> "Online"
                                        UserStatus.OFFLINE -> user.lastSeen?.let {
                                            val format = SimpleDateFormat("HH:mm", Locale.getDefault())
                                            "Last seen ${format.format(it.toDate())}"
                                        } ?: "Offline"
                                    },
                                    fontSize = 12.sp,
                                    lineHeight = 12.sp,
                                    color =  MaterialTheme.colorScheme.onPrimary,
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    // Call button
                    IconButton(onClick = {
                        state.otherUser?.let { user ->
                            // Get current user name from Firestore
                            val firestore = FirebaseFirestore.getInstance()
                            val auth = com.google.firebase.auth.FirebaseAuth.getInstance()
                            val currentUserId = auth.currentUser?.uid ?: ""

                            firestore.collection("users")
                                .document(currentUserId)
                                .get()
                                .addOnSuccessListener { doc ->
                                    val currentUserName = doc.getString("displayName") ?: "You"
                                    val intent = DialingActivity.createIntent(
                                        context = context,
                                        userName = user.displayName,
                                        userId = user.userId,
                                        currentUserName = currentUserName
                                    )
                                    context.startActivity(intent)
                                }
                                .addOnFailureListener {
                                    // Fallback if can't get name
                                    val intent = DialingActivity.createIntent(
                                        context = context,
                                        userName = user.displayName,
                                        userId = user.userId,
                                        currentUserName = "You"
                                    )
                                    context.startActivity(intent)
                                }
                        }
                    }) {
                        Icon(
                            imageVector = Icons.Default.Call,
                            contentDescription = "Call"
                        )
                    }

                    // More options button
                    IconButton(onClick = { /* TODO: Handle more options */ }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "More options"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Green40,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        bottomBar = {
            // Message input field
            Surface(
                modifier = Modifier.fillMaxWidth().shadow(20.dp),
                tonalElevation = 3.dp,
                shadowElevation = 3.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    // Text field
                    OutlinedTextField(
                        value = state.messageText,
                        onValueChange = { viewModel.updateMessageText(it) },
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp, max = 120.dp),
                        placeholder = { Text("Type a message...") },
                        trailingIcon = {
                            IconButton(onClick = { showAttachmentSheet = true }) {
                                Icon(
                                    imageVector = Icons.Default.AttachFile,
                                    contentDescription = "Attach file",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        },
                        shape = MaterialTheme.shapes.medium,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline
                        ),
                        maxLines = 4
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // Send button
                    FloatingActionButton(
                        onClick = { viewModel.sendMessage() },
                        modifier = Modifier.size(48.dp),
                        containerColor = MaterialTheme.colorScheme.primary,
                        elevation = FloatingActionButtonDefaults.elevation(
                            defaultElevation = 0.dp
                        )
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Send",
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        // Messages list
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            if (state.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center)
                )
            } else if (state.error != null) {
                Text(
                    text = state.error ?: "Unknown error",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(16.dp)
                )
            } else if (state.messages.isEmpty()) {
                Text(
                    text = "No messages yet.\nStart the conversation!",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(16.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    reverseLayout = true
                ) {
                    // Combine uploading messages with regular messages
                    val allMessages = state.messages + state.uploadingMessages

                    // Group messages by date
                    val groupedMessages = allMessages
                        .sortedByDescending { it.timestamp?.toDate()?.time ?: System.currentTimeMillis() }
                        .groupBy { message ->
                            message.timestamp?.let {
                                val cal = Calendar.getInstance()
                                cal.time = it.toDate()
                                cal.set(Calendar.HOUR_OF_DAY, 0)
                                cal.set(Calendar.MINUTE, 0)
                                cal.set(Calendar.SECOND, 0)
                                cal.set(Calendar.MILLISECOND, 0)
                                cal.timeInMillis
                            } ?: run {
                                // For uploading messages without timestamp, use current date
                                val cal = Calendar.getInstance()
                                cal.set(Calendar.HOUR_OF_DAY, 0)
                                cal.set(Calendar.MINUTE, 0)
                                cal.set(Calendar.SECOND, 0)
                                cal.set(Calendar.MILLISECOND, 0)
                                cal.timeInMillis
                            }
                        }

                    groupedMessages.forEach { (date, messagesForDate) ->
                        items(messagesForDate) { message ->
                            val isUploading = state.uploadingMessages.any { it.messageId == message.messageId }
                            MessageBubble(
                                message = message,
                                isFromCurrentUser = message.senderId == currentUserId,
                                isUploading = isUploading,
                                onImageClick = { imageUrl,fileName ->
                                    val intent = ImageViewerActivity.createIntent(context, imageUrl,fileName)
                                    context.startActivity(intent)
                                },
                                onVideoClick = { videoUrl, fileName ->
                                    val intent = VideoViewerActivity.createIntent(context, videoUrl, fileName)
                                    context.startActivity(intent)
                                }
                            )
                        }

                        // Date divider
                        date?.let {
                            item {
                                DateDivider(timestamp = it)
                            }
                        }
                    }
                }
            }
        }
    }

    // Attachment Bottom Sheet
    if (showAttachmentSheet) {
        ModalBottomSheet(
            onDismissRequest = { showAttachmentSheet = false },
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp, horizontal = 16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Image option
                    AttachmentOption(
                        icon = Icons.Default.Image,
                        label = "Image",
                        backgroundColor = Color(0xFF6366F1), // Indigo
                        onClick = {
                            showAttachmentSheet = false
                            selectedMediaType = MediaType.IMAGE
                            showMediaSourceSheet = true
                        }
                    )

                    // Video option
                    AttachmentOption(
                        icon = Icons.Default.VideoLibrary,
                        label = "Video",
                        backgroundColor = Color(0xFFEC4899), // Pink
                        onClick = {
                            showAttachmentSheet = false
                            selectedMediaType = MediaType.VIDEO
                            showMediaSourceSheet = true
                        }
                    )

                    // Document option
                    AttachmentOption(
                        icon = Icons.Default.Description,
                        label = "Document",
                        backgroundColor = Color(0xFF10B981), // Green
                        onClick = {
                            showAttachmentSheet = false
                            // Launch document picker with common document MIME types
                            documentPickerLauncher.launch("application/*")
                        }
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }

    // Media Source Bottom Sheet (Camera or Gallery)
    if (showMediaSourceSheet) {
        ModalBottomSheet(
            onDismissRequest = { showMediaSourceSheet = false },
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp, horizontal = 16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Camera option
                    AttachmentOption(
                        icon = Icons.Default.CameraAlt,
                        label = "Camera",
                        backgroundColor = Color(0xFF3B82F6), // Blue
                        onClick = {
                            showMediaSourceSheet = false
                            // Request camera permission and launch camera
                            permissionLauncher.launch(android.Manifest.permission.CAMERA)
                        }
                    )

                    // Gallery option
                    AttachmentOption(
                        icon = Icons.Default.PhotoLibrary,
                        label = "Gallery",
                        backgroundColor = Color(0xFF8B5CF6), // Purple
                        onClick = {
                            showMediaSourceSheet = false
                            // Launch gallery picker based on selected media type
                            when (selectedMediaType) {
                                MediaType.IMAGE -> imageGalleryLauncher.launch("image/*")
                                MediaType.VIDEO -> videoGalleryLauncher.launch("video/*")
                                else -> imageGalleryLauncher.launch("image/*")
                            }
                        }
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

private enum class MediaType {
    IMAGE,
    VIDEO
}

@Composable
private fun AttachmentOption(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    backgroundColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Icon with colorful background
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(backgroundColor),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = Color.White,
                modifier = Modifier.size(28.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Label below icon
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

private fun createImageFile(context: Context): File {
    val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
    val storageDir = context.getExternalFilesDir(null)
    return File.createTempFile(
        "JPEG_${timeStamp}_",
        ".jpg",
        storageDir
    )
}

private fun createVideoFile(context: Context): File {
    val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
    val storageDir = context.getExternalFilesDir(null)
    return File.createTempFile(
        "MP4_${timeStamp}_",
        ".mp4",
        storageDir
    )
}
