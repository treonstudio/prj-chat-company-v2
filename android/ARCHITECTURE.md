# Android Chat Application - Project Structure & Architecture Documentation

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Architecture Pattern](#architecture-pattern)
- [Complete Project Structure](#complete-project-structure)
- [Layer Descriptions](#layer-descriptions)
- [Feature Implementation Guide](#feature-implementation-guide)
- [Dependency Injection Setup](#dependency-injection-setup)
- [Code Standards & Conventions](#code-standards--conventions)

---

## 🎯 Project Overview

**Project Type**: Android Native Chat Application  
**Language**: Kotlin  
**UI Framework**: Jetpack Compose  
**Architecture**: Clean Architecture with MVVM Pattern  
**Target SDK**: Android 14 (API 34)  
**Minimum SDK**: Android 7.0 (API 24)

### Application Features
1. **Authentication System**: User login and registration using Firebase Authentication
2. **Chat List Screen**: Display list of active conversations with real-time updates
3. **Contact Search**: Search and find users to start new conversations
4. **Chat Room**: Send and receive messages in real-time
5. **Audio Calling**: Voice call functionality using Agora.io SDK
6. **Call History**: View history of all incoming/outgoing calls
7. **User Profile**: View and edit user profile information

---

## 🛠 Technology Stack

### Core Technologies
```
Language: Kotlin 1.9+
UI Framework: Jetpack Compose
Build System: Gradle with Kotlin DSL
Min SDK: 24 (Android 7.0)
Target SDK: 34 (Android 14)
```

### Key Libraries & Services

| Category | Library/Service | Purpose |
|----------|----------------|---------|
| **UI** | Jetpack Compose | Modern declarative UI framework |
| **Architecture** | MVVM + Clean Architecture | Separation of concerns and testability |
| **Dependency Injection** | Hilt (Dagger) | Automatic dependency management |
| **Backend Database** | Cloud Firestore | Real-time NoSQL cloud database |
| **Authentication** | Firebase Authentication | User authentication and session management |
| **Real-time Communication** | Agora.io SDK | Audio/video calling functionality |
| **Async Operations** | Kotlin Coroutines | Asynchronous programming |
| **Reactive Streams** | Kotlin Flow | Reactive data streams |
| **Navigation** | Compose Navigation | In-app navigation |
| **Image Loading** | Coil | Image loading and caching |

---

## 🏛 Architecture Pattern

This project implements **Clean Architecture** with three distinct layers:

```
┌─────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                     │
│  (UI Components, ViewModels, Compose Screens, States)   │
│                                                          │
│  - Handles user interactions                            │
│  - Displays data to users                               │
│  - Manages UI state                                     │
└─────────────────────┬───────────────────────────────────┘
                      │ Depends on
                      ▼
┌─────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                         │
│        (Use Cases, Business Logic, Entities)            │
│                                                          │
│  - Contains business rules                              │
│  - Independent of frameworks                            │
│  - Defines repository interfaces                        │
└─────────────────────┬───────────────────────────────────┘
                      │ Depends on
                      ▼
┌─────────────────────────────────────────────────────────┐
│                      DATA LAYER                          │
│  (Repositories, Data Sources, Models, API Services)     │
│                                                          │
│  - Implements repository interfaces                     │
│  - Communicates with Firebase & Agora                   │
│  - Handles data transformation                          │
└─────────────────────────────────────────────────────────┘
```

**Key Principles**:
- **Dependency Rule**: Inner layers don't know about outer layers
- **Separation of Concerns**: Each layer has a single responsibility
- **Testability**: Each layer can be tested independently
- **Flexibility**: Easy to change data sources or UI frameworks

---

## 📁 Complete Project Structure

```
app/
├── src/
│   ├── main/
│   │   ├── java/com/yourapp/
│   │   │   │
│   │   │   ├── ChatApplication.kt          # Application class with Hilt setup
│   │   │   │
│   │   │   ├── di/                         # DEPENDENCY INJECTION MODULE
│   │   │   │   ├── AppModule.kt            # Provides application-level dependencies
│   │   │   │   ├── FirebaseModule.kt       # Provides Firebase instances (Auth, Firestore)
│   │   │   │   ├── AgoraModule.kt          # Provides Agora RTC Engine instance
│   │   │   │   └── RepositoryModule.kt     # Binds repository implementations
│   │   │   │
│   │   │   ├── data/                       # DATA LAYER
│   │   │   │   │
│   │   │   │   ├── model/                  # Data Transfer Objects (DTOs)
│   │   │   │   │   ├── User.kt             # User entity model
│   │   │   │   │   ├── Chat.kt             # Chat conversation model
│   │   │   │   │   ├── Message.kt          # Message model with timestamp
│   │   │   │   │   └── CallHistory.kt      # Call record model
│   │   │   │   │
│   │   │   │   ├── repository/             # Repository Pattern Implementation
│   │   │   │   │   ├── AuthRepository.kt           # Interface for authentication
│   │   │   │   │   ├── AuthRepositoryImpl.kt       # Firebase Auth implementation
│   │   │   │   │   ├── ChatRepository.kt           # Interface for chat operations
│   │   │   │   │   ├── ChatRepositoryImpl.kt       # Firestore chat implementation
│   │   │   │   │   ├── UserRepository.kt           # Interface for user operations
│   │   │   │   │   ├── UserRepositoryImpl.kt       # Firestore user implementation
│   │   │   │   │   ├── CallRepository.kt           # Interface for call operations
│   │   │   │   │   └── CallRepositoryImpl.kt       # Agora + Firestore implementation
│   │   │   │   │
│   │   │   │   ├── remote/                 # Remote Data Sources
│   │   │   │   │   ├── FirebaseAuthService.kt      # Firebase Auth API wrapper
│   │   │   │   │   ├── FirestoreService.kt         # Firestore CRUD operations
│   │   │   │   │   └── AgoraService.kt             # Agora SDK integration
│   │   │   │   │
│   │   │   │   └── local/                  # Local Data Storage
│   │   │   │       └── PreferencesManager.kt       # SharedPreferences wrapper
│   │   │   │
│   │   │   ├── domain/                     # DOMAIN LAYER (Business Logic)
│   │   │   │   │
│   │   │   │   ├── usecase/                # Use Cases (Business Operations)
│   │   │   │   │   │
│   │   │   │   │   ├── auth/               # Authentication Use Cases
│   │   │   │   │   │   ├── LoginUseCase.kt         # Handle user login
│   │   │   │   │   │   ├── LogoutUseCase.kt        # Handle user logout
│   │   │   │   │   │   └── RegisterUseCase.kt      # Handle user registration
│   │   │   │   │   │
│   │   │   │   │   ├── chat/               # Chat Use Cases
│   │   │   │   │   │   ├── GetChatsUseCase.kt      # Fetch all user chats
│   │   │   │   │   │   ├── SendMessageUseCase.kt   # Send a message
│   │   │   │   │   │   └── GetMessagesUseCase.kt   # Fetch chat messages
│   │   │   │   │   │
│   │   │   │   │   ├── user/               # User Management Use Cases
│   │   │   │   │   │   ├── SearchUsersUseCase.kt   # Search users by name/email
│   │   │   │   │   │   └── GetUserProfileUseCase.kt # Get user details
│   │   │   │   │   │
│   │   │   │   │   └── call/               # Calling Use Cases
│   │   │   │   │       ├── InitiateCallUseCase.kt  # Start an audio call
│   │   │   │   │       ├── GetCallHistoryUseCase.kt # Fetch call history
│   │   │   │   │       └── EndCallUseCase.kt       # End an active call
│   │   │   │   │
│   │   │   │   └── util/                   # Domain Utilities
│   │   │   │       └── Resource.kt         # Result wrapper (Success/Error/Loading)
│   │   │   │
│   │   │   ├── presentation/               # PRESENTATION LAYER (UI)
│   │   │   │   │
│   │   │   │   ├── navigation/             # Navigation Configuration
│   │   │   │   │   ├── NavGraph.kt         # Main navigation graph definition
│   │   │   │   │   ├── Route.kt            # Sealed class for navigation routes
│   │   │   │   │   └── NavigationExt.kt    # Navigation helper functions
│   │   │   │   │
│   │   │   │   ├── theme/                  # Compose Theme Configuration
│   │   │   │   │   ├── Color.kt            # Color palette definition
│   │   │   │   │   ├── Theme.kt            # Material3 theme setup
│   │   │   │   │   └── Type.kt             # Typography definitions
│   │   │   │   │
│   │   │   │   ├── components/             # Reusable UI Components
│   │   │   │   │   ├── CustomTextField.kt  # Styled text input field
│   │   │   │   │   ├── ChatItem.kt         # Chat list item component
│   │   │   │   │   ├── MessageBubble.kt    # Chat message bubble
│   │   │   │   │   └── LoadingDialog.kt    # Loading indicator dialog
│   │   │   │   │
│   │   │   │   ├── auth/                   # Authentication Feature
│   │   │   │   │   ├── LoginScreen.kt      # Login UI (Composable)
│   │   │   │   │   ├── LoginViewModel.kt   # Login business logic & state
│   │   │   │   │   ├── RegisterScreen.kt   # Registration UI (Composable)
│   │   │   │   │   └── RegisterViewModel.kt # Registration logic & state
│   │   │   │   │
│   │   │   │   ├── chatlist/               # Chat List Feature
│   │   │   │   │   ├── ChatListScreen.kt   # Chat list UI (Composable)
│   │   │   │   │   ├── ChatListViewModel.kt # Chat list logic & state management
│   │   │   │   │   └── ChatListState.kt    # UI state data class
│   │   │   │   │
│   │   │   │   ├── search/                 # Contact Search Feature
│   │   │   │   │   ├── SearchScreen.kt     # Search UI (Composable)
│   │   │   │   │   ├── SearchViewModel.kt  # Search logic & state
│   │   │   │   │   └── SearchState.kt      # Search UI state
│   │   │   │   │
│   │   │   │   ├── chatroom/               # Chat Room Feature
│   │   │   │   │   ├── ChatRoomScreen.kt   # Chat room UI (Composable)
│   │   │   │   │   ├── ChatRoomViewModel.kt # Chat logic & message handling
│   │   │   │   │   └── ChatRoomState.kt    # Chat room UI state
│   │   │   │   │
│   │   │   │   ├── callhistory/            # Call History Feature
│   │   │   │   │   ├── CallHistoryScreen.kt # Call history UI (Composable)
│   │   │   │   │   ├── CallHistoryViewModel.kt # History logic & state
│   │   │   │   │   └── CallHistoryState.kt # Call history UI state
│   │   │   │   │
│   │   │   │   ├── profile/                # User Profile Feature
│   │   │   │   │   ├── ProfileScreen.kt    # Profile UI (Composable)
│   │   │   │   │   ├── ProfileViewModel.kt # Profile logic & state
│   │   │   │   │   └── ProfileState.kt     # Profile UI state
│   │   │   │   │
│   │   │   │   └── MainActivity.kt         # Main entry point activity
│   │   │   │
│   │   │   └── util/                       # Application Utilities
│   │   │       ├── Constants.kt            # App-wide constants
│   │   │       ├── Extensions.kt           # Kotlin extension functions
│   │   │       └── DateFormatter.kt        # Date/time formatting utilities
│   │   │
│   │   └── res/                            # Android Resources
│   │       ├── drawable/                   # Images and icons
│   │       ├── values/
│   │       │   ├── strings.xml             # String resources
│   │       │   └── themes.xml              # XML theme definitions
│   │       └── xml/
│   │           └── network_security_config.xml # Network security settings
│   │
│   └── build.gradle.kts                    # App-level build configuration
│
└── build.gradle.kts                        # Project-level build configuration
```

---

## 📚 Layer Descriptions

### 1. Data Layer (`data/`)

**Purpose**: Handles all data operations and external communications

#### Components:

**a) Models (`data/model/`)**
- Data classes representing entities in the application
- Match the structure of Firestore documents
- Should be serializable for network transmission

**Example Structure**:
```kotlin
// User.kt - Represents a user in the system
data class User(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val photoUrl: String? = null,
    val isOnline: Boolean = false,
    val lastSeen: Long = 0L
)

// Message.kt - Represents a chat message
data class Message(
    val id: String = "",
    val chatId: String = "",
    val senderId: String = "",
    val content: String = "",
    val timestamp: Long = 0L,
    val isRead: Boolean = false,
    val type: MessageType = MessageType.TEXT
)

// Chat.kt - Represents a conversation
data class Chat(
    val id: String = "",
    val participants: List<String> = emptyList(),
    val lastMessage: String = "",
    val lastMessageTime: Long = 0L,
    val unreadCount: Int = 0
)

// CallHistory.kt - Represents a call record
data class CallHistory(
    val id: String = "",
    val callerId: String = "",
    val receiverId: String = "",
    val duration: Long = 0L,
    val timestamp: Long = 0L,
    val type: CallType = CallType.OUTGOING,
    val status: CallStatus = CallStatus.COMPLETED
)
```

**b) Repository (`data/repository/`)**
- Implements repository interfaces defined in domain layer
- Single source of truth for data
- Handles data transformation and caching
- Each repository focuses on one domain entity

**Pattern**:
```
1. Define interface in domain layer
2. Implement interface in data layer
3. Use dependency injection to provide implementation
```

**Example**:
```kotlin
// Domain layer defines the contract
interface ChatRepository {
    fun getChats(userId: String): Flow<Resource<List<Chat>>>
    suspend fun sendMessage(chatId: String, message: Message): Resource<Unit>
    fun getMessages(chatId: String): Flow<Resource<List<Message>>>
}

// Data layer implements the contract
class ChatRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val firestoreService: FirestoreService
) : ChatRepository {
    
    override fun getChats(userId: String): Flow<Resource<List<Chat>>> = callbackFlow {
        trySend(Resource.Loading())
        
        val listener = firestore.collection("chats")
            .whereArrayContains("participants", userId)
            .orderBy("lastMessageTime", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Resource.Error(error.message ?: "Unknown error"))
                    return@addSnapshotListener
                }
                
                val chats = snapshot?.toObjects(Chat::class.java) ?: emptyList()
                trySend(Resource.Success(chats))
            }
        
        awaitClose { listener.remove() }
    }
    
    override suspend fun sendMessage(
        chatId: String, 
        message: Message
    ): Resource<Unit> {
        return try {
            firestore.collection("chats")
                .document(chatId)
                .collection("messages")
                .add(message)
                .await()
            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Error(e.message ?: "Failed to send message")
        }
    }
}
```

**c) Remote Data Sources (`data/remote/`)**
- Direct communication with external services
- Wrapper classes for Firebase and Agora SDKs
- Handle API-specific error handling

**Services**:
- `FirebaseAuthService`: User authentication operations
- `FirestoreService`: Database CRUD operations
- `AgoraService`: Real-time communication setup

**d) Local Data Storage (`data/local/`)**
- SharedPreferences for simple key-value storage
- Cache user session and app preferences

---

### 2. Domain Layer (`domain/`)

**Purpose**: Contains business logic and rules, independent of frameworks

#### Components:

**a) Use Cases (`domain/usecase/`)**
- Each use case represents one business operation
- Single Responsibility Principle: One use case = One action
- Reusable across different features
- Easy to test without UI or database

**Structure Pattern**:
```kotlin
class SomeUseCase @Inject constructor(
    private val repository: SomeRepository
) {
    suspend operator fun invoke(params: SomeParams): Resource<SomeResult> {
        // Business logic here
        return repository.someOperation(params)
    }
}
```

**Example Use Cases**:

```kotlin
// LoginUseCase.kt - Handles user login
class LoginUseCase @Inject constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(email: String, password: String): Resource<User> {
        // Validate inputs
        if (email.isBlank() || password.isBlank()) {
            return Resource.Error("Email and password cannot be empty")
        }
        
        if (!email.contains("@")) {
            return Resource.Error("Invalid email format")
        }
        
        // Perform login
        return authRepository.login(email, password)
    }
}

// SendMessageUseCase.kt - Handles sending a message
class SendMessageUseCase @Inject constructor(
    private val chatRepository: ChatRepository
) {
    suspend operator fun invoke(chatId: String, content: String): Resource<Unit> {
        // Validate message
        if (content.isBlank()) {
            return Resource.Error("Message cannot be empty")
        }
        
        // Create message object
        val message = Message(
            id = UUID.randomUUID().toString(),
            chatId = chatId,
            content = content.trim(),
            timestamp = System.currentTimeMillis(),
            senderId = getCurrentUserId() // Get from auth
        )
        
        return chatRepository.sendMessage(chatId, message)
    }
}

// SearchUsersUseCase.kt - Search users with debounce
class SearchUsersUseCase @Inject constructor(
    private val userRepository: UserRepository
) {
    operator fun invoke(query: String): Flow<Resource<List<User>>> = flow {
        emit(Resource.Loading())
        
        // Don't search if query is too short
        if (query.length < 2) {
            emit(Resource.Success(emptyList()))
            return@flow
        }
        
        // Add delay for debouncing
        delay(300)
        
        userRepository.searchUsers(query).collect { result ->
            emit(result)
        }
    }
}
```

**b) Utilities (`domain/util/`)**
- Helper classes for domain layer
- Resource wrapper for handling operation results

