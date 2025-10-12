// ============================================
// FIREBASE FIRESTORE COLLECTION STRUCTURE
// ============================================

// Collection: users
// Document ID: userId (Firebase Auth UID)
{
userId: "user123",
displayName: "John Doe",
email: "john@company.com",
avatarUrl: "https://storage.googleapis.com/...",
status: "online", // "online" | "offline"
lastSeen: Timestamp,
fcmToken: "device_token_for_push_notifications", // For push notifications
createdAt: Timestamp,
updatedAt: Timestamp
}

// ============================================
// Collection: directChats
// Document ID: auto-generated or composite key like "user1_user2"
// Use composite key format: [smaller_userId]_[larger_userId] for consistency
{
chatId: "directChat123",
participants: ["user123", "user456"], // Array of user IDs (always 2)
participantsMap: { // For easier querying
"user123": true,
"user456": true
},
lastMessage: {
text: "Hey, how are you?",
senderId: "user123",
senderName: "John Doe",
timestamp: Timestamp,
type: "text" // "text" | "image" | "video" | "document"
},
unreadCount: { // Unread count per user
"user123": 0,
"user456": 2
},
createdAt: Timestamp,
updatedAt: Timestamp
}

// Subcollection: directChats/{chatId}/messages
// Document ID: auto-generated
{
messageId: "msg123",
senderId: "user123",
senderName: "John Doe",
senderAvatar: "https://storage.googleapis.com/...",
text: "Hello there!",
type: "text", // "text" | "image" | "video" | "document"
mediaUrl: null, // URL if type is media
mediaMetadata: { // For media messages
fileName: "document.pdf",
fileSize: 1024000,
mimeType: "application/pdf",
thumbnailUrl: "https://..." // For images/videos
},
readBy: { // Read receipts
"user123": Timestamp,
"user456": Timestamp
},
timestamp: Timestamp,
createdAt: Timestamp,
updatedAt: Timestamp
}

// ============================================
// Collection: groupChats
// Document ID: auto-generated
{
chatId: "groupChat123",
name: "Project Team",
description: "Discussion for Project X",
avatarUrl: "https://storage.googleapis.com/...",
participants: ["user123", "user456", "user789"], // Array of user IDs
participantsMap: { // For easier querying
"user123": true,
"user456": true,
"user789": true
},
admins: ["user123"], // Array of admin user IDs
createdBy: "user123",
lastMessage: {
text: "Meeting at 3 PM",
senderId: "user456",
senderName: "Jane Smith",
timestamp: Timestamp,
type: "text"
},
unreadCount: { // Unread count per user
"user123": 0,
"user456": 0,
"user789": 5
},
createdAt: Timestamp,
updatedAt: Timestamp
}

// Subcollection: groupChats/{chatId}/messages
// Document ID: auto-generated
{
messageId: "msg456",
senderId: "user456",
senderName: "Jane Smith",
senderAvatar: "https://storage.googleapis.com/...",
text: "Meeting at 3 PM",
type: "text",
mediaUrl: null,
mediaMetadata: null,
readBy: { // Read receipts
"user123": Timestamp,
"user456": Timestamp
},
deliveredTo: {
"user123": Timestamp,
"user456": Timestamp,
"user789": Timestamp
},
timestamp: Timestamp,
createdAt: Timestamp,
updatedAt: Timestamp
}

// ============================================
// Collection: userChats (for quick chat list retrieval)
// Document ID: userId
// This is a denormalized collection for better performance
{
userId: "user123",
chats: [
{
chatId: "directChat123",
chatType: "direct", // "direct" | "group"
otherUserId: "user456", // Only for direct chats
otherUserName: "Jane Smith",
otherUserAvatar: "https://...",
lastMessage: "Hey, how are you?",
lastMessageTime: Timestamp,
unreadCount: 2
},
{
chatId: "groupChat123",
chatType: "group",
groupName: "Project Team",
groupAvatar: "https://...",
lastMessage: "Meeting at 3 PM",
lastMessageTime: Timestamp,
unreadCount: 0
}
],
updatedAt: Timestamp
}

