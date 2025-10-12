package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.domain.repository.UserRepository
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.Flow

class GetUsersUseCase(
    private val userRepository: UserRepository
) {
    operator fun invoke(excludeUserId: String? = null): Flow<Resource<List<User>>> {
        return userRepository.getAllUsers(excludeUserId)
    }
}
