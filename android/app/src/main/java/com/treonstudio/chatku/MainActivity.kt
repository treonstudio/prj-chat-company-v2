package com.treonstudio.chatku

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging
import com.treonstudio.chatku.data.repository.UserRepositoryImpl
import com.treonstudio.chatku.domain.usecase.UpdateFcmTokenUseCase
import com.treonstudio.chatku.presentation.navigation.AppNavigation
import com.treonstudio.chatku.ui.theme.ChatkuTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val auth = FirebaseAuth.getInstance()

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d("MainActivity", "Notification permission granted")
            retrieveAndSaveFcmToken()
        } else {
            Log.d("MainActivity", "Notification permission denied")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Request notification permission for Android 13+
        requestNotificationPermission()

        // Retrieve and save FCM token
        retrieveAndSaveFcmToken()

        setContent {
            ChatkuTheme {
                Surface(
                    modifier = Modifier.fillMaxSize()
                ) {
                    AppNavigation()
                }
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED -> {
                    // Permission already granted
                    Log.d("MainActivity", "Notification permission already granted")
                }
                else -> {
                    // Request permission
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }
    }

    private fun retrieveAndSaveFcmToken() {
        val userId = auth.currentUser?.uid
        if (userId == null) {
            Log.d("MainActivity", "User not logged in, skipping FCM token retrieval")
            return
        }

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w("MainActivity", "Fetching FCM token failed", task.exception)
                return@addOnCompleteListener
            }

            // Get the token
            val token = task.result
            Log.d("MainActivity", "FCM Token: $token")

            // Save token to Firestore
            activityScope.launch {
                val firestore = FirebaseFirestore.getInstance()
                val userRepository = UserRepositoryImpl(firestore)
                val updateFcmTokenUseCase = UpdateFcmTokenUseCase(userRepository)

                val result = updateFcmTokenUseCase(userId, token)
                if (result is com.treonstudio.chatku.domain.util.Resource.Success) {
                    Log.d("MainActivity", "FCM token saved successfully")
                } else if (result is com.treonstudio.chatku.domain.util.Resource.Error) {
                    Log.e("MainActivity", "Failed to save FCM token: ${result.message}")
                }
            }
        }
    }
}