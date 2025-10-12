package com.treonstudio.chatku.presentation.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Route(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    object Chats : Route(
        route = "chats",
        title = "Chats",
        icon = Icons.Default.ChatBubble
    )

    object Calls : Route(
        route = "calls",
        title = "Calls",
        icon = Icons.Default.Call
    )

    object Settings : Route(
        route = "settings",
        title = "Settings",
        icon = Icons.Default.Settings
    )

    object Profile : Route(
        route = "profile",
        title = "Profile",
        icon = Icons.Default.Person
    )
}

val bottomNavItems = listOf(
    Route.Chats,
    Route.Calls,
    Route.Settings,
    Route.Profile
)