```kotlin
// Resource.kt - Wrapper for operation results
sealed class Resource<T>(
    val data: T? = null,
    val message: String? = null
) {
    class Success<T>(data: T) : Resource<T>(data)
    class Error<T>(message: String, data: T? = null) : Resource<T>(data, message)
    class Loading<T> : Resource<T>()
}

// Usage in UI:
when (val result = someUseCase()) {
    is Resource.Loading -> showLoading()
    is Resource.Success -> showData(result.data)
    is Resource.Error -> showError(result.message)
}
```

---

### 3. Presentation Layer (`presentation/`)

**Purpose**: Handles UI and user interactions

#### Components:

**a) Screens (Composable Functions)**
- Define the UI using Jetpack Compose
- Stateless when possible (state hoisting)
- Collect state from ViewModels
- Emit user events to ViewModels

**Screen Structure Pattern**:
```kotlin
@Composable
fun SomeScreen(
    viewModel: SomeViewModel = hiltViewModel(),
    onNavigate: (Route) -> Unit
) {
    // Collect state
    val state by viewModel.state.collectAsState()
    
    // UI based on state
    when {
        state.isLoading -> LoadingIndicator()
        state.error != null -> ErrorMessage(state.error)
        else -> ContentUI(
            data = state.data,
            onAction = { viewModel.onEvent(SomeEvent.Action) }
        )
    }
}
```

