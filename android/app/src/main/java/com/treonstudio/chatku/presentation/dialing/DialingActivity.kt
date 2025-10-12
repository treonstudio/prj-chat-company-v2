package com.treonstudio.chatku.presentation.dialing

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
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
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.treonstudio.chatku.data.model.CallStatus
import com.treonstudio.chatku.presentation.voicecall.VoiceCallActivity
import com.treonstudio.chatku.ui.theme.ChatkuTheme
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class DialingActivity : ComponentActivity() {

    private lateinit var callId: String
    private lateinit var receiverName: String
    private lateinit var receiverId: String
    private var callListener: ListenerRegistration? = null
    private val firestore = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    companion object {
        private const val TAG = "DialingActivity"
        private const val EXTRA_USER_NAME = "extra_user_name"
        private const val EXTRA_USER_ID = "extra_user_id"
        private const val EXTRA_CURRENT_USER_NAME = "extra_current_user_name"

        fun createIntent(
            context: Context,
            userName: String,
            userId: String,
            currentUserName: String = ""
        ): Intent {
            return Intent(context, DialingActivity::class.java).apply {
                putExtra(EXTRA_USER_NAME, userName)
                putExtra(EXTRA_USER_ID, userId)
                putExtra(EXTRA_CURRENT_USER_NAME, currentUserName)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        receiverName = intent.getStringExtra(EXTRA_USER_NAME) ?: "Unknown"
        receiverId = intent.getStringExtra(EXTRA_USER_ID) ?: ""
        val currentUserName = intent.getStringExtra(EXTRA_CURRENT_USER_NAME) ?: "You"

        // Generate unique call ID
        callId = firestore.collection("calls").document().id

        // Initiate the call in Firestore
        initiateCall(receiverId, receiverName, currentUserName)

        // Listen for call status changes
        observeCallStatus()

        setContent {
            ChatkuTheme {
                DialingScreen(
                    userName = receiverName,
                    onCancelCall = {
                        cancelCall()
                    }
                )
            }
        }
    }

    private fun initiateCall(receiverId: String, receiverName: String, currentUserName: String) {
        val currentUserId = auth.currentUser?.uid
        if (currentUserId == null) {
            Log.e(TAG, "User not logged in")
            Toast.makeText(this, "Please log in to make a call", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        lifecycleScope.launch {
            try {
                val callData = hashMapOf(
                    "callId" to callId,
                    "callerId" to currentUserId,
                    "receiverId" to receiverId,
                    "callerName" to currentUserName,
                    "receiverName" to receiverName,
                    "status" to CallStatus.RINGING,
                    "type" to "voice",
                    "timestamp" to Timestamp.now(),
                    "duration" to 0
                )

                firestore.collection("calls")
                    .document(callId)
                    .set(callData)
                    .await()

                Log.d(TAG, "Call initiated: $callId")
            } catch (e: Exception) {
                Log.e(TAG, "Error initiating call", e)
                Toast.makeText(this@DialingActivity, "Failed to start call", Toast.LENGTH_SHORT).show()
                finish()
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
                        CallStatus.ACCEPTED -> {
                            Log.d(TAG, "Call accepted by receiver")

                            // Navigate to VoiceCallActivity
                            val intent = VoiceCallActivity.createIntent(
                                context = this,
                                callId = callId,
                                otherUserName = receiverName,
                                otherUserId = receiverId,
                                isCaller = true
                            )
                            startActivity(intent)
                            finish()
                        }
                        CallStatus.DECLINED -> {
                            Log.d(TAG, "Call declined by receiver")
                            Toast.makeText(this, "Call declined", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                        CallStatus.MISSED -> {
                            Log.d(TAG, "Call not answered")
                            Toast.makeText(this, "No answer", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                    }
                }
            }
    }

    private fun cancelCall() {
        lifecycleScope.launch {
            try {
                firestore.collection("calls")
                    .document(callId)
                    .update(
                        mapOf(
                            "status" to CallStatus.CANCELLED,
                            "endedAt" to Timestamp.now()
                        )
                    )
                    .await()

                Log.d(TAG, "Call cancelled: $callId")
            } catch (e: Exception) {
                Log.e(TAG, "Error cancelling call", e)
            }
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        callListener?.remove()
    }
}

@Composable
private fun DialingScreen(
    userName: String,
    onCancelCall: () -> Unit,
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
                        contentDescription = "User Avatar",
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                // User name
                Text(
                    text = userName,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onBackground,
                    textAlign = TextAlign.Center
                )

                // Dialing status with animated dots
                DialingText()
            }

            // Cancel button
            FloatingActionButton(
                onClick = onCancelCall,
                modifier = Modifier.size(64.dp),
                containerColor = Color(0xFFD32F2F), // Red color
                elevation = FloatingActionButtonDefaults.elevation(
                    defaultElevation = 4.dp
                )
            ) {
                Icon(
                    imageVector = Icons.Default.CallEnd,
                    contentDescription = "Cancel Call",
                    modifier = Modifier.size(32.dp),
                    tint = Color.White
                )
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}

@Composable
private fun DialingText() {
    // Animated dots state
    val infiniteTransition = rememberInfiniteTransition(label = "dialing_animation")

    val dotCount by infiniteTransition.animateValue(
        initialValue = 0,
        targetValue = 4,
        typeConverter = Int.VectorConverter,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1000,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "dot_count"
    )

    Row(
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.height(32.dp)
    ) {
        Text(
            text = "Dialing",
            fontSize = 18.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Animated dots
        Text(
            text = ".".repeat(dotCount),
            fontSize = 18.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(40.dp)
        )
    }
}
