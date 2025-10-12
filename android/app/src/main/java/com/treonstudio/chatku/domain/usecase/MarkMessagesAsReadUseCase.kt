package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.domain.repository.MessageRepository
import com.treonstudio.chatku.domain.util.Resource

class MarkMessagesAsReadUseCase(
    private val messageRepository: MessageRepository
) {
    suspend operator fun invoke(chatId: String, userId: String, isGroupChat: Boolean = false): Resource<Unit> {
        return messageRepository.markMessagesAsRead(chatId, userId, isGroupChat)
    }
}