**b) ViewModels**
- Manages UI state using StateFlow
- Handles business logic for presentation
- Communicates with use cases
- Survives configuration changes

**ViewModel Pattern**:
```kotlin
@HiltViewModel
class SomeViewModel @Inject constructor(
    private val someUseCase: SomeUseCase
) : ViewModel() {
    
    // Private mutable state
    private val _state = MutableStateFlow(SomeState())
    
    // Public immutable state for UI
    val state: StateFlow<SomeState> = _state.asStateFlow()
    
    // Handle UI events
    fun onEvent(event: SomeEvent) {
        when (event) {
            is SomeEvent.LoadData -> loadData()
            is SomeEvent.Action -> performAction(event.param)
        }
    }
    
    private fun loadData() {
        viewModelScope.launch {
            someUseCase().collect { resource ->
                when (resource) {
                    is Resource.Loading -> {
                        _state.update { it.copy(isLoading = true) }
                    }
                    is Resource.Success -> {
                        _state.update { 
                            it.copy(
                                data = resource.data,
                                isLoading = false,
                                error = null
                            )
                        }
                    }
                    is Resource.Error -> {
                        _state.update { 
                            it.copy(
                                error = resource.message,
                                isLoading = false
                            )
                        }
                    }
                }
            }
        }
    }
}
```

