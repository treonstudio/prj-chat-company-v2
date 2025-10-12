package com.treonstudio.chatku.domain.repository

import com.treonstudio.chatku.data.model.UserChat
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.Flow

interface UserChatRepository {
    fun getUserChats(userId: String): Flow<Resource<UserChat>>
}
