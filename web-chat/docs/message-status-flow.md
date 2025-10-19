# Message Status Flow - Firestore Documentation

## Overview
Dokumentasi ini menjelaskan secara detail mekanisme status message di aplikasi chat:
1. **SENT** - Message berhasil dikirim ke Firestore
2. **DELIVERED** - Message sudah sampai ke device penerima
3. **READ** - Message sudah dibaca oleh penerima

---

## Message Status Types

```typescript
enum MessageStatus {
  SENDING = 'SENDING',    // Client-side only, saat upload
  SENT = 'SENT',         // Message tersimpan di Firestore
  DELIVERED = 'DELIVERED', // Message delivered ke device penerima
  READ = 'READ',         // Message sudah dibaca
  FAILED = 'FAILED'      // Message gagal terkirim
}
```

---

## Message Model Structure

```typescript
interface Message {
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  mediaMetadata?: MediaMetadata;

  // Status tracking
  readBy: Record<string, Timestamp>;        // { userId: timestamp }
  deliveredTo?: Record<string, Timestamp>;  // { userId: timestamp }
  timestamp?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  status?: MessageStatus;
  error?: string;
}
```

---

## Flow 1: SENDING → SENT

### Scenario: Alice mengirim message "Hello" di Direct Chat ke Bob

**Step 1: Client Creates Optimistic Message**

Ketika Alice klik "Send", client langsung menampilkan message dengan status `SENDING`:

```typescript
const optimisticMessage = {
  messageId: 'temp-' + Date.now(),
  senderId: 'alice',
  senderName: 'Alice',
  text: 'Hello',
  type: 'TEXT',
  status: 'SENDING',
  timestamp: Timestamp.now(),
  readBy: {},
  deliveredTo: {}
}
```

**UI Display:**
- Message muncul di chat room Alice
- Icon status: Clock icon (⏱️) - indicating sending

---

**Step 2: Upload to Firestore**

```typescript
// Create message document
const messagesRef = collection(db(), 'directChats', chatId, 'messages');
const messageRef = doc(messagesRef);

await setDoc(messageRef, {
  messageId: messageRef.id,
  senderId: 'alice',
  senderName: 'Alice',
  text: 'Hello',
  type: 'TEXT',
  timestamp: Timestamp.now(),
  createdAt: Timestamp.now(),
  status: 'SENT',
  readBy: {},
  deliveredTo: {}
});
```

**Firestore Path:**
```
directChats/alice_bob/messages/msg123
```

**Document Created:**
```json
{
  "messageId": "msg123",
  "senderId": "alice",
  "senderName": "Alice",
  "text": "Hello",
  "type": "TEXT",
  "timestamp": { "_seconds": 1234567890 },
  "createdAt": { "_seconds": 1234567890 },
  "status": "SENT",
  "readBy": {},
  "deliveredTo": {}
}
```

---

**Step 3: Real-time Listener Updates**

Alice's client receives the message via `onSnapshot`:

```typescript
onSnapshot(messagesQuery, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added' || change.type === 'modified') {
      const message = change.doc.data() as Message;
      // Update UI dengan status 'SENT'
    }
  });
});
```

**UI Update:**
- Replace optimistic message dengan real message
- Icon status: Single checkmark (✓) - indicating sent
- Status badge: "SENT"

---

## Flow 2: SENT → DELIVERED

### Scenario: Bob membuka aplikasi dan menerima message dari Alice

**Step 1: Bob's Device Receives Message**

Bob's client `onSnapshot` listener detects new message:

```typescript
// Bob's messages listener
onSnapshot(messagesQuery, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      const message = change.doc.data() as Message;

      // If message not from Bob and not delivered to Bob yet
      if (message.senderId !== 'bob' && !message.deliveredTo?.['bob']) {
        // Mark as delivered
        markAsDelivered(message.messageId);
      }
    }
  });
});
```

---

**Step 2: Update Firestore with Delivered Status**

**Method:** `markAsDelivered()` (currently not implemented, but would work like this)

```typescript
async markAsDelivered(chatId: string, messageId: string, userId: string) {
  const messageRef = doc(
    db(),
    'directChats',
    chatId,
    'messages',
    messageId
  );

  await updateDoc(messageRef, {
    [`deliveredTo.${userId}`]: Timestamp.now(),
    status: 'DELIVERED',
    updatedAt: Timestamp.now()
  });
}
```

**Before:**
```json
{
  "messageId": "msg123",
  "senderId": "alice",
  "text": "Hello",
  "status": "SENT",
  "readBy": {},
  "deliveredTo": {}
}
```

**After:**
```json
{
  "messageId": "msg123",
  "senderId": "alice",
  "text": "Hello",
  "status": "DELIVERED",
  "readBy": {},
  "deliveredTo": {
    "bob": { "_seconds": 1234567895 }
  },
  "updatedAt": { "_seconds": 1234567895 }
}
```

