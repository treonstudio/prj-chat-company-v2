package com.treonstudio.chatku.domain.repository

import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.domain.util.Resource

interface AuthRepository {
    suspend fun login(username: String, password: String): Resource<User>
    suspend fun register(username: String, password: String): Resource<User>
    suspend fun logout(): Resource<Unit>
    fun getCurrentUser(): User?
    fun isUserLoggedIn(): Boolean
}
