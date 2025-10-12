package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.data.model.Message
import com.treonstudio.chatku.domain.repository.MessageRepository
import com.treonstudio.chatku.domain.util.Resource

class SendMessageUseCase(
    private val messageRepository: MessageRepository
) {
    suspend operator fun invoke(chatId: String, message: Message, isGroupChat: Boolean = false): Resource<Unit> {
        return messageRepository.sendMessage(chatId, message, isGroupChat)
    }
}