---

**Step 3: Alice's UI Updates**

Alice's `onSnapshot` listener receives update:

```typescript
// Alice sees the message status change
onSnapshot(messagesQuery, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'modified') {
      const message = change.doc.data() as Message;
      // Update UI to show 'DELIVERED' status
    }
  });
});
```

**UI Update for Alice:**
- Icon status: Double checkmark (✓✓) - indicating delivered
- Status badge: "DELIVERED"
- Timestamp shows when delivered

---

## Flow 3: DELIVERED → READ

### Scenario: Bob membuka chat room dengan Alice dan membaca message

**Step 1: Bob Opens Chat Room**

Ketika Bob membuka chat room dengan Alice, semua unread messages di-mark as read:

```typescript
useEffect(() => {
  if (chatId && currentUserId) {
    // Mark all messages as read when opening chat
    markAsRead(chatId, currentUserId);
  }
}, [chatId, currentUserId]);
```

---

**Step 2: Mark All Messages as Read**

**File:** `lib/hooks/use-messages.ts`

```typescript
const markAsRead = async (chatId: string, userId: string) => {
  const messagesRef = collection(
    db(),
    isGroupChat ? 'groupChats' : 'directChats',
    chatId,
    'messages'
  );

  // Query unread messages (messages where readBy doesn't include userId)
  const unreadQuery = query(messagesRef, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(unreadQuery);

  const batch = writeBatch(db());
  let count = 0;

  snapshot.docs.forEach((doc) => {
    const message = doc.data() as Message;

    // Skip if already read by this user or if user is sender
    if (message.senderId === userId) return;
    if (message.readBy?.[userId]) return;

    batch.update(doc.ref, {
      [`readBy.${userId}`]: Timestamp.now(),
      status: 'READ',
      updatedAt: Timestamp.now()
    });
    count++;
  });

  if (count > 0) {
    await batch.commit();
  }
};
```

---

**Step 3: Update Message Document**

**Before:**
```json
{
  "messageId": "msg123",
  "senderId": "alice",
  "text": "Hello",
  "status": "DELIVERED",
  "readBy": {},
  "deliveredTo": {
    "bob": { "_seconds": 1234567895 }
  }
}
```

**After:**
```json
{
  "messageId": "msg123",
  "senderId": "alice",
  "text": "Hello",
  "status": "READ",
  "readBy": {
    "bob": { "_seconds": 1234567900 }
  },
  "deliveredTo": {
    "bob": { "_seconds": 1234567895 }
  },
  "updatedAt": { "_seconds": 1234567900 }
}
```

---

**Step 4: Update UserChats - Reset Unread Count**

**File:** `lib/repositories/chat.repository.ts`

```typescript
// Reset unread count for this chat
const userChatsRef = doc(db(), 'userChats', userId);
const userChatsDoc = await getDoc(userChatsRef);

if (userChatsDoc.exists()) {
  const userChats = userChatsDoc.data() as UserChats;
  const updatedChats = userChats.chats.map((chat) => {
    if (chat.chatId === chatId) {
      return {
        ...chat,
        unreadCount: 0
      };
    }
    return chat;
  });

  await updateDoc(userChatsRef, {
    chats: updatedChats,
    updatedAt: Timestamp.now()
  });
}
```

**Bob's userChats Before:**
```json
{
  "userId": "bob",
  "chats": [
    {
      "chatId": "alice_bob",
      "chatType": "DIRECT",
      "otherUserName": "Alice",
      "lastMessage": "Hello",
      "lastMessageTime": { "_seconds": 1234567890 },
      "unreadCount": 1
    }
  ]
}
```

**Bob's userChats After:**
```json
{
  "userId": "bob",
  "chats": [
    {
      "chatId": "alice_bob",
      "chatType": "DIRECT",
      "otherUserName": "Alice",
      "lastMessage": "Hello",
      "lastMessageTime": { "_seconds": 1234567890 },
      "unreadCount": 0
    }
  ],
  "updatedAt": { "_seconds": 1234567900 }
}
```

---

**Step 5: Alice's UI Updates**

Alice's `onSnapshot` listener receives update:

**UI Update for Alice:**
- Icon status: Double checkmark in blue (✓✓) - indicating read
- Status badge: "READ"
- Timestamp shows when read

---

## Group Chat Status Tracking

### Scenario: Alice mengirim message di group dengan 5 members (Alice, Bob, Charlie, Diana, Eve)

**Step 1: Message Created with SENT Status**

```json
{
  "messageId": "msg456",
  "senderId": "alice",
  "text": "Team meeting at 3pm",
  "type": "TEXT",
  "status": "SENT",
  "readBy": {},
  "deliveredTo": {},
  "timestamp": { "_seconds": 1234567890 }
}
```

