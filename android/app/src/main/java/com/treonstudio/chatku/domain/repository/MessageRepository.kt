package com.treonstudio.chatku.domain.repository

import com.treonstudio.chatku.data.model.Message
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.Flow

interface MessageRepository {
    /**
     * Get messages for a chat with real-time updates
     * @param chatId Chat ID
     * @param isGroupChat Whether this is a group chat
     * @return Flow of Resource containing list of messages
     */
    fun getMessages(chatId: String, isGroupChat: Boolean = false): Flow<Resource<List<Message>>>

    /**
     * Send a message to a chat
     * @param chatId Chat ID
     * @param message Message to send
     * @param isGroupChat Whether this is a group chat
     * @return Resource indicating success or failure
     */
    suspend fun sendMessage(chatId: String, message: Message, isGroupChat: Boolean = false): Resource<Unit>

    /**
     * Mark messages as read
     * @param chatId Chat ID
     * @param userId User ID who read the messages
     * @param isGroupChat Whether this is a group chat
     * @return Resource indicating success or failure
     */
    suspend fun markMessagesAsRead(chatId: String, userId: String, isGroupChat: Boolean = false): Resource<Unit>
}
