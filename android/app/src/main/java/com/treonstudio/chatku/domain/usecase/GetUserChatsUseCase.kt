package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.data.model.UserChat
import com.treonstudio.chatku.domain.repository.UserChatRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.Flow

class GetUserChatsUseCase(
    private val userChatRepository: UserChatRepository
) {
    operator fun invoke(userId: String): Flow<Resource<UserChat>> {
        return userChatRepository.getUserChats(userId)
    }
}