**c) State Classes**
- Data classes representing UI state
- Single source of truth for UI
- Immutable to prevent unintended changes

```kotlin
data class ChatListState(
    val chats: List<Chat> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val currentUser: User? = null
)

data class ChatRoomState(
    val messages: List<Message> = emptyList(),
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val error: String? = null,
    val otherUser: User? = null
)
```

**d) Navigation**
- Centralized navigation configuration
- Type-safe routes using sealed classes

```kotlin
// Route.kt
sealed class Route(val route: String) {
    object Login : Route("login")
    object ChatList : Route("chat_list")
    object Search : Route("search")
    data class ChatRoom(val chatId: String) : Route("chat_room/{chatId}") {
        fun createRoute(chatId: String) = "chat_room/$chatId"
    }
    object CallHistory : Route("call_history")
    object Profile : Route("profile")
}

// NavGraph.kt
@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    
    NavHost(
        navController = navController,
        startDestination = Route.Login.route
    ) {
        composable(Route.Login.route) {
            LoginScreen(
                onNavigateToHome = {
                    navController.navigate(Route.ChatList.route) {
                        popUpTo(Route.Login.route) { inclusive = true }
                    }
                }
            )
        }
        
        composable(Route.ChatList.route) {
            ChatListScreen(
                onNavigateToChat = { chatId ->
                    navController.navigate(Route.ChatRoom(chatId).createRoute(chatId))
                }
            )
        }
        
        // More routes...
    }
}
```

