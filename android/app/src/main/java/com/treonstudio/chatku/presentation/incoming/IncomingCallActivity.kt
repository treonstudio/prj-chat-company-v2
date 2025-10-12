package com.treonstudio.chatku.presentation.incoming

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
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
import androidx.lifecycle.lifecycleScope
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.treonstudio.chatku.data.model.CallStatus
import com.treonstudio.chatku.presentation.voicecall.VoiceCallActivity
import com.treonstudio.chatku.ui.theme.ChatkuTheme
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class IncomingCallActivity : ComponentActivity() {

    private lateinit var callId: String
    private lateinit var callerName: String
    private lateinit var callerId: String
    private var callListener: ListenerRegistration? = null
    private val firestore = FirebaseFirestore.getInstance()

    companion object {
        private const val TAG = "IncomingCallActivity"
        const val EXTRA_CALL_ID = "extra_call_id"
        const val EXTRA_CALLER_NAME = "extra_caller_name"
        const val EXTRA_CALLER_ID = "extra_caller_id"
        private const val CALL_NOTIFICATION_ID = 2

        fun createIntent(
            context: Context,
            callId: String,
            callerName: String,
            callerId: String
        ): Intent {
            return Intent(context, IncomingCallActivity::class.java).apply {
                putExtra(EXTRA_CALL_ID, callId)
                putExtra(EXTRA_CALLER_NAME, callerName)
                putExtra(EXTRA_CALLER_ID, callerId)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over lock screen
        setupWindowFlags()

        callId = intent.getStringExtra(EXTRA_CALL_ID) ?: ""
        callerName = intent.getStringExtra(EXTRA_CALLER_NAME) ?: "Unknown"
        callerId = intent.getStringExtra(EXTRA_CALLER_ID) ?: ""

        if (callId.isEmpty()) {
            Log.e(TAG, "Call ID is empty")
            finish()
            return
        }

        // Listen to call status changes (for cancellation detection)
        observeCallStatus()

        setContent {
            ChatkuTheme {
                IncomingCallScreen(
                    callerName = callerName,
                    onAccept = { acceptCall() },
                    onDecline = { declineCall() }
                )
            }
        }
    }

    private fun setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
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
                        CallStatus.CANCELLED -> {
                            // Caller cancelled the call
                            Log.d(TAG, "Call was cancelled by caller")
                            Toast.makeText(this, "Call cancelled", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                        CallStatus.MISSED -> {
                            // Call timed out
                            Log.d(TAG, "Call missed (timeout)")
                            finish()
                        }
                        CallStatus.ACCEPTED -> {
                            // We accepted the call (handled by acceptCall function)
                            Log.d(TAG, "Call accepted")
                        }
                        CallStatus.DECLINED -> {
                            // We declined the call (handled by declineCall function)
                            Log.d(TAG, "Call declined")
                        }
                    }
                }
            }
    }

    private fun acceptCall() {
        lifecycleScope.launch {
            try {
                firestore.collection("calls")
                    .document(callId)
                    .update(
                        mapOf(
                            "status" to CallStatus.ACCEPTED,
                            "acceptedAt" to Timestamp.now()
                        )
                    )
                    .await()

                Log.d(TAG, "Call accepted")

                // Navigate to VoiceCallActivity
                val intent = VoiceCallActivity.createIntent(
                    context = this@IncomingCallActivity,
                    callId = callId,
                    otherUserName = callerName,
                    otherUserId = callerId,
                    isCaller = false
                )
                startActivity(intent)
                finish()
            } catch (e: Exception) {
                Log.e(TAG, "Error accepting call", e)
                Toast.makeText(this@IncomingCallActivity, "Failed to accept call", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun declineCall() {
        lifecycleScope.launch {
            try {
                firestore.collection("calls")
                    .document(callId)
                    .update(
                        mapOf(
                            "status" to CallStatus.DECLINED,
                            "endedAt" to Timestamp.now()
                        )
                    )
                    .await()

                Log.d(TAG, "Call declined")
                finish()
            } catch (e: Exception) {
                Log.e(TAG, "Error declining call", e)
            }
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        callListener?.remove()

        // Dismiss the notification when activity closes
        dismissNotification()
    }

    private fun dismissNotification() {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(CALL_NOTIFICATION_ID)
        Log.d(TAG, "Call notification dismissed")
    }
}

@Composable
private fun IncomingCallScreen(
    callerName: String,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    modifier: Modifier = Modifier
) {
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
                        contentDescription = "Caller Avatar",
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                // Caller name
                Text(
                    text = callerName,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onBackground,
                    textAlign = TextAlign.Center
                )

                // Incoming call text
                Text(
                    text = "Incoming voice call...",
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Accept and Decline buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Decline button
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FloatingActionButton(
                        onClick = onDecline,
                        modifier = Modifier.size(64.dp),
                        containerColor = Color(0xFFD32F2F), // Red
                        elevation = FloatingActionButtonDefaults.elevation(
                            defaultElevation = 4.dp
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.CallEnd,
                            contentDescription = "Decline",
                            modifier = Modifier.size(32.dp),
                            tint = Color.White
                        )
                    }
                    Text(
                        text = "Decline",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Accept button
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FloatingActionButton(
                        onClick = onAccept,
                        modifier = Modifier.size(64.dp),
                        containerColor = Color(0xFF4CAF50), // Green
                        elevation = FloatingActionButtonDefaults.elevation(
                            defaultElevation = 4.dp
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Call,
                            contentDescription = "Accept",
                            modifier = Modifier.size(32.dp),
                            tint = Color.White
                        )
                    }
                    Text(
                        text = "Accept",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}
