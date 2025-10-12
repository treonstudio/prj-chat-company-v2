package com.treonstudio.chatku.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.treonstudio.chatku.data.model.GroupChat
import com.treonstudio.chatku.domain.repository.GroupChatRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class GroupChatRepositoryImpl(
    private val firestore: FirebaseFirestore
) : GroupChatRepository {

    companion object {
        private const val COLLECTION_GROUP_CHATS = "groupChats"
    }

    override suspend fun getGroupChatById(chatId: String): GroupChat {
        val snapshot = firestore.collection(COLLECTION_GROUP_CHATS)
            .document(chatId)
            .get()
            .await()

        return snapshot.toObject(GroupChat::class.java)
            ?: throw Exception("Group chat not found")
    }

    override fun getGroupChatByIdFlow(chatId: String): Flow<Resource<GroupChat>> = callbackFlow {
        trySend(Resource.Loading())

        val listener = firestore.collection(COLLECTION_GROUP_CHATS)
            .document(chatId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Resource.Error(error.message ?: "Failed to fetch group chat"))
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val groupChat = snapshot.toObject(GroupChat::class.java)
                    if (groupChat != null) {
                        trySend(Resource.Success(groupChat))
                    } else {
                        trySend(Resource.Error("Failed to parse group chat data"))
                    }
                } else {
                    trySend(Resource.Error("Group chat not found"))
                }
            }

        awaitClose { listener.remove() }
    }
}
