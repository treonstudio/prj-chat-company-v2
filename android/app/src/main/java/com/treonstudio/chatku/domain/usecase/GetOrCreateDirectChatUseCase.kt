package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.data.model.DirectChat
import com.treonstudio.chatku.domain.repository.DirectChatRepository
import com.treonstudio.chatku.domain.util.Resource

class GetOrCreateDirectChatUseCase(
    private val directChatRepository: DirectChatRepository
) {
    suspend operator fun invoke(userId1: String, userId2: String): Resource<DirectChat> {
        return directChatRepository.getOrCreateDirectChat(userId1, userId2)
    }
}