---

## 🎨 Feature Implementation Guide

### Feature Structure Pattern
Every feature follows this consistent structure:

```
feature_name/
├── FeatureScreen.kt      # Composable UI
├── FeatureViewModel.kt   # State & Logic
├── FeatureState.kt       # UI State Data Class
└── FeatureEvent.kt       # UI Events (optional)
```

### Feature Descriptions

#### 1. Authentication (`auth/`)

**Functionality**:
- User login with email and password
- New user registration
- Password validation
- Session persistence
- Auto-login for returning users

**Files**:
- `LoginScreen.kt`: Login UI with email/password fields
- `LoginViewModel.kt`: Login logic and Firebase Auth integration
- `RegisterScreen.kt`: Registration UI with validation
- `RegisterViewModel.kt`: Registration logic

**Key Operations**:
```kotlin
// LoginViewModel operations:
- login(email: String, password: String)
- observeAuthState()
- handleLoginResult()

// RegisterViewModel operations:
- register(email: String, password: String, name: String)
- validateInputs()
- createUserProfile()
```

---

#### 2. Chat List (`chatlist/`)

**Functionality**:
- Display all active conversations
- Show last message preview
- Display unread message count
- Sort by most recent activity
- Real-time updates via Firestore listeners
- Pull-to-refresh

**Files**:
- `ChatListScreen.kt`: List of chat items with LazyColumn
- `ChatListViewModel.kt`: Manages chat list state
- `ChatListState.kt`: UI state (chats, loading, error)

