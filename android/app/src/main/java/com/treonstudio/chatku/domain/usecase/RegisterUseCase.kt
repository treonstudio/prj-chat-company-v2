package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.domain.repository.AuthRepository
import com.treonstudio.chatku.domain.util.Resource

class RegisterUseCase(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(username: String, password: String): Resource<User> {
        // Validate inputs
        if (username.isBlank()) {
            return Resource.Error("Username cannot be empty")
        }

        if (username.length < 3) {
            return Resource.Error("Username must be at least 3 characters")
        }

        if (password.isBlank()) {
            return Resource.Error("Password cannot be empty")
        }

        if (password.length < 6) {
            return Resource.Error("Password must be at least 6 characters")
        }

        // Perform registration
        return authRepository.register(username, password)
    }
}