---

**Step 2: Bob dan Charlie Open App (Delivered)**

```json
{
  "messageId": "msg456",
  "senderId": "alice",
  "text": "Team meeting at 3pm",
  "status": "DELIVERED",
  "readBy": {},
  "deliveredTo": {
    "bob": { "_seconds": 1234567895 },
    "charlie": { "_seconds": 1234567896 }
  }
}
```

**Status Determination Logic:**
- If ANY recipient has received → status = "DELIVERED"
- Else → status = "SENT"

---

**Step 3: Bob Reads the Message**

```json
{
  "messageId": "msg456",
  "senderId": "alice",
  "text": "Team meeting at 3pm",
  "status": "READ",
  "readBy": {
    "bob": { "_seconds": 1234567900 }
  },
  "deliveredTo": {
    "bob": { "_seconds": 1234567895 },
    "charlie": { "_seconds": 1234567896 }
  }
}
```

**Status Determination Logic:**
- If ANY recipient has read → status = "READ"
- Else if ANY recipient delivered → status = "DELIVERED"
- Else → status = "SENT"

---

**Step 4: All Members Read**

```json
{
  "messageId": "msg456",
  "senderId": "alice",
  "text": "Team meeting at 3pm",
  "status": "READ",
  "readBy": {
    "bob": { "_seconds": 1234567900 },
    "charlie": { "_seconds": 1234567905 },
    "diana": { "_seconds": 1234567910 },
    "eve": { "_seconds": 1234567915 }
  },
  "deliveredTo": {
    "bob": { "_seconds": 1234567895 },
    "charlie": { "_seconds": 1234567896 },
    "diana": { "_seconds": 1234567898 },
    "eve": { "_seconds": 1234567899 }
  }
}
```

---

## UI Status Icons

### Direct Chat

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| SENDING | ⏱️ | Gray | Message sedang dikirim |
| SENT | ✓ | Gray | Message terkirim ke server |
| DELIVERED | ✓✓ | Gray | Message sampai ke device penerima |
| READ | ✓✓ | Blue | Message sudah dibaca |
| FAILED | ⚠️ | Red | Message gagal terkirim |

### Group Chat

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| SENDING | ⏱️ | Gray | Message sedang dikirim |
| SENT | ✓ | Gray | Message terkirim ke server |
| DELIVERED | ✓✓ | Gray | Minimal 1 member menerima |
| READ | ✓✓ | Blue | Minimal 1 member membaca |
| FAILED | ⚠️ | Red | Message gagal terkirim |

---

## Status Icon Component

**File:** `components/chat/message-status-icon.tsx`

```typescript
export function MessageStatusIcon({ status }: { status?: MessageStatus }) {
  if (!status || status === 'SENDING') {
    return <Clock className="h-3 w-3 text-muted-foreground" />
  }

  if (status === 'FAILED') {
    return <AlertCircle className="h-3 w-3 text-destructive" />
  }

  if (status === 'SENT') {
    return <Check className="h-3 w-3 text-muted-foreground" />
  }

  if (status === 'DELIVERED') {
    return <CheckCheck className="h-3 w-3 text-muted-foreground" />
  }

  if (status === 'READ') {
    return <CheckCheck className="h-3 w-3 text-blue-500" />
  }

  return null
}
```

---

## Timeline Example: Complete Flow

### Direct Chat: Alice → Bob

```
T0: Alice types "Hello" and clicks Send
├─ Client creates optimistic message with status SENDING
├─ UI shows clock icon (⏱️)
│
T1: Message uploaded to Firestore
├─ Document created: status = SENT, readBy = {}, deliveredTo = {}
├─ Alice's UI updates: single checkmark (✓)
│
T2: Bob opens app (onSnapshot fires)
├─ Bob's client detects new message
├─ Calls markAsDelivered()
├─ Document updated: status = DELIVERED, deliveredTo = { bob: timestamp }
├─ Alice's UI updates: double checkmark (✓✓) gray
│
T3: Bob opens chat room with Alice
├─ useEffect calls markAsRead()
├─ Document updated: status = READ, readBy = { bob: timestamp }
├─ Bob's unreadCount reset to 0
├─ Alice's UI updates: double checkmark (✓✓) blue
```

---

## Code Implementation

### 1. Send Message Flow

**File:** `lib/hooks/use-messages.ts`

```typescript
const sendTextMessage = async (text: string) => {
  try {
    setSending(true);

    const result = await messageRepository.sendMessage(
      chatId,
      currentUserId,
      currentUserName,
      currentUserAvatar,
      text,
      'TEXT',
      isGroupChat
    );

    if (result.status === 'success') {
      // Message automatically gets status: 'SENT'
      // onSnapshot will receive the update
    } else {
      // Status: 'FAILED'
      toast.error(result.message);
    }
  } catch (error) {
    // Status: 'FAILED'
  } finally {
    setSending(false);
  }
};
```