**State Structure**:
```kotlin
data class ChatListState(
    val chats: List<Chat> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val currentUserId: String = ""
)
```

---

#### 3. Contact Search (`search/`)

**Functionality**:
- Search users by name or email
- Debounced search (300ms delay)
- Display search results in real-time
- Start new conversation with selected user
- Empty state when no results

**Files**:
- `SearchScreen.kt`: Search bar + results list
- `SearchViewModel.kt`: Search logic with debouncing
- `SearchState.kt`: Search results state

**Key Features**:
```kotlin
// Debounced search implementation
fun searchUsers(query: String) {
    searchJob?.cancel()
    searchJob = viewModelScope.launch {
        delay(300) // Debounce
        searchUsersUseCase(query).collect { result ->
            // Update state
        }
    }
}
```

---

#### 4. Chat Room (`chatroom/`)

**Functionality**:
- Display message history in chronological order
- Send text messages
- Real-time message updates
- Message status indicators (sent, delivered, read)
- Auto-scroll to latest message
- Initiate audio call from chat

**Files**:
- `ChatRoomScreen.kt`: Message list + input field
- `ChatRoomViewModel.kt`: Message handling logic
- `ChatRoomState.kt`: Messages and chat state

**State Structure**:
```kotlin
data class ChatRoomState(
    val messages: List<Message> = emptyList(),
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val error: String? = null,
    val chatInfo: Chat? = null,
    val otherUser: User? = null
)
```

---

#### 5. Call History (`callhistory/`)

**Functionality**:
- Display list of all calls (incoming/outgoing/missed)
- Show call duration
- Show call timestamp
- Filter by call type
- Quick callback action
- Delete call records

**Files**:
- `CallHistoryScreen.kt`: List of call records
- `CallHistoryViewModel.kt`: History management
- `CallHistoryState.kt`: Call history state

**State Structure**:
```kotlin
data class CallHistoryState(
    val calls: List<CallHistory> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val filterType: CallFilterType = CallFilterType.ALL
)

enum class CallFilterType {
    ALL, INCOMING, OUTGOING, MISSED
}
```

---

#### 6. User Profile (`profile/`)

**Functionality**:
- Display user information
- Edit profile (name, photo)
- Upload profile picture
- Update user status
- Logout functionality
- App settings and preferences

**Files**:
- `ProfileScreen.kt`: Profile UI with edit options
- `ProfileViewModel.kt`: Profile management
- `ProfileState.kt`: User profile state

**Key Operations**:
```kotlin
// ProfileViewModel operations:
- loadUserProfile()
- updateProfile(name: String, photoUrl: String)
- uploadProfilePhoto(imageUri: Uri)
- logout()
```

---

## 💉 Dependency Injection Setup

This project uses **Hilt** for dependency injection.

### Setup in ChatApplication.kt

```kotlin
@HiltAndroidApp
class ChatApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize Firebase if needed
        FirebaseApp.initializeApp(this)
    }
}
```

### Module Definitions

#### 1. AppModule.kt
Provides application-level dependencies

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    
    @Provides
    @Singleton
    fun provideContext(@ApplicationContext context: Context): Context {
        return context
    }
    
    @Provides
    @Singleton
    fun providePreferencesManager(
        @ApplicationContext context: Context
    ): PreferencesManager {
        return PreferencesManager(context)
    }
}
```

#### 2. FirebaseModule.kt
Provides Firebase service instances

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object FirebaseModule {
    
    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth {
        return FirebaseAuth.getInstance()
    }
    
    @Provides
    @Singleton
    fun provideFirebaseFirestore(): FirebaseFirestore {
        return FirebaseFirestore.getInstance()
    }
    
    @Provides
    @Singleton
    fun provideFirebaseStorage(): FirebaseStorage {
        return FirebaseStorage.getInstance()
    }
    
    @Provides
    @Singleton
    fun provideFirebaseAuthService(
        firebaseAuth: FirebaseAuth
    ): FirebaseAuthService {
        return FirebaseAuthService(firebaseAuth)
    }
    
    @Provides
    @Singleton
    fun provideFirestoreService(
        firestore: FirebaseFirestore
    ): FirestoreService {
        return FirestoreService(firestore)
    }
}
```

