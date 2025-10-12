package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.domain.repository.UserRepository
import com.treonstudio.chatku.domain.util.Resource

class GetUserByIdUseCase(
    private val userRepository: UserRepository
) {
    suspend operator fun invoke(userId: String): Resource<User> {
        return userRepository.getUserById(userId)
    }
}
