package com.treonstudio.chatku.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.treonstudio.chatku.data.local.PreferencesManager
import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.domain.repository.AuthRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.tasks.await

class AuthRepositoryImpl(
    private val firebaseAuth: FirebaseAuth,
    private val preferencesManager: PreferencesManager
) : AuthRepository {

    companion object {
        private const val EMAIL_DOMAIN = "@chatapp.com"
    }

    /**
     * Converts username to email format by appending @chatapp.com
     */
    private fun usernameToEmail(username: String): String {
        return "$username$EMAIL_DOMAIN"
    }

    /**
     * Converts email back to username by removing @chatapp.com
     */
    private fun emailToUsername(email: String): String {
        return email.removeSuffix(EMAIL_DOMAIN)
    }

    /**
     * Converts FirebaseUser to our User model
     */
    private fun FirebaseUser.toUser(): User {
        return User(
            userId = this.uid,
            displayName = this.email?.let { emailToUsername(it) } ?: "",
            email = this.email ?: ""
        )
    }

    override suspend fun login(username: String, password: String): Resource<User> {
        return try {
            val email = usernameToEmail(username)
            val result = firebaseAuth.signInWithEmailAndPassword(email, password).await()

            val user = result.user?.toUser()
            if (user != null) {
                // Save session to local storage
                preferencesManager.saveUserSession(
                    userId = user.userId,
                    username = user.displayName,
                    email = user.email
                )
                Resource.Success(user)
            } else {
                Resource.Error("Login failed: User not found")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Login failed")
        }
    }

    override suspend fun register(username: String, password: String): Resource<User> {
        return try {
            val email = usernameToEmail(username)
            val result = firebaseAuth.createUserWithEmailAndPassword(email, password).await()

            val user = result.user?.toUser()
            if (user != null) {
                // Save session to local storage
                preferencesManager.saveUserSession(
                    userId = user.userId,
                    username = user.displayName,
                    email = user.email
                )
                Resource.Success(user)
            } else {
                Resource.Error("Registration failed: User not created")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Registration failed")
        }
    }

    override suspend fun logout(): Resource<Unit> {
        return try {
            firebaseAuth.signOut()
            // Clear session from local storage
            preferencesManager.clearUserSession()
            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Logout failed")
        }
    }

    override fun getCurrentUser(): User? {
        // First check local storage
        val userId = preferencesManager.getUserId()
        val username = preferencesManager.getUsername()
        val email = preferencesManager.getEmail()

        return if (userId != null && username != null && email != null) {
            User(userId = userId, displayName = username, email = email)
        } else {
            // Fallback to Firebase Auth
            firebaseAuth.currentUser?.toUser()
        }
    }

    override fun isUserLoggedIn(): Boolean {
        // Check both local storage and Firebase Auth
        return preferencesManager.isLoggedIn() && firebaseAuth.currentUser != null
    }
}
