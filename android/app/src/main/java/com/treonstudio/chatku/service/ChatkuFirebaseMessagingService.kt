package com.treonstudio.chatku.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.treonstudio.chatku.MainActivity
import com.treonstudio.chatku.R
import com.treonstudio.chatku.presentation.incoming.IncomingCallActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class ChatkuFirebaseMessagingService : FirebaseMessagingService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val firestore = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    companion object {
        private const val TAG = "ChatkuFCM"
        private const val CHANNEL_ID = "chatku_messages"
        private const val CHANNEL_NAME = "Chat Messages"
        private const val NOTIFICATION_ID = 1

        private const val CALL_CHANNEL_ID = "chatku_calls"
        private const val CALL_CHANNEL_NAME = "Incoming Calls"
        private const val CALL_NOTIFICATION_ID = 2
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token: $token")

        // Save the token to Firestore
        saveTokenToFirestore(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "Message received from: ${message.from}")

        // Check if this is an incoming call notification
        if (message.data["type"] == "incoming_call") {
            handleIncomingCall(message.data)
            return
        }

        // Only show notification if app is in background
        // When app is in foreground, the message will be handled by the chat screen
        if (isAppInBackground()) {
            message.notification?.let {
                showNotification(
                    title = it.title ?: "New Message",
                    body = it.body ?: "",
                    senderId = message.data["senderId"],
                    senderName = message.data["senderName"],
                    chatId = message.data["chatId"]
                )
            }

            // If no notification payload, use data payload
            if (message.notification == null && message.data.isNotEmpty()) {
                showNotification(
                    title = message.data["senderName"] ?: "New Message",
                    body = message.data["messageText"] ?: "",
                    senderId = message.data["senderId"],
                    senderName = message.data["senderName"],
                    chatId = message.data["chatId"]
                )
            }
        }
    }

    private fun handleIncomingCall(data: Map<String, String>) {
        val callId = data["callId"] ?: return
        val callerName = data["callerName"] ?: "Unknown"
        val callerId = data["callerId"] ?: return

        Log.d(TAG, "Incoming call from: $callerName")

        // Create full-screen intent for IncomingCallActivity
        val fullScreenIntent = Intent(this, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId)
            putExtra(IncomingCallActivity.EXTRA_CALLER_NAME, callerName)
            putExtra(IncomingCallActivity.EXTRA_CALLER_ID, callerId)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            CALL_NOTIFICATION_ID,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Create notification channel for calls
        createCallNotificationChannel()

        // Build notification with full-screen intent
        val notification = NotificationCompat.Builder(this, CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Incoming call")
            .setContentText("$callerName is calling...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setAutoCancel(true)
            .setOngoing(true)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(CALL_NOTIFICATION_ID, notification)

        // Also launch the activity directly
        startActivity(fullScreenIntent)
    }

    private fun isAppInBackground(): Boolean {
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val runningProcesses = activityManager.runningAppProcesses

        runningProcesses?.forEach { processInfo ->
            if (processInfo.processName == packageName) {
                return processInfo.importance != android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
            }
        }

        return true
    }

    private fun showNotification(
        title: String,
        body: String,
        senderId: String?,
        senderName: String?,
        chatId: String?
    ) {
        createNotificationChannel()

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            // You can pass data to open specific chat
            putExtra("chatId", chatId)
            putExtra("senderId", senderId)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground) // You should create a proper notification icon
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new chat messages"
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createCallNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CALL_CHANNEL_ID,
                CALL_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming calls"
                setBypassDnd(true)
                enableVibration(true)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun saveTokenToFirestore(token: String) {
        val userId = auth.currentUser?.uid ?: return

        serviceScope.launch {
            try {
                firestore.collection("users")
                    .document(userId)
                    .update("fcmToken", token)
                    .await()

                Log.d(TAG, "FCM token saved successfully for user: $userId")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving FCM token", e)
            }
        }
    }
}
