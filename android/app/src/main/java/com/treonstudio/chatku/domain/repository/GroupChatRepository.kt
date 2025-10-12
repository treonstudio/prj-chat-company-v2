package com.treonstudio.chatku.domain.repository

import com.treonstudio.chatku.data.model.GroupChat
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.Flow

interface GroupChatRepository {
    /**
     * Get a group chat by ID
     * @param chatId Group chat ID
     * @return GroupChat object
     */
    suspend fun getGroupChatById(chatId: String): GroupChat

    /**
     * Get a group chat by ID with real-time updates
     * @param chatId Group chat ID
     * @return Flow of Resource containing GroupChat
     */
    fun getGroupChatByIdFlow(chatId: String): Flow<Resource<GroupChat>>
}
