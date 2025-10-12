package com.treonstudio.chatku.presentation.mediapreview

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.AsyncImage
import com.abedelazizshe.lightcompressorlibrary.CompressionListener
import com.abedelazizshe.lightcompressorlibrary.VideoCompressor
import com.abedelazizshe.lightcompressorlibrary.VideoQuality
import com.abedelazizshe.lightcompressorlibrary.config.Configuration
import com.abedelazizshe.lightcompressorlibrary.config.SaveLocation
import com.abedelazizshe.lightcompressorlibrary.config.SharedStorageConfiguration
import com.treonstudio.chatku.ui.theme.ChatkuTheme
import com.treonstudio.chatku.ui.theme.Green40
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

class MediaPreviewActivity : ComponentActivity() {

    companion object {
        private const val EXTRA_MEDIA_URI = "extra_media_uri"
        private const val EXTRA_MEDIA_TYPE = "extra_media_type"
        const val EXTRA_RESULT_URI = "extra_result_uri"
        const val EXTRA_IS_COMPRESSED = "extra_is_compressed"

        const val MEDIA_TYPE_IMAGE = "image"
        const val MEDIA_TYPE_VIDEO = "video"

        fun createIntent(
            context: Context,
            mediaUri: Uri,
            mediaType: String
        ): Intent {
            return Intent(context, MediaPreviewActivity::class.java).apply {
                putExtra(EXTRA_MEDIA_URI, mediaUri.toString())
                putExtra(EXTRA_MEDIA_TYPE, mediaType)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val mediaUriString = intent.getStringExtra(EXTRA_MEDIA_URI) ?: ""
        val mediaType = intent.getStringExtra(EXTRA_MEDIA_TYPE) ?: MEDIA_TYPE_IMAGE
        val mediaUri = Uri.parse(mediaUriString)

        setContent {
            ChatkuTheme {
                MediaPreviewScreen(
                    mediaUri = mediaUri,
                    mediaType = mediaType,
                    onSend = { resultUri, isCompressed ->
                        val resultIntent = Intent().apply {
                            putExtra(EXTRA_RESULT_URI, resultUri.toString())
                            putExtra(EXTRA_IS_COMPRESSED, isCompressed)
                        }
                        setResult(RESULT_OK, resultIntent)
                        finish()
                    },
                    onCancel = {
                        setResult(RESULT_CANCELED)
                        finish()
                    }
                )
            }
        }
    }
}

@androidx.annotation.OptIn(UnstableApi::class)
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MediaPreviewScreen(
    mediaUri: Uri,
    mediaType: String,
    onSend: (Uri, Boolean) -> Unit,
    onCancel: () -> Unit
) {
    val context = LocalContext.current
    var useCompression by remember { mutableStateOf(true) }
    var isCompressing by remember { mutableStateOf(false) }
    var compressionProgress by remember { mutableFloatStateOf(0f) }
    var compressedUri by remember { mutableStateOf<Uri?>(null) }
    var originalSizeText by remember { mutableStateOf("") }
    var compressedSizeText by remember { mutableStateOf("") }

    // ExoPlayer for video preview
    val exoPlayer = remember {
        if (mediaType == MediaPreviewActivity.MEDIA_TYPE_VIDEO) {
            ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(mediaUri))
                prepare()
                playWhenReady = false
            }
        } else null
    }

    var isPlaying by remember { mutableStateOf(false) }

    // Cleanup ExoPlayer
    DisposableEffect(Unit) {
        onDispose {
            exoPlayer?.release()
        }
    }

