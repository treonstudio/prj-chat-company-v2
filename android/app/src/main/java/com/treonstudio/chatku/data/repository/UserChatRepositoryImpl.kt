package com.treonstudio.chatku.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.treonstudio.chatku.data.model.UserChat
import com.treonstudio.chatku.domain.repository.UserChatRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class UserChatRepositoryImpl(
    private val firestore: FirebaseFirestore
) : UserChatRepository {

    companion object {
        private const val COLLECTION_USER_CHATS = "userChats"
    }

    override fun getUserChats(userId: String): Flow<Resource<UserChat>> = callbackFlow {
        trySend(Resource.Loading())

        val listener = firestore.collection(COLLECTION_USER_CHATS)
            .document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Resource.Error(error.message ?: "Failed to fetch user chats"))
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val userChat = snapshot.toObject(UserChat::class.java)
                    if (userChat != null) {
                        // Sort chats by lastMessageTime descending
                        val sortedChats = userChat.copy(
                            chats = userChat.chats.sortedByDescending {
                                it.lastMessageTime?.toDate()?.time ?: 0
                            }
                        )
                        trySend(Resource.Success(sortedChats))
                    } else {
                        trySend(Resource.Error("Failed to parse user chats"))
                    }
                } else {
                    // No chats yet for this user
                    trySend(Resource.Success(UserChat(userId = userId, chats = emptyList())))
                }
            }

        awaitClose { listener.remove() }
    }
}
