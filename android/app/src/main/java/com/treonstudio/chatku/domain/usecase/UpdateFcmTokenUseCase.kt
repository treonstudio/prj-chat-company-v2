package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.domain.repository.UserRepository
import com.treonstudio.chatku.domain.util.Resource

class UpdateFcmTokenUseCase(
    private val userRepository: UserRepository
) {
    suspend operator fun invoke(userId: String, token: String): Resource<Unit> {
        return userRepository.updateFcmToken(userId, token)
    }
}