    // Calculate original file size
    LaunchedEffect(mediaUri) {
        withContext(Dispatchers.IO) {
            try {
                val fileSize = context.contentResolver.openInputStream(mediaUri)?.use {
                    it.available().toLong()
                } ?: 0L
                originalSizeText = formatFileSize(fileSize)
            } catch (e: Exception) {
                originalSizeText = "Unknown"
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Preview") },
                navigationIcon = {
                    IconButton(onClick = {
                        exoPlayer?.release()
                        onCancel()
                    }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Cancel"
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            exoPlayer?.release()
                            if (useCompression && compressedUri != null) {
                                onSend(compressedUri!!, true)
                            } else {
                                onSend(mediaUri, false)
                            }
                        },
                        enabled = !isCompressing && (!useCompression || compressedUri != null)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Send"
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
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color.Black)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {

                // Media preview
                Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                    when (mediaType) {
                        MediaPreviewActivity.MEDIA_TYPE_IMAGE -> {
                            AsyncImage(
                                model = mediaUri,
                                contentDescription = "Image preview",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Fit
                            )
                        }

                        MediaPreviewActivity.MEDIA_TYPE_VIDEO -> {
                            Box(
                                modifier = Modifier.fillMaxSize()
                            ) {
                                // Video player
                                exoPlayer?.let { player ->
                                    AndroidView(
                                        factory = { ctx ->
                                            PlayerView(ctx).apply {
                                                this.player = player
                                                useController = true
                                                controllerAutoShow = true
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    )


                                    // Listen to player state
                                    LaunchedEffect(player) {
                                        val listener = object : Player.Listener {
                                            override fun onIsPlayingChanged(playing: Boolean) {
                                                isPlaying = playing
                                            }
                                        }
                                        player.addListener(listener)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Compression options at bottom
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(12.dp),
                color = Color.Black.copy(alpha = 0.7f)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = if (useCompression) "Compressed" else "HD Quality",
                                color = Color.White,
                                fontSize = 16.sp,
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = if (useCompression && compressedSizeText.isNotEmpty()) {
                                    "$originalSizeText → $compressedSizeText"
                                } else {
                                    originalSizeText
                                },
                                color = Color.White.copy(alpha = 0.7f),
                                fontSize = 12.sp
                            )
                        }

                        Switch(
                            checked = useCompression,
                            onCheckedChange = { useCompression = it },
                            enabled = !isCompressing
                        )
                    }

                    // Compression progress
                    if (isCompressing) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            LinearProgressIndicator(
                                progress = { compressionProgress },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(2.dp)),
                            )
                            Text(
                                text = "Compressing... ${(compressionProgress * 100).toInt()}%",
                                color = Color.White,
                                fontSize = 12.sp
                            )
                        }
                    }
                }

            }
        }
    }

    // Trigger compression when toggle changes
    LaunchedEffect(useCompression, mediaUri) {
        if (useCompression && compressedUri == null && !isCompressing) {
            isCompressing = true
            compressionProgress = 0f

            when (mediaType) {
                MediaPreviewActivity.MEDIA_TYPE_IMAGE -> {
                    compressImage(
                        context = context,
                        imageUri = mediaUri,
                        onProgress = { compressionProgress = it },
                        onSuccess = { uri, size ->
                            compressedUri = uri
                            compressedSizeText = formatFileSize(size)
                            isCompressing = false
                        },
                        onError = {
                            isCompressing = false
                            useCompression = false
                        }
                    )
                }
                MediaPreviewActivity.MEDIA_TYPE_VIDEO -> {
                    compressVideo(
                        context = context,
                        videoUri = mediaUri,
                        onProgress = { compressionProgress = it },
                        onSuccess = { uri, size ->
                            compressedUri = uri
                            compressedSizeText = formatFileSize(size)
                            isCompressing = false
                        },
                        onError = {
                            isCompressing = false
                            useCompression = false
                        }
                    )
                }
            }
        }
    }
}

private suspend fun compressImage(
    context: Context,
    imageUri: Uri,
    onProgress: (Float) -> Unit,
    onSuccess: (Uri, Long) -> Unit,
    onError: () -> Unit
) {
    withContext(Dispatchers.IO) {
        try {
            onProgress(0.3f)

            val bitmap = context.contentResolver.openInputStream(imageUri)?.use {
                BitmapFactory.decodeStream(it)
            } ?: throw Exception("Failed to decode image")

            onProgress(0.6f)

            val compressedFile = File(context.cacheDir, "compressed_${System.currentTimeMillis()}.jpg")
            FileOutputStream(compressedFile).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out)
            }

            onProgress(1f)

            val compressedUri = Uri.fromFile(compressedFile)
            val fileSize = compressedFile.length()

            withContext(Dispatchers.Main) {
                onSuccess(compressedUri, fileSize)
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                onError()
            }
        }
    }
}

private fun compressVideo(
    context: Context,
    videoUri: Uri,
    onProgress: (Float) -> Unit,
    onSuccess: (Uri, Long) -> Unit,
    onError: () -> Unit
) {
    VideoCompressor.start(
        context = context,
        uris = listOf(videoUri),
        isStreamable = false,
        sharedStorageConfiguration = SharedStorageConfiguration(
            saveAt = SaveLocation.movies,
            subFolderName = "chatapp"
        ),
        listener = object : CompressionListener {
            override fun onProgress(index: Int, percent: Float) {
                onProgress(percent / 100f)
            }

            override fun onStart(index: Int) {
                onProgress(0f)
            }

            override fun onSuccess(index: Int, size: Long, path: String?) {
                path?.let {
                    val compressedFile = File(it)
                    val compressedUri = Uri.fromFile(compressedFile)
                    onSuccess(compressedUri, size)
                } ?: onError()
            }

            override fun onFailure(index: Int, failureMessage: String) {
                onError()
            }

            override fun onCancelled(index: Int) {
                onError()
            }
        },
        configureWith = Configuration(
            quality = VideoQuality.MEDIUM,
            isMinBitrateCheckEnabled = false,
            videoBitrateInMbps = 3,
            disableAudio = false,
            keepOriginalResolution = false,
            videoNames = listOf("video_${System.currentTimeMillis()}")
        )
    )
}

private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> String.format("%.1f KB", bytes / 1024.0)
        bytes < 1024 * 1024 * 1024 -> String.format("%.1f MB", bytes / (1024.0 * 1024.0))
        else -> String.format("%.1f GB", bytes / (1024.0 * 1024.0 * 1024.0))
    }
}