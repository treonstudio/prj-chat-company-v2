package com.treonstudio.chatku.domain.repository

import com.treonstudio.chatku.data.model.DirectChat
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.Flow

interface DirectChatRepository {
    /**
     * Get or create a direct chat between two users
     * @param userId1 First user ID
     * @param userId2 Second user ID
     * @return Flow of Resource containing DirectChat
     */
    suspend fun getOrCreateDirectChat(userId1: String, userId2: String): Resource<DirectChat>

    /**
     * Get a direct chat by ID with real-time updates
     * @param chatId Chat ID
     * @return Flow of Resource containing DirectChat
     */
    fun getDirectChatById(chatId: String): Flow<Resource<DirectChat>>
}