// ============================================
// FIREBASE STORAGE STRUCTURE
// ============================================

// Storage paths for media files:
// - /users/{userId}/avatar.jpg
// - /chats/direct/{chatId}/{messageId}/{filename}
// - /chats/group/{chatId}/{messageId}/{filename}

// ============================================
// FIRESTORE INDEXES
// ============================================

// Composite indexes needed:
// 1. Collection: directChats
//    Fields: participantsMap.[userId] (Ascending), updatedAt (Descending)

// 2. Collection: groupChats
//    Fields: participantsMap.[userId] (Ascending), updatedAt (Descending)

// 3. Collection: directChats/{chatId}/messages
//    Fields: timestamp (Ascending/Descending)

// 4. Collection: groupChats/{chatId}/messages
//    Fields: timestamp (Ascending/Descending)

// 5. For search functionality (optional - consider Algolia for better search):
//    Collection: messages
//    Fields: text (for full-text search), timestamp

// ============================================
// FIRESTORE SECURITY RULES (Example)
// ============================================

/*
rules_version = '2';
service cloud.firestore {
match /databases/{database}/documents {

    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Direct chats
    match /directChats/{chatId} {
      allow read: if request.auth != null && 
                     request.auth.uid in resource.data.participants;
      allow create: if request.auth != null && 
                       request.auth.uid in request.resource.data.participants;
      allow update: if request.auth != null && 
                       request.auth.uid in resource.data.participants;
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read: if request.auth != null && 
                       request.auth.uid in get(/databases/$(database)/documents/directChats/$(chatId)).data.participants;
        allow create: if request.auth != null && 
                         request.auth.uid in get(/databases/$(database)/documents/directChats/$(chatId)).data.participants;
      }
    }
    
    // Group chats
    match /groupChats/{chatId} {
      allow read: if request.auth != null && 
                     request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
                       request.auth.uid in resource.data.participants;
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read: if request.auth != null && 
                       request.auth.uid in get(/databases/$(database)/documents/groupChats/$(chatId)).data.participants;
        allow create: if request.auth != null && 
                         request.auth.uid in get(/databases/$(database)/documents/groupChats/$(chatId)).data.participants;
      }
    }
    
    // User chats
    match /userChats/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
}
}
*/

// ============================================
// IMPLEMENTATION NOTES
// ============================================

/*
1. PUSH NOTIFICATIONS:
    - Store FCM tokens in user documents
    - Use Firebase Cloud Functions to trigger notifications on new messages
    - Update FCM token when user logs in or token refreshes

2. ONLINE/OFFLINE STATUS:
    - Use Firebase Realtime Database for presence (more efficient than Firestore)
    - Path: /status/{userId}
    - Value: { state: 'online', lastChanged: timestamp }
    - Use onDisconnect() to update status when user disconnects

3. MESSAGE SEARCH:
    - For 100 users, Firestore queries should be sufficient
    - Query messages by text field with >= and <= operators
    - For better search, consider Algolia or Typesense integration
    - Index message text field for search

4. READ RECEIPTS:
    - Update readBy map when user views message
    - Use batch writes to update multiple messages at once
    - Show "Read" status when all other participants have read the message
    - Display: Single checkmark (✓) for sent, double checkmark (✓✓) for read

5. PERFORMANCE TIPS:
    - Use pagination for message lists (limit + startAfter)
    - Cache user profiles locally to reduce reads
    - Use compound queries with participantsMap for chat lists
    - Denormalize data in userChats collection for faster chat list loading

6. MEDIA HANDLING:
    - Upload to Firebase Storage first
    - Get download URL
    - Save URL in message document
    - Generate thumbnails for images/videos using Cloud Functions

7. UNREAD COUNT:
    - Reset to 0 when user opens chat
    - Increment in Cloud Function when new message arrives
    - Store per-user in chat document for quick access
      */