package com.treonstudio.chatku.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.domain.repository.UserRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class UserRepositoryImpl(
    private val firestore: FirebaseFirestore
) : UserRepository {

    companion object {
        private const val COLLECTION_USERS = "users"
    }

    override fun getAllUsers(excludeUserId: String?): Flow<Resource<List<User>>> = callbackFlow {
        trySend(Resource.Loading())

        val listener = firestore.collection(COLLECTION_USERS)
            .orderBy("displayName", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Resource.Error(error.message ?: "Failed to fetch users"))
                    return@addSnapshotListener
                }

                val users = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(User::class.java)
                }?.filter { user ->
                    // Exclude the specified user if provided
                    excludeUserId == null || user.userId != excludeUserId
                } ?: emptyList()

                trySend(Resource.Success(users))
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getUserById(userId: String): Resource<User> {
        return try {
            val document = firestore.collection(COLLECTION_USERS)
                .document(userId)
                .get()
                .await()

            val user = document.toObject(User::class.java)
            if (user != null) {
                Resource.Success(user)
            } else {
                Resource.Error("User not found")
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Failed to fetch user")
        }
    }

    override suspend fun createOrUpdateUser(user: User): Resource<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(user.userId)
                .set(user)
                .await()

            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Failed to create/update user")
        }
    }

    override suspend fun updateFcmToken(userId: String, token: String): Resource<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update("fcmToken", token)
                .await()

            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Failed to update FCM token")
        }
    }
}