#### 3. AgoraModule.kt
Provides Agora RTC Engine for audio calling

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object AgoraModule {
    
    @Provides
    @Singleton
    fun provideAgoraEngine(
        @ApplicationContext context: Context
    ): RtcEngine {
        val config = RtcEngineConfig()
        config.mContext = context
        config.mAppId = BuildConfig.AGORA_APP_ID
        config.mEventHandler = object : IRtcEngineEventHandler() {
            override fun onJoinChannelSuccess(channel: String, uid: Int, elapsed: Int) {
                // Handle successful channel join
            }
            
            override fun onUserJoined(uid: Int, elapsed: Int) {
                // Handle user joined channel
            }
            
            override fun onUserOffline(uid: Int, reason: Int) {
                // Handle user left channel
            }
        }
        
        return RtcEngine.create(config)
    }
    
    @Provides
    @Singleton
    fun provideAgoraService(
        rtcEngine: RtcEngine
    ): AgoraService {
        return AgoraService(rtcEngine)
    }
}
```

#### 4. RepositoryModule.kt
Binds repository implementations to interfaces

```kotlin
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    
    @Binds
    @Singleton
    abstract fun bindAuthRepository(
        authRepositoryImpl: AuthRepositoryImpl
    ): AuthRepository
    
    @Binds
    @Singleton
    abstract fun bindChatRepository(
        chatRepositoryImpl: ChatRepositoryImpl
    ): ChatRepository
    
    @Binds
    @Singleton
    abstract fun bindUserRepository(
        userRepositoryImpl: UserRepositoryImpl
    ): UserRepository
    
    @Binds
    @Singleton
    abstract fun bindCallRepository(
        callRepositoryImpl: CallRepositoryImpl
    ): CallRepository
}
```

### Using Hilt in Components

**In ViewModels**:
```kotlin
@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val getChatsUseCase: GetChatsUseCase,
    private val preferencesManager: PreferencesManager
) : ViewModel() {
    // ViewModel implementation
}
```

**In Composable Screens**:
```kotlin
@Composable
fun ChatListScreen(
    viewModel: ChatListViewModel = hiltViewModel(),
    onNavigateToChat: (String) -> Unit
) {
    // Screen implementation
}
```

**In MainActivity**:
```kotlin
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AppTheme {
                AppNavigation()
            }
        }
    }
}
```

---

## 📝 Code Standards & Conventions

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Classes** | PascalCase | `UserRepository`, `ChatViewModel` |
| **Functions** | camelCase | `sendMessage()`, `getUserProfile()` |
| **Variables** | camelCase | `currentUser`, `messageList` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_MESSAGE_LENGTH`, `API_TIMEOUT` |
| **Composables** | PascalCase | `ChatListScreen()`, `MessageBubble()` |
| **Packages** | lowercase | `com.yourapp.data.model` |
| **Files** | PascalCase | `ChatRepository.kt`, `LoginScreen.kt` |

### File Organization Rules

1. **One class per file**: Each Kotlin file should contain only one public class
2. **File name matches class name**: `UserRepository.kt` contains `class UserRepository`
3. **Group related files**: Keep related classes in the same package
4. **Separate interfaces and implementations**:
    - `ChatRepository.kt` (interface)
    - `ChatRepositoryImpl.kt` (implementation)

### Package Structure Rules

```
com.yourapp/
├── data/              # Data layer - no UI dependencies
├── domain/            # Domain layer - no Android framework dependencies
├── presentation/      # Presentation layer - UI and Android framework
├── di/                # Dependency injection modules
└── util/              # Shared utilities
```

### Kotlin Code Style

**Use data classes for models**:
```kotlin
// Good
data class User(val id: String, val name: String)

// Avoid
class User {
    var id: String = ""
    var name: String = ""
}
```

**Use sealed classes for states**:
```kotlin
sealed class AuthState {
    object Idle : AuthState()
    object Loading : AuthState()
    data class Success(val user: User) : AuthState()
    data class Error(val message: String) : AuthState()
}
```

**Use extension functions**:
```kotlin
// Extensions.kt
fun String.isValidEmail(): Boolean {
    return this.contains("@") && this.contains(".")
}

fun Long.toFormattedDate(): String {
    val sdf = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault())
    return sdf.format(Date(this))
}
```

**Use scope functions appropriately**:
```kotlin
// let - for null checks and transformations
user?.let { 
    updateUI(it) 
}

// apply - for object configuration
val message = Message().apply {
    content = "Hello"
    timestamp = System.currentTimeMillis()
}

// with - for multiple calls on same object
with(binding) {
    textView.text = "Hello"
    button.setOnClickListener { }
}
```

### Composable Guidelines

**1. State hoisting**: Lift state up to make composables reusable
```kotlin
// Good - Stateless composable
@Composable
fun MessageInput(
    value: String,
    onValueChange: (String) -> Unit,
    onSendClick: () -> Unit
) {
    Row {
        TextField(value = value, onValueChange = onValueChange)
        IconButton(onClick = onSendClick) { }
    }
}

// Usage in stateful screen
@Composable
fun ChatRoomScreen(viewModel: ChatRoomViewModel) {
    var message by remember { mutableStateOf("") }
    MessageInput(
        value = message,
        onValueChange = { message = it },
        onSendClick = { viewModel.sendMessage(message) }
    )
}
```

