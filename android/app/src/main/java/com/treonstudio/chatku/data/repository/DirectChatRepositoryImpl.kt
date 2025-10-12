package com.treonstudio.chatku.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.treonstudio.chatku.data.model.DirectChat
import com.treonstudio.chatku.domain.repository.DirectChatRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class DirectChatRepositoryImpl(
    private val firestore: FirebaseFirestore
) : DirectChatRepository {

    companion object {
        private const val COLLECTION_DIRECT_CHATS = "directChats"

        /**
         * Create composite key for direct chat: [smaller_userId]_[larger_userId]
         */
        private fun createChatId(userId1: String, userId2: String): String {
            return if (userId1 < userId2) {
                "${userId1}_${userId2}"
            } else {
                "${userId2}_${userId1}"
            }
        }
    }

    override suspend fun getOrCreateDirectChat(userId1: String, userId2: String): Resource<DirectChat> {
        return try {
            val chatId = createChatId(userId1, userId2)
            val chatRef = firestore.collection(COLLECTION_DIRECT_CHATS).document(chatId)

            // Check if chat exists
            val snapshot = chatRef.get().await()

            if (snapshot.exists()) {
                // Chat exists, return it
                val chat = snapshot.toObject(DirectChat::class.java)
                if (chat != null) {
                    Resource.Success(chat)
                } else {
                    Resource.Error("Failed to parse chat data")
                }
            } else {
                // Chat doesn't exist, create it
                val newChat = DirectChat(
                    chatId = chatId,
                    participants = listOf(userId1, userId2),
                    participantsMap = mapOf(
                        userId1 to true,
                        userId2 to true
                    ),
                    createdAt = Timestamp.now(),
                    updatedAt = Timestamp.now()
                )

                chatRef.set(newChat).await()
                Resource.Success(newChat)
            }
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Failed to get or create chat")
        }
    }

    override fun getDirectChatById(chatId: String): Flow<Resource<DirectChat>> = callbackFlow {
        trySend(Resource.Loading())

        val listener = firestore.collection(COLLECTION_DIRECT_CHATS)
            .document(chatId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Resource.Error(error.message ?: "Failed to fetch chat"))
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val chat = snapshot.toObject(DirectChat::class.java)
                    if (chat != null) {
                        trySend(Resource.Success(chat))
                    } else {
                        trySend(Resource.Error("Failed to parse chat data"))
                    }
                } else {
                    trySend(Resource.Error("Chat not found"))
                }
            }

        awaitClose { listener.remove() }
    }
}
