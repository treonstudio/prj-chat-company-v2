# Chatku Web Chat - Setup Guide

This is the web chat application for Chatku, built with Next.js 15, React 19, TypeScript, and Firebase.

## Features

- **Real-time messaging**: Text, images, videos, and documents
- **Image compression**: Optional compression before uploading
- **Read receipts**: Track when messages are read
- **Unread counts**: See unread message counts in chat list
- **Direct chats**: One-on-one conversations
- **Group chats**: Participate in group conversations (view only - cannot create from web)
- **Authentication**: Firebase Auth integration
- **Responsive UI**: Works on desktop and mobile browsers

## Architecture

The project follows **Clean Architecture** principles with clear separation of concerns:

```
web-chat/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main chat page (protected)
│   ├── login/             # Login page
│   └── layout.tsx         # Root layout with AuthProvider
├── components/
│   ├── chat/              # Chat-related components
│   │   ├── sidebar.tsx    # Chat list sidebar
│   │   ├── chat-room.tsx  # Chat room with messages
│   │   ├── chat-message.tsx # Individual message bubble
│   │   └── message-composer.tsx # Message input with media
│   └── ui/                # Reusable UI components (shadcn/ui)
├── lib/
│   ├── firebase/
│   │   └── config.ts      # Firebase initialization
│   ├── repositories/      # Data layer
│   │   ├── auth.repository.ts
│   │   ├── user.repository.ts
│   │   ├── chat.repository.ts
│   │   └── message.repository.ts
│   ├── hooks/             # Custom React hooks
│   │   ├── use-chat-list.ts
│   │   └── use-messages.ts
│   ├── contexts/
│   │   └── auth.context.tsx # Authentication context
│   └── utils.ts           # Utility functions
└── types/
    ├── models.ts          # TypeScript models
    └── resource.ts        # Resource wrapper for async operations
```

### Key Architectural Decisions

1. **Repository Pattern**: All Firebase operations are encapsulated in repository classes
2. **Custom Hooks**: Business logic is abstracted into reusable hooks
3. **Context API**: Global state (auth) managed with React Context
4. **Type Safety**: Full TypeScript coverage with strict types
5. **Resource Wrapper**: Consistent error handling with `Resource<T>` type

## Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore, Auth, Storage enabled
- Same Firebase project as the Android app

## Setup Instructions

### 1. Install Dependencies

```bash
cd web-chat
npm install
```

### 2. Configure Firebase

Create a `.env.local` file in the `web-chat` directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Firebase configuration values from the Firebase Console:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Important**: Use the same Firebase project as your Android app to share data.

### 3. Firebase Security Rules

Make sure your Firestore security rules allow web access. Example rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Direct chats
    match /directChats/{chatId} {
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.participants;

      match /messages/{messageId} {
        allow read, write: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/directChats/$(chatId)).data.participants;
      }
    }

    // Group chats
    match /groupChats/{chatId} {
      allow read: if request.auth != null &&
        request.auth.uid in resource.data.participants;
      allow write: if request.auth != null &&
        request.auth.uid in resource.data.participants;

      match /messages/{messageId} {
        allow read, write: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/groupChats/$(chatId)).data.participants;
      }
    }

    // User chats
    match /userChats/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production

```bash
npm run build
npm start
```

## Usage

### Login

1. Navigate to `/login`
2. Enter email and password (must be registered via Android app or Firebase Console)
3. Click "Sign In"

### Chat Features

- **View chats**: See all your direct and group chats in the left sidebar
- **Search chats**: Use the search bar to filter chats
- **Send text**: Type a message and click Send or press Enter
- **Send images**: Click + icon → Image → Choose compression option
- **Send videos**: Click + icon → Video
- **Send documents**: Click + icon → Document
- **Read receipts**: Messages are automatically marked as read when viewing
- **Unread counts**: Badge shows number of unread messages per chat

### Logout

Click the menu icon (⋯) in the top right of the sidebar → Log out

## Limitations (By Design)

- **Cannot make/receive calls**: Voice/video calls are Android-only
- **Cannot create groups**: Group creation is Android-only (can participate in existing groups)
- **No FCM notifications**: Push notifications require service worker setup (optional enhancement)

## Firestore Data Structure

The web app uses the same Firestore structure as the Android app:

```
users/
  {userId}/
    displayName, email, avatarUrl, status, lastSeen

directChats/
  {chatId}/
    participants: [userId1, userId2]
    lastMessage: { text, senderId, timestamp, type }
    messages/
      {messageId}/
        messageId, senderId, text, type, mediaUrl, readBy, timestamp

groupChats/
  {chatId}/
    name, avatarUrl, participants: [userId1, userId2, ...]
    lastMessage: { text, senderId, timestamp, type }
    messages/
      {messageId}/
        messageId, senderId, text, type, mediaUrl, readBy, timestamp

userChats/
  {userId}/
    chats: [{chatId, chatType, lastMessage, unreadCount, ...}]
```

## Troubleshooting

### Firebase connection errors
- Verify `.env.local` values match your Firebase project
- Check Firebase security rules allow web access
- Ensure Firebase Auth and Firestore are enabled

### No chats showing
- Make sure you have existing chats from the Android app
- Check that the same Firebase project is being used
- Verify the user is logged in (check browser console)

### Images/videos not uploading
- Check Firebase Storage is enabled
- Verify Storage security rules allow authenticated uploads
- Check file size limits (browser and Firebase)

### TypeScript errors
- Run `npm install` to ensure all dependencies are installed
- Clear `.next` folder: `rm -rf .next`
- Restart development server

## Development Notes

- Uses Next.js 15 App Router
- React 19 with Server Components (where applicable)
- Tailwind CSS for styling
- shadcn/ui components
- Firebase SDK v12
- browser-image-compression for client-side compression

## Future Enhancements

- Push notifications with FCM
- Typing indicators
- Message reactions
- File preview before sending
- Message search
- User presence (online/offline status)
- Dark mode toggle