**2. Extract reusable components**:
```kotlin
// components/CustomButton.kt
@Composable
fun CustomButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled
    ) {
        Text(text)
    }
}
```

**3. Use preview annotations**:
```kotlin
@Preview(showBackground = true)
@Composable
fun MessageBubblePreview() {
    AppTheme {
        MessageBubble(
            message = Message(
                content = "Hello, this is a test message",
                timestamp = System.currentTimeMillis(),
                senderId = "user1"
            ),
            isCurrentUser = true
        )
    }
}
```

**4. Avoid side effects in composables**:
```kotlin
// Bad - Direct side effect
@Composable
fun BadScreen() {
    viewModel.loadData() // Called on every recomposition!
}

// Good - Use LaunchedEffect
@Composable
fun GoodScreen(viewModel: SomeViewModel) {
    LaunchedEffect(Unit) {
        viewModel.loadData() // Called once
    }
}
```

### ViewModel Best Practices

**1. Use StateFlow for UI state**:
```kotlin
@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val getChatsUseCase: GetChatsUseCase
) : ViewModel() {
    
    private val _state = MutableStateFlow(ChatListState())
    val state: StateFlow<ChatListState> = _state.asStateFlow()
    
    // Expose only immutable state to UI
}
```

**2. Handle events through functions**:
```kotlin
// Define event sealed class
sealed class ChatListEvent {
    object LoadChats : ChatListEvent()
    object Refresh : ChatListEvent()
    data class DeleteChat(val chatId: String) : ChatListEvent()
}

// Handle in ViewModel
fun onEvent(event: ChatListEvent) {
    when (event) {
        is ChatListEvent.LoadChats -> loadChats()
        is ChatListEvent.Refresh -> refresh()
        is ChatListEvent.DeleteChat -> deleteChat(event.chatId)
    }
}
```

**3. Clean up resources**:
```kotlin
@HiltViewModel
class CallViewModel @Inject constructor(
    private val agoraService: AgoraService
) : ViewModel() {
    
    override fun onCleared() {
        super.onCleared()
        // Clean up Agora resources
        agoraService.leaveChannel()
        agoraService.destroy()
    }
}
```

### Error Handling Patterns

**1. Use Resource wrapper**:
```kotlin
sealed class Resource<T> {
    class Success<T>(val data: T) : Resource<T>()
    class Error<T>(val message: String) : Resource<T>()
    class Loading<T> : Resource<T>()
}

// In Repository
suspend fun getUser(userId: String): Resource<User> {
    return try {
        val user = firestore.collection("users")
            .document(userId)
            .get()
            .await()
            .toObject(User::class.java)
        
        if (user != null) {
            Resource.Success(user)
        } else {
            Resource.Error("User not found")
        }
    } catch (e: Exception) {
        Resource.Error(e.message ?: "Unknown error")
    }
}
```

**2. Handle errors in UI**:
```kotlin
@Composable
fun ChatListScreen(viewModel: ChatListViewModel) {
    val state by viewModel.state.collectAsState()
    
    when {
        state.isLoading -> LoadingIndicator()
        state.error != null -> {
            ErrorMessage(
                message = state.error!!,
                onRetry = { viewModel.retry() }
            )
        }
        state.chats.isEmpty() -> EmptyStateMessage()
        else -> ChatList(chats = state.chats)
    }
}
```

### Comments and Documentation

**Use KDoc for public APIs**:
```kotlin
/**
 * Repository for managing chat operations.
 * 
 * This repository handles all chat-related data operations including
 * fetching chat lists, sending messages, and managing chat state.
 * 
 * @property firestoreService Service for Firestore operations
 * @property authRepository Repository for authentication state
 */
class ChatRepositoryImpl @Inject constructor(
    private val firestoreService: FirestoreService,
    private val authRepository: AuthRepository
) : ChatRepository {
    
    /**
     * Fetches all chats for the given user ID.
     * 
     * @param userId The ID of the user whose chats to fetch
     * @return Flow of Resource containing list of chats
     */
    override fun getChats(userId: String): Flow<Resource<List<Chat>>> {
        // Implementation
    }
}
```

**Explain complex logic**:
```kotlin
fun processMessages(messages: List<Message>): List<Message> {
    // Group messages by date and add date separators
    // This is needed to display date headers in the chat UI
    return messages
        .groupBy { it.timestamp.toLocalDate() }
        .flatMap { (date, msgs) ->
            listOf(createDateSeparator(date)) + msgs
        }
}
```