package com.treonstudio.chatku.presentation.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.treonstudio.chatku.data.local.PreferencesManager
import com.treonstudio.chatku.data.repository.AuthRepositoryImpl
import com.treonstudio.chatku.domain.usecase.LoginUseCase
import com.treonstudio.chatku.domain.util.Resource
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class LoginViewModel(application: Application) : AndroidViewModel(application) {

    private val preferencesManager = PreferencesManager(application)
    private val authRepository = AuthRepositoryImpl(FirebaseAuth.getInstance(), preferencesManager)
    private val loginUseCase = LoginUseCase(authRepository)

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state.asStateFlow()

    private var onLoginSuccess: (() -> Unit)? = null

    fun setOnLoginSuccess(callback: () -> Unit) {
        onLoginSuccess = callback
    }

    fun onUsernameChange(username: String) {
        _state.update { it.copy(username = username, error = null) }
    }

    fun onPasswordChange(password: String) {
        _state.update { it.copy(password = password, error = null) }
    }

    fun onLoginClick() {
        val currentState = _state.value

        viewModelScope.launch {
            // Set loading state
            _state.update { it.copy(isLoading = true, error = null) }

            // Call login use case
            when (val result = loginUseCase(currentState.username, currentState.password)) {
                is Resource.Success -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            error = null
                        )
                    }
                    // Navigate to main screen on success
                    onLoginSuccess?.invoke()
                }
                is Resource.Error -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            error = result.message ?: "Login failed"
                        )
                    }
                }
                is Resource.Loading -> {
                    // Already in loading state
                }
            }
        }
    }
}
