package com.treonstudio.chatku.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.google.firebase.auth.FirebaseAuth
import com.treonstudio.chatku.data.local.PreferencesManager
import com.treonstudio.chatku.data.repository.AuthRepositoryImpl
import com.treonstudio.chatku.domain.usecase.CheckSessionUseCase
import com.treonstudio.chatku.presentation.MainScreen
import com.treonstudio.chatku.presentation.auth.LoginScreen

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Main : Screen("main")
}

@Composable
fun AppNavigation() {
    val context = LocalContext.current
    val navController = rememberNavController()

    // Check session on startup
    var startDestination by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val preferencesManager = PreferencesManager(context)
        val authRepository = AuthRepositoryImpl(FirebaseAuth.getInstance(), preferencesManager)
        val checkSessionUseCase = CheckSessionUseCase(authRepository)

        // Determine start destination based on session
        startDestination = if (checkSessionUseCase()) {
            Screen.Main.route
        } else {
            Screen.Login.route
        }
    }

    // Wait for session check to complete
    if (startDestination == null) {
        // Show loading or splash screen while checking session
        return
    }

    NavHost(
        navController = navController,
        startDestination = startDestination!!
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Main.route) {
                        // Clear the login screen from the back stack
                        popUpTo(Screen.Login.route) {
                            inclusive = true
                        }
                        // Avoid multiple copies of the same destination
                        launchSingleTop = true
                    }
                }
            )
        }

        composable(Screen.Main.route) {
            MainScreen()
        }
    }
}
