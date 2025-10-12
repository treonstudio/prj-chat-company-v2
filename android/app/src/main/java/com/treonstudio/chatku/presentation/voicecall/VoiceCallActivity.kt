package com.treonstudio.chatku.presentation.voicecall

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.functions.FirebaseFunctions
import com.treonstudio.chatku.data.model.CallStatus
import com.treonstudio.chatku.ui.theme.ChatkuTheme
import io.agora.rtc2.ChannelMediaOptions
import io.agora.rtc2.Constants
import io.agora.rtc2.IRtcEngineEventHandler
import io.agora.rtc2.RtcEngine
import io.agora.rtc2.RtcEngineConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class VoiceCallActivity : ComponentActivity() {

    private lateinit var callId: String
    private lateinit var otherUserName: String
    private lateinit var otherUserId: String
    private var isCaller: Boolean = false

    private var callListener: ListenerRegistration? = null
    private val firestore = FirebaseFirestore.getInstance()
    private val functions = FirebaseFunctions.getInstance()
    private val auth = FirebaseAuth.getInstance()

    // Agora
    private var mRtcEngine: RtcEngine? = null
    private var agoraAppId: String = "cb0f58efebf04769926b8bb69c8d81e1"
    private var agoraToken: String = ""

    companion object {
        private const val TAG = "VoiceCallActivity"
        private const val PERMISSION_REQ_ID = 22
        const val EXTRA_CALL_ID = "extra_call_id"
        const val EXTRA_OTHER_USER_NAME = "extra_other_user_name"
        const val EXTRA_OTHER_USER_ID = "extra_other_user_id"
        const val EXTRA_IS_CALLER = "extra_is_caller"

        fun createIntent(
            context: Context,
            callId: String,
            otherUserName: String,
            otherUserId: String,
            isCaller: Boolean
        ): Intent {
            return Intent(context, VoiceCallActivity::class.java).apply {
                putExtra(EXTRA_CALL_ID, callId)
                putExtra(EXTRA_OTHER_USER_NAME, otherUserName)
                putExtra(EXTRA_OTHER_USER_ID, otherUserId)
                putExtra(EXTRA_IS_CALLER, isCaller)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        }
    }

    // Permission launcher
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            startVoiceCall()
        } else {
            Toast.makeText(this, "Permissions required for voice call", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private val mRtcEventHandler = object : IRtcEngineEventHandler() {
        override fun onJoinChannelSuccess(channel: String?, uid: Int, elapsed: Int) {
            super.onJoinChannelSuccess(channel, uid, elapsed)
            runOnUiThread {
                Log.d(TAG, "✅ Successfully joined channel: $channel with uid: $uid in ${elapsed}ms")
                showToast("Connected to call")
            }
        }

        override fun onUserJoined(uid: Int, elapsed: Int) {
            runOnUiThread {
                Log.d(TAG, "✅ Remote user joined: $uid")
                showToast("$otherUserName joined")
            }
        }

        override fun onUserOffline(uid: Int, reason: Int) {
            super.onUserOffline(uid, reason)
            runOnUiThread {
                Log.d(TAG, "❌ User offline: $uid, reason: $reason")
                showToast("$otherUserName left the call")
            }
        }

        override fun onConnectionStateChanged(state: Int, reason: Int) {
            super.onConnectionStateChanged(state, reason)
            val stateStr = when(state) {
                1 -> "DISCONNECTED"
                2 -> "CONNECTING"
                3 -> "CONNECTED"
                4 -> "RECONNECTING"
                5 -> "FAILED"
                else -> "UNKNOWN($state)"
            }
            val reasonStr = when(reason) {
                0 -> "CONNECTING"
                1 -> "JOIN_SUCCESS"
                2 -> "INTERRUPTED"
                3 -> "BANNED_BY_SERVER"
                4 -> "JOIN_FAILED"
                5 -> "LEAVE_CHANNEL"
                6 -> "INVALID_APP_ID"
                7 -> "INVALID_CHANNEL_NAME"
                8 -> "INVALID_TOKEN"
                9 -> "TOKEN_EXPIRED"
                10 -> "REJECTED_BY_SERVER"
                11 -> "SETTING_PROXY_SERVER"
                12 -> "RENEW_TOKEN"
                13 -> "CLIENT_IP_ADDRESS_CHANGED"
                14 -> "KEEP_ALIVE_TIMEOUT"
                else -> "UNKNOWN($reason)"
            }
            Log.d(TAG, "📡 Connection state changed: $stateStr, reason: $reasonStr")

            if (state == 5) { // FAILED
                runOnUiThread {
                    showToast("Connection failed: $reasonStr")
                }
            }
        }

        override fun onError(err: Int) {
            super.onError(err)
            val errorMsg = when(err) {
                110 -> "ERR_OPEN_CHANNEL_TIMEOUT (110) - Failed to join channel. Check token/appID"
                2 -> "ERR_INVALID_ARGUMENT (2) - Invalid parameter"
                3 -> "ERR_NOT_READY (3) - SDK not ready"
                5 -> "ERR_REFUSED (5) - Request refused"
                17 -> "ERR_NOT_INITIALIZED (17) - SDK not initialized"
                101 -> "ERR_INVALID_APP_ID (101) - Invalid App ID"
                102 -> "ERR_INVALID_CHANNEL_NAME (102) - Invalid channel name"
                109 -> "ERR_TOKEN_EXPIRED (109) - Token expired"
                else -> "Error code: $err"
            }
            Log.e(TAG, "❌ Agora error: $errorMsg")
            runOnUiThread {
                showToast("Call error: $errorMsg")
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        callId = intent.getStringExtra(EXTRA_CALL_ID) ?: ""
        otherUserName = intent.getStringExtra(EXTRA_OTHER_USER_NAME) ?: "Unknown"
        otherUserId = intent.getStringExtra(EXTRA_OTHER_USER_ID) ?: ""
        isCaller = intent.getBooleanExtra(EXTRA_IS_CALLER, false)

        if (callId.isEmpty()) {
            Log.e(TAG, "Call ID is empty")
            finish()
            return
        }

        // Listen to call status for unexpected disconnections
        observeCallStatus()

        // Check permissions and start call
        if (checkPermissions()) {
            startVoiceCall()
        } else {
            requestPermissions()
        }

        setContent {
            ChatkuTheme {
                VoiceCallScreen(
                    otherUserName = otherUserName,
                    callId = callId,
                    onEndCall = { endCall() },
                    onToggleMute = { isMuted -> toggleMute(isMuted) }
                )
            }
        }
    }

    private fun observeCallStatus() {
        callListener = firestore.collection("calls")
            .document(callId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to call", error)
                    finish()
                    return@addSnapshotListener
                }

                snapshot?.let { doc ->
                    val status = doc.getString("status")

                    when (status) {
                        CallStatus.ENDED -> {
                            Log.d(TAG, "Call ended")
                            Toast.makeText(this, "Call ended", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                        CallStatus.CANCELLED -> {
                            Log.d(TAG, "Call cancelled")
                            Toast.makeText(this, "Call cancelled", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                    }
                }
            }
    }

    private fun checkPermissions(): Boolean {
        for (permission in getRequiredPermissions()) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                return false
            }
        }
        return true
    }

    private fun requestPermissions() {
        permissionLauncher.launch(getRequiredPermissions())
    }

    private fun getRequiredPermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.BLUETOOTH_CONNECT
            )
        } else {
            arrayOf(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun startVoiceCall() {
        // Fetch Agora token from Cloud Function
        fetchAgoraToken()
    }

    private fun fetchAgoraToken() {
        val currentUserId = auth.currentUser?.uid ?: return

        lifecycleScope.launch {
            try {
                Log.d(TAG, "Fetching Agora token for channel: $callId")

                val data = hashMapOf(
                    "channelName" to callId,
                    "account" to currentUserId
                )

                val task = functions
                    .getHttpsCallable("generateAgoraToken")
                    .call(data)

                @Suppress("UNCHECKED_CAST")
                val responseData = task.continueWith { t ->
                    val result = t.result
                    // Use reflection to access private data field
                    val field = result.javaClass.getDeclaredField("data")
                    field.isAccessible = true
                    field.get(result) as? Map<String, Any>
                }.await()

                agoraToken = responseData?.get("token") as? String ?: ""
                agoraAppId = responseData?.get("appId") as? String ?: ""

                Log.d(TAG, "Agora token received. AppId: $agoraAppId")

                if (agoraToken.isNotEmpty() && agoraAppId.isNotEmpty()) {
                    initializeAgoraEngine()
                    joinChannel()
                } else {
                    Log.e(TAG, "Failed to get valid Agora credentials")
                    showToast("Failed to initialize call")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching Agora token", e)
                showToast("Failed to connect: ${e.message}")
            }
        }
    }

    private fun initializeAgoraEngine() {
        try {
            val config = RtcEngineConfig().apply {
                mContext = baseContext
                mAppId = agoraAppId
                mEventHandler = mRtcEventHandler
            }
            mRtcEngine = RtcEngine.create(config)
            Log.d(TAG, "Agora engine initialized")
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing Agora engine", e)
            throw RuntimeException("Error initializing RTC engine: ${e.message}")
        }
    }

    private fun joinChannel() {
        val options = ChannelMediaOptions().apply {
            clientRoleType = Constants.CLIENT_ROLE_BROADCASTER
            channelProfile = Constants.CHANNEL_PROFILE_COMMUNICATION
            publishMicrophoneTrack = true
        }

        // Use UID 0 to let Agora auto-assign, which works with tokens generated with string account
        val currentUserId = auth.currentUser?.uid ?: return

        Log.d(TAG, "🔄 Attempting to join channel...")
        Log.d(TAG, "   Channel: $callId")
        Log.d(TAG, "   Account: $currentUserId")
        Log.d(TAG, "   Token length: ${agoraToken.length}")
        Log.d(TAG, "   AppId: $agoraAppId")

        mRtcEngine?.joinChannelWithUserAccount(agoraToken, callId, currentUserId, options)
    }

    fun toggleMute(isMuted: Boolean) {
        mRtcEngine?.muteLocalAudioStream(isMuted)
        Log.d(TAG, "Audio muted: $isMuted")
    }

    private fun endCall() {
        lifecycleScope.launch {
            try {
                // Get current call data to calculate duration
                val callDoc = firestore.collection("calls")
                    .document(callId)
                    .get()
                    .await()

                val acceptedAt = callDoc.getTimestamp("acceptedAt")
                val durationSeconds = if (acceptedAt != null) {
                    val now = System.currentTimeMillis()
                    val acceptedTime = acceptedAt.toDate().time
                    ((now - acceptedTime) / 1000).toInt()
                } else {
                    0
                }

                firestore.collection("calls")
                    .document(callId)
                    .update(
                        mapOf(
                            "status" to CallStatus.ENDED,
                            "endedAt" to Timestamp.now(),
                            "duration" to durationSeconds
                        )
                    )
                    .await()

                Log.d(TAG, "Call ended with duration: $durationSeconds seconds")
                finish()
            } catch (e: Exception) {
                Log.e(TAG, "Error ending call", e)
                finish()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        callListener?.remove()
        cleanupAgoraEngine()
    }

    private fun cleanupAgoraEngine() {
        mRtcEngine?.apply {
            leaveChannel()
            RtcEngine.destroy()
        }
        mRtcEngine = null
        Log.d(TAG, "Agora engine cleaned up")
    }

    private fun showToast(message: String) {
        runOnUiThread {
            Toast.makeText(this@VoiceCallActivity, message, Toast.LENGTH_SHORT).show()
        }
    }
}

@Composable
private fun VoiceCallScreen(
    otherUserName: String,
    callId: String,
    onEndCall: () -> Unit,
    onToggleMute: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    var isMuted by remember { mutableStateOf(false) }
    var elapsedTime by remember { mutableStateOf(0) }

    // Timer effect
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            elapsedTime++
        }
    }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Spacer(modifier = Modifier.height(80.dp))

            // Avatar and name section
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Avatar
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "User Avatar",
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                // User name
                Text(
                    text = otherUserName,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onBackground,
                    textAlign = TextAlign.Center
                )

                // Call timer
                Text(
                    text = formatTime(elapsedTime),
                    fontSize = 18.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Control buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Mute button
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FloatingActionButton(
                        onClick = {
                            isMuted = !isMuted
                            onToggleMute(isMuted)
                        },
                        modifier = Modifier.size(64.dp),
                        containerColor = if (isMuted) Color(0xFF757575) else MaterialTheme.colorScheme.primaryContainer,
                        elevation = FloatingActionButtonDefaults.elevation(
                            defaultElevation = 4.dp
                        )
                    ) {
                        Icon(
                            imageVector = if (isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                            contentDescription = if (isMuted) "Unmute" else "Mute",
                            modifier = Modifier.size(32.dp),
                            tint = if (isMuted) Color.White else MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                    Text(
                        text = if (isMuted) "Unmute" else "Mute",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // End call button
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FloatingActionButton(
                        onClick = onEndCall,
                        modifier = Modifier.size(64.dp),
                        containerColor = Color(0xFFD32F2F), // Red
                        elevation = FloatingActionButtonDefaults.elevation(
                            defaultElevation = 4.dp
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.CallEnd,
                            contentDescription = "End Call",
                            modifier = Modifier.size(32.dp),
                            tint = Color.White
                        )
                    }
                    Text(
                        text = "End Call",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}

@Composable
private fun formatTime(seconds: Int): String {
    val minutes = seconds / 60
    val secs = seconds % 60
    return String.format("%02d:%02d", minutes, secs)
}
