package com.treonstudio.chatku.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.treonstudio.chatku.data.model.Message
import com.treonstudio.chatku.domain.repository.MessageRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class MessageRepositoryImpl(
    private val firestore: FirebaseFirestore
) : MessageRepository {

    companion object {
        private const val COLLECTION_DIRECT_CHATS = "directChats"
        private const val COLLECTION_GROUP_CHATS = "groupChats"
        private const val SUBCOLLECTION_MESSAGES = "messages"
    }

    override fun getMessages(chatId: String, isGroupChat: Boolean): Flow<Resource<List<Message>>> = callbackFlow {
        trySend(Resource.Loading())

        val collection = if (isGroupChat) COLLECTION_GROUP_CHATS else COLLECTION_DIRECT_CHATS

        val listener = firestore.collection(collection)
            .document(chatId)
            .collection(SUBCOLLECTION_MESSAGES)
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Resource.Error(error.message ?: "Failed to fetch messages"))
                    return@addSnapshotListener
                }

                val messages = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Message::class.java)
                } ?: emptyList()

                trySend(Resource.Success(messages))
            }

        awaitClose { listener.remove() }
    }

    override suspend fun sendMessage(chatId: String, message: Message, isGroupChat: Boolean): Resource<Unit> {
        return try {
            val collection = if (isGroupChat) COLLECTION_GROUP_CHATS else COLLECTION_DIRECT_CHATS
            val timestamp = Timestamp.now()

            // 1. Add message to messages subcollection
            val messageRef = firestore.collection(collection)
                .document(chatId)
                .collection(SUBCOLLECTION_MESSAGES)
                .document()

            val messageWithId = message.copy(
                messageId = messageRef.id,
                timestamp = timestamp,
                createdAt = timestamp
            )

            messageRef.set(messageWithId).await()

            // 2. Update lastMessage in the chat document
            val chatRef = firestore.collection(collection).document(chatId)
            chatRef.update(
                mapOf(
                    "lastMessage.text" to message.text,
                    "lastMessage.senderId" to message.senderId,
                    "lastMessage.senderName" to message.senderName,
                    "lastMessage.timestamp" to timestamp,
                    "lastMessage.type" to message.type.name, // Keep uppercase to match enum
                    "updatedAt" to timestamp
                )
            ).await()

            // 3. Get chat details to extract participants
            val chatSnapshot = chatRef.get().await()
            val participants = chatSnapshot.get("participants") as? List<*>

            // 4. Update userChats for all participants
            if (participants != null) {
                participants.forEach { participantId ->
                    if (participantId is String) {
                        if (isGroupChat) {
                            // Update userChats for group chat
                            updateUserChatForGroupChat(
                                userId = participantId,
                                chatId = chatId,
                                groupName = chatSnapshot.getString("name") ?: "Group Chat",
                                groupAvatar = chatSnapshot.getString("avatarUrl"),
                                lastMessage = message.text,
                                lastMessageTime = timestamp,
                                senderId = message.senderId
                            )
                        } else {
                            // Update userChats for direct chat
                            updateUserChat(
                                userId = participantId,
                                chatId = chatId,
                                lastMessage = message.text,
                                lastMessageTime = timestamp,
                                senderId = message.senderId,
                                participants = participants.mapNotNull { it as? String }
                            )
                        }
                    }
                }
            }

            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Failed to send message")
        }
    }

    /**
     * Update userChats collection for a specific user
     */
    private suspend fun updateUserChat(
        userId: String,
        chatId: String,
        lastMessage: String,
        lastMessageTime: Timestamp,
        senderId: String,
        participants: List<String>
    ) {
        try {
            println("DEBUG: Updating userChat for userId=$userId, chatId=$chatId, isSender=${senderId == userId}")

            val userChatRef = firestore.collection("userChats").document(userId)
            val userChatSnapshot = userChatRef.get().await()

            println("DEBUG: userChat exists=${userChatSnapshot.exists()}")

            // Get other user ID (the one who is not the current user)
            val otherUserId = participants.firstOrNull { it != userId }
            if (otherUserId == null) {
                println("DEBUG: ERROR - otherUserId is null for userId=$userId")
                return
            }

            println("DEBUG: otherUserId=$otherUserId")

            // Get other user's data
            val otherUserSnapshot = firestore.collection("users").document(otherUserId).get().await()
            if (!otherUserSnapshot.exists()) {
                println("DEBUG: ERROR - Other user document does not exist for otherUserId=$otherUserId")
                return
            }

            val otherUserName = otherUserSnapshot.getString("displayName") ?: "Unknown"
            val otherUserAvatar = otherUserSnapshot.getString("avatarUrl")

            println("DEBUG: otherUserName=$otherUserName, otherUserAvatar=$otherUserAvatar")

            // Determine if this user sent the message (if not, increment unread count)
            val isSender = senderId == userId
            val currentUnreadCount = if (userChatSnapshot.exists()) {
                val chats = userChatSnapshot.get("chats") as? List<*>
                val existingChat = chats?.firstOrNull { chat ->
                    (chat as? Map<*, *>)?.get("chatId") == chatId
                }
                (existingChat as? Map<*, *>)?.get("unreadCount") as? Long ?: 0L
            } else {
                0L
            }

            // Calculate new unread count:
            // - If sender: always 0 (sender doesn't have unread messages)
            // - If receiver: always increment (will be immediately reset by markMessagesAsRead if user is viewing)
            val newUnreadCount = if (isSender) {
                0
            } else {
                (currentUnreadCount + 1).toInt()
            }

            println("DEBUG: isSender=$isSender, currentUnreadCount=$currentUnreadCount, newUnreadCount=$newUnreadCount")

            // Create chat item
            val chatItem = mapOf(
                "chatId" to chatId,
                "chatType" to "DIRECT", // Must be uppercase to match enum
                "otherUserId" to otherUserId,
                "otherUserName" to otherUserName,
                "otherUserAvatar" to otherUserAvatar,
                "lastMessage" to lastMessage,
                "lastMessageTime" to lastMessageTime,
                "unreadCount" to newUnreadCount
            )

            if (userChatSnapshot.exists()) {
                println("DEBUG: Updating existing userChat document")
                // Update existing userChat document
                val existingChats = userChatSnapshot.get("chats") as? List<*> ?: emptyList<Any>()
                val mutableChats = existingChats.toMutableList()

                // Find and update existing chat, or add new one
                val existingChatIndex = mutableChats.indexOfFirst { chat ->
                    (chat as? Map<*, *>)?.get("chatId") == chatId
                }

                if (existingChatIndex != -1) {
                    println("DEBUG: Chat exists at index $existingChatIndex, updating")
                    mutableChats[existingChatIndex] = chatItem
                } else {
                    println("DEBUG: Chat doesn't exist, adding to beginning")
                    mutableChats.add(0, chatItem) // Add to beginning
                }

                userChatRef.update(
                    mapOf(
                        "chats" to mutableChats,
                        "updatedAt" to lastMessageTime
                    )
                ).await()
                println("DEBUG: Successfully updated existing userChat")
            } else {
                println("DEBUG: Creating new userChat document")
                // Create new userChat document
                val newUserChat = mapOf(
                    "userId" to userId,
                    "chats" to listOf(chatItem),
                    "updatedAt" to lastMessageTime
                )
                println("DEBUG: newUserChat data: $newUserChat")

                userChatRef.set(newUserChat).await()
                println("DEBUG: Successfully created new userChat document")
            }
        } catch (e: Exception) {
            // Log error but don't fail the message send
            println("DEBUG: ERROR in updateUserChat - ${e.message}")
            e.printStackTrace()
        }
    }

    /**
     * Update userChats collection for a specific user in a group chat
     */
    private suspend fun updateUserChatForGroupChat(
        userId: String,
        chatId: String,
        groupName: String,
        groupAvatar: String?,
        lastMessage: String,
        lastMessageTime: Timestamp,
        senderId: String
    ) {
        try {
            println("DEBUG: Updating userChat for group - userId=$userId, chatId=$chatId, isSender=${senderId == userId}")

            val userChatRef = firestore.collection("userChats").document(userId)
            val userChatSnapshot = userChatRef.get().await()

            println("DEBUG: userChat exists=${userChatSnapshot.exists()}")

            // Determine if this user sent the message (if not, increment unread count)
            val isSender = senderId == userId
            val currentUnreadCount = if (userChatSnapshot.exists()) {
                val chats = userChatSnapshot.get("chats") as? List<*>
                val existingChat = chats?.firstOrNull { chat ->
                    (chat as? Map<*, *>)?.get("chatId") == chatId
                }
                (existingChat as? Map<*, *>)?.get("unreadCount") as? Long ?: 0L
            } else {
                0L
            }

            // Calculate new unread count:
            // - If sender: always 0 (sender doesn't have unread messages)
            // - If receiver: always increment (will be immediately reset by markMessagesAsRead if user is viewing)
            val newUnreadCount = if (isSender) {
                0
            } else {
                (currentUnreadCount + 1).toInt()
            }

            println("DEBUG: isSender=$isSender, currentUnreadCount=$currentUnreadCount, newUnreadCount=$newUnreadCount")

            // Create chat item for group
            val chatItem = mapOf(
                "chatId" to chatId,
                "chatType" to "GROUP", // Must be uppercase to match enum
                "groupName" to groupName,
                "groupAvatar" to groupAvatar,
                "lastMessage" to lastMessage,
                "lastMessageTime" to lastMessageTime,
                "unreadCount" to newUnreadCount
            )

            if (userChatSnapshot.exists()) {
                println("DEBUG: Updating existing userChat document")
                // Update existing userChat document
                val existingChats = userChatSnapshot.get("chats") as? List<*> ?: emptyList<Any>()
                val mutableChats = existingChats.toMutableList()

                // Find and update existing chat, or add new one
                val existingChatIndex = mutableChats.indexOfFirst { chat ->
                    (chat as? Map<*, *>)?.get("chatId") == chatId
                }

                if (existingChatIndex != -1) {
                    println("DEBUG: Chat exists at index $existingChatIndex, updating")
                    mutableChats[existingChatIndex] = chatItem
                } else {
                    println("DEBUG: Chat doesn't exist, adding to beginning")
                    mutableChats.add(0, chatItem) // Add to beginning
                }

                userChatRef.update(
                    mapOf(
                        "chats" to mutableChats,
                        "updatedAt" to lastMessageTime
                    )
                ).await()
                println("DEBUG: Successfully updated existing userChat")
            } else {
                println("DEBUG: Creating new userChat document")
                // Create new userChat document
                val newUserChat = mapOf(
                    "userId" to userId,
                    "chats" to listOf(chatItem),
                    "updatedAt" to lastMessageTime
                )
                println("DEBUG: newUserChat data: $newUserChat")

                userChatRef.set(newUserChat).await()
                println("DEBUG: Successfully created new userChat document")
            }
        } catch (e: Exception) {
            // Log error but don't fail the message send
            println("DEBUG: ERROR in updateUserChatForGroupChat - ${e.message}")
            e.printStackTrace()
        }
    }

    override suspend fun markMessagesAsRead(chatId: String, userId: String, isGroupChat: Boolean): Resource<Unit> {
        return try {
            val collection = if (isGroupChat) COLLECTION_GROUP_CHATS else COLLECTION_DIRECT_CHATS
            val timestamp = Timestamp.now()

            println("DEBUG: markMessagesAsRead called - chatId=$chatId, userId=$userId")

            // FIRST: Reset unread count in userChats immediately
            // This prevents race condition with incoming messages
            val userChatRef = firestore.collection("userChats").document(userId)
            val userChatSnapshot = userChatRef.get().await()

            if (userChatSnapshot.exists()) {
                val existingChats = userChatSnapshot.get("chats") as? List<*> ?: emptyList<Any>()
                val mutableChats = existingChats.toMutableList()

                // Find and update the chat's unread count
                val chatIndex = mutableChats.indexOfFirst { chat ->
                    (chat as? Map<*, *>)?.get("chatId") == chatId
                }

                if (chatIndex != -1) {
                    val existingChat = mutableChats[chatIndex] as? Map<*, *>
                    val updatedChat = existingChat?.toMutableMap()?.apply {
                        put("unreadCount", 0)
                    }
                    mutableChats[chatIndex] = updatedChat as Any

                    userChatRef.update(
                        mapOf(
                            "chats" to mutableChats,
                            "updatedAt" to timestamp
                        )
                    ).await()
                    println("DEBUG: Reset unreadCount to 0 for chatId=$chatId")
                }
            }

            // SECOND: Get ALL messages in the chat and mark as read
            val messagesSnapshot = firestore.collection(collection)
                .document(chatId)
                .collection(SUBCOLLECTION_MESSAGES)
                .get()
                .await()

            println("DEBUG: Found ${messagesSnapshot.documents.size} total messages")

            // Batch update to mark all as read
            val batch = firestore.batch()
            var updateCount = 0

            messagesSnapshot.documents.forEach { doc ->
                val readByMap = doc.get("readBy") as? Map<*, *> ?: emptyMap<String, Any>()
                val senderId = doc.getString("senderId")

                // Only update if:
                // 1. This user hasn't read it yet
                // 2. This user is NOT the sender (don't mark own messages as read)
                if (!readByMap.containsKey(userId) && senderId != userId) {
                    val messageRef = firestore.collection(collection)
                        .document(chatId)
                        .collection(SUBCOLLECTION_MESSAGES)
                        .document(doc.id)

                    batch.update(messageRef, "readBy.$userId", timestamp)
                    updateCount++
                    println("DEBUG: Marking message ${doc.id} as read for user $userId (sent by $senderId)")
                } else if (senderId == userId) {
                    println("DEBUG: Skipping message ${doc.id} - user is the sender")
                } else {
                    println("DEBUG: Skipping message ${doc.id} - already read by user")
                }
            }

            println("DEBUG: Updating $updateCount messages as read")

            if (updateCount > 0) {
                batch.commit().await()
                println("DEBUG: Batch commit successful")
            } else {
                println("DEBUG: No messages to mark as read")
            }

            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Failed to mark messages as read")
        }
    }
}