---

### 2. Mark as Delivered Flow

**Note:** Currently NOT implemented, but should be added:

**File:** `lib/hooks/use-messages.ts` (to be added)

```typescript
const markAsDelivered = async (messageId: string) => {
  if (isGroupChat) {
    const messageRef = doc(
      db(),
      'groupChats',
      chatId,
      'messages',
      messageId
    );

    await updateDoc(messageRef, {
      [`deliveredTo.${currentUserId}`]: Timestamp.now(),
      status: 'DELIVERED',
      updatedAt: Timestamp.now()
    });
  } else {
    const messageRef = doc(
      db(),
      'directChats',
      chatId,
      'messages',
      messageId
    );

    await updateDoc(messageRef, {
      [`deliveredTo.${currentUserId}`]: Timestamp.now(),
      status: 'DELIVERED',
      updatedAt: Timestamp.now()
    });
  }
};
```

---

### 3. Mark as Read Flow

**File:** `lib/hooks/use-messages.ts`

```typescript
const markAsRead = useCallback(async () => {
  if (!chatId || !currentUserId) return;

  const messagesRef = collection(
    db(),
    isGroupChat ? 'groupChats' : 'directChats',
    chatId,
    'messages'
  );

  const unreadQuery = query(messagesRef, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(unreadQuery);

  const batch = writeBatch(db());
  let hasUpdates = false;

  snapshot.docs.forEach((doc) => {
    const message = doc.data() as Message;

    if (message.senderId === currentUserId) return;
    if (message.readBy?.[currentUserId]) return;

    batch.update(doc.ref, {
      [`readBy.${currentUserId}`]: Timestamp.now(),
      status: 'READ',
      updatedAt: Timestamp.now()
    });
    hasUpdates = true;
  });

  if (hasUpdates) {
    await batch.commit();

    // Reset unread count
    await resetUnreadCount();
  }
}, [chatId, currentUserId, isGroupChat]);
```

---

### 4. Reset Unread Count

**File:** `lib/hooks/use-messages.ts`

```typescript
const resetUnreadCount = async () => {
  const userChatsRef = doc(db(), 'userChats', currentUserId);
  const userChatsDoc = await getDoc(userChatsRef);

  if (userChatsDoc.exists()) {
    const userChats = userChatsDoc.data() as UserChats;
    const updatedChats = userChats.chats.map((chat) => {
      if (chat.chatId === chatId) {
        return { ...chat, unreadCount: 0 };
      }
      return chat;
    });

    await updateDoc(userChatsRef, {
      chats: updatedChats,
      updatedAt: Timestamp.now()
    });
  }
};
```

---

## Status Determination Logic

### For Individual Message

```typescript
function getMessageStatus(message: Message, currentUserId: string): MessageStatus {
  // If sender, check recipient status
  if (message.senderId === currentUserId) {
    const recipients = Object.keys(message.readBy || {});
    const delivered = Object.keys(message.deliveredTo || {});

    if (recipients.length > 0) {
      return 'READ';
    }

    if (delivered.length > 0) {
      return 'DELIVERED';
    }

    return message.status || 'SENT';
  }

  // If recipient, return stored status
  return message.status || 'SENT';
}
```

---

## Current Implementation Status

### ✅ Implemented
1. **SENDING** - Client-side optimistic UI
2. **SENT** - Message saved to Firestore
3. **READ** - Mark as read when opening chat room
4. **FAILED** - Error handling with retry

### ❌ Not Yet Implemented
1. **DELIVERED** - Automatic delivery confirmation
   - Should be implemented in `useMessages` hook
   - Should trigger when `onSnapshot` receives new message
   - Should update `deliveredTo` field

### 📝 Recommendations
1. Add `markAsDelivered` function in `use-messages.ts`
2. Call `markAsDelivered` automatically when receiving messages
3. Add background sync for offline messages
4. Add typing indicators (optional)
5. Add "last seen" timestamp (optional)

---

## Code References

**Message Repository:**
- File: `lib/repositories/message.repository.ts`
- Methods: `sendMessage`, `forwardMessage`

**Messages Hook:**
- File: `lib/hooks/use-messages.ts`
- Functions: `sendTextMessage`, `markAsRead`, `retryMessage`

**Status Icon:**
- File: `components/chat/message-status-icon.tsx`
- Component: `MessageStatusIcon`

**Chat Message:**
- File: `components/chat/chat-message.tsx`
- Displays status icon for sender's messages

**Types:**
- File: `types/models.ts`
- Enums: `MessageStatus`
- Interfaces: `Message`
