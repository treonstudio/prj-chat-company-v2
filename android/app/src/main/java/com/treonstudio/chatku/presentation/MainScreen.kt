package com.treonstudio.chatku.presentation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.google.firebase.auth.FirebaseAuth
import com.treonstudio.chatku.data.local.PreferencesManager
import com.treonstudio.chatku.data.repository.AuthRepositoryImpl
import com.treonstudio.chatku.presentation.callhistory.CallHistoryScreen
import com.treonstudio.chatku.data.model.ChatType
import com.treonstudio.chatku.presentation.chatdetail.ChatDetailActivity
import com.treonstudio.chatku.presentation.chatlist.ChatListScreen
import com.treonstudio.chatku.presentation.contactlist.ContactListScreen
import com.treonstudio.chatku.presentation.creategroup.CreateGroupActivity
import com.treonstudio.chatku.presentation.groupchatdetail.GroupChatDetailActivity
import com.treonstudio.chatku.presentation.navigation.Route
import com.treonstudio.chatku.presentation.navigation.bottomNavItems
import com.treonstudio.chatku.presentation.profile.ProfileScreen
import com.treonstudio.chatku.presentation.settings.SettingsScreen

@Composable
fun MainScreen() {
    val context = LocalContext.current
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Get current user ID
    val currentUserId = remember {
        val preferencesManager = PreferencesManager(context)
        val authRepository = AuthRepositoryImpl(FirebaseAuth.getInstance(), preferencesManager)
        authRepository.getCurrentUser()?.userId ?: ""
    }

    // Hide bottom bar on certain screens
    val shouldShowBottomBar = currentRoute in bottomNavItems.map { it.route }

    Scaffold(
        bottomBar = {
            if (shouldShowBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = item.icon,
                                    contentDescription = item.title
                                )
                            },
                            label = { Text(item.title) },
                            selected = currentRoute == item.route,
                            onClick = {
                                if (currentRoute != item.route) {
                                    navController.navigate(item.route) {
                                        // Pop up to the start destination
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        // Avoid multiple copies of the same destination
                                        launchSingleTop = true
                                        // Restore state when reselecting a previously selected item
                                        restoreState = true
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = Route.Chats.route,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable(Route.Chats.route) {
                ChatListScreen(
                    onNavigateToContactList = {
                        navController.navigate("contact_list")
                    },
                    onNavigateToCreateGroup = {
                        val intent = CreateGroupActivity.createIntent(context)
                        context.startActivity(intent)
                    },
                    onChatClick = { chatId, chatType, otherUserId ->
                        val intent = when (chatType) {
                            ChatType.DIRECT -> ChatDetailActivity.createIntent(
                                context = context,
                                otherUserId = otherUserId,
                                currentUserId = currentUserId
                            )
                            ChatType.GROUP -> GroupChatDetailActivity.createIntent(
                                context = context,
                                groupChatId = chatId,
                                currentUserId = currentUserId
                            )
                        }
                        context.startActivity(intent)
                    }
                )
            }
            composable(Route.Calls.route) {
                CallHistoryScreen()
            }
            composable(Route.Settings.route) {
                SettingsScreen()
            }
            composable(Route.Profile.route) {
                ProfileScreen()
            }
            composable("contact_list") {
                ContactListScreen(
                    onNavigateBack = {
                        navController.popBackStack()
                    },
                    onContactClick = { userId ->
                        val intent = ChatDetailActivity.createIntent(
                            context = context,
                            otherUserId = userId,
                            currentUserId = currentUserId
                        )
                        context.startActivity(intent)
                    }
                )
            }
        }
    }
}
