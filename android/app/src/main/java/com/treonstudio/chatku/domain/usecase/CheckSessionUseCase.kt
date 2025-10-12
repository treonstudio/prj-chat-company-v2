package com.treonstudio.chatku.domain.usecase

import com.treonstudio.chatku.domain.repository.AuthRepository

class CheckSessionUseCase(
    private val authRepository: AuthRepository
) {
    operator fun invoke(): Boolean {
        return authRepository.isUserLoggedIn()
    }
}
