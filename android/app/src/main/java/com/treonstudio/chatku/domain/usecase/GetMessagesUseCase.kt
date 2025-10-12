package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.data.model.Message
import com.treonstudio.chatku.domain.repository.MessageRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.Flow

class GetMessagesUseCase(
    private val messageRepository: MessageRepository
) {
    operator fun invoke(chatId: String, isGroupChat: Boolean = false): Flow<Resource<List<Message>>> {
        return messageRepository.getMessages(chatId, isGroupChat)
    }
}
