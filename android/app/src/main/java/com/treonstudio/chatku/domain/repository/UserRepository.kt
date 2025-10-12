package com.treonstudio.chatku.domain.repository

import com.treonstudio.chatku.data.model.User
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.Flow

interface UserRepository {
    fun getAllUsers(excludeUserId: String? = null): Flow<Resource<List<User>>>
    suspend fun getUserById(userId: String): Resource<User>
    suspend fun createOrUpdateUser(user: User): Resource<Unit>
    suspend fun updateFcmToken(userId: String, token: String): Resource<Unit>
}
