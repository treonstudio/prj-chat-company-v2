# Leave Group - Firestore Flow Documentation

## Overview
Dokumentasi ini menjelaskan secara detail apa yang terjadi di Firestore Collections dan Documents ketika user melakukan leave group.

---

## Firestore Collections Structure

```
firestore/
├── groupChats/                    # Collection untuk group chat
│   └── {chatId}/                  # Document untuk setiap group
│       ├── chatId: string
│       ├── name: string
│       ├── participants: string[]
│       ├── admins: string[]
│       ├── createdAt: Timestamp
│       ├── updatedAt: Timestamp
│       └── messages/              # Sub-collection untuk messages
│           └── {messageId}/       # Document untuk setiap message
│               ├── messageId: string
│               ├── senderId: string
│               ├── senderName: string
│               ├── text: string
│               ├── type: string
│               ├── timestamp: Timestamp
│               ├── status: string
│               └── readBy: string[]
│
└── userChats/                     # Collection untuk user's chat list
    └── {userId}/                  # Document untuk setiap user
        ├── userId: string
        ├── updatedAt: Timestamp
        └── chats: ChatItem[]
            ├── chatId: string
            ├── chatType: string
            ├── groupName: string
            ├── groupAvatar: string
            ├── lastMessage: string
            ├── lastMessageTime: Timestamp
            └── unreadCount: number
```

---

## Leave Group Flow

### Scenario: User "Alice" leave dari group "Team Chat"

**Initial State:**
- Group ID: `abc123`
- Group Name: "Team Chat"
- Participants: `["alice123", "bob456", "charlie789"]`
- Admins: `["alice123"]`

---

### Step 1: Remove dari Participants

**Collection:** `groupChats/{chatId}`

**Before:**
```json
{
  "chatId": "abc123",
  "name": "Team Chat",
  "participants": ["alice123", "bob456", "charlie789"],
  "admins": ["alice123"],
  "createdAt": "2025-10-19T10:00:00Z",
  "updatedAt": "2025-10-19T10:00:00Z"
}
```

**After:**
```json
{
  "chatId": "abc123",
  "name": "Team Chat",
  "participants": ["bob456", "charlie789"],  // ✅ Alice removed
  "admins": ["bob456"],                       // ✅ Bob randomly picked as new admin
  "createdAt": "2025-10-19T10:00:00Z",
  "updatedAt": "2025-10-19T12:30:00Z"        // ✅ Updated
}
```

**Changes:**
- ✅ `alice123` dihapus dari array `participants`
- ✅ `alice123` dihapus dari array `admins`
- ✅ `bob456` ditambahkan ke array `admins` (random pick dari remaining participants)
- ✅ `updatedAt` diupdate ke timestamp sekarang

---

### Step 2: Create System Message

**Collection:** `groupChats/{chatId}/messages/{messageId}`

**New Document:**
```json
{
  "messageId": "msg_xyz789",
  "senderId": "system",
  "senderName": "System",
  "text": "Alice telah keluar dari grup",
  "type": "TEXT",
  "timestamp": "2025-10-19T12:30:00Z",
  "status": "SENT",
  "readBy": []
}
```

**Purpose:**
- ✅ Membuat notifikasi system message
- ✅ Semua member yang tersisa akan melihat message ini
- ✅ Message ini tidak bisa dihapus atau diedit

---

### Step 3: Update LastMessage di UserChats Participants Lain

#### Bob's UserChats

**Collection:** `userChats/bob456`

**Before:**
```json
{
  "userId": "bob456",
  "updatedAt": "2025-10-19T11:00:00Z",
  "chats": [
    {
      "chatId": "abc123",
      "chatType": "GROUP",
      "groupName": "Team Chat",
      "groupAvatar": "https://...",
      "lastMessage": "See you tomorrow!",
      "lastMessageTime": "2025-10-19T11:00:00Z",
      "unreadCount": 0
    }
  ]
}
```

**After:**
```json
{
  "userId": "bob456",
  "updatedAt": "2025-10-19T12:30:00Z",
  "chats": [
    {
      "chatId": "abc123",
      "chatType": "GROUP",
      "groupName": "Team Chat",
      "groupAvatar": "https://...",
      "lastMessage": "Alice telah keluar dari grup",  // ✅ Updated
      "lastMessageTime": "2025-10-19T12:30:00Z",     // ✅ Updated
      "unreadCount": 0
    }
  ]
}
```

**Changes:**
- ✅ `lastMessage` diupdate dengan system message
- ✅ `lastMessageTime` diupdate ke timestamp sekarang
- ✅ `updatedAt` diupdate

#### Charlie's UserChats

**Same update pattern seperti Bob**

---

### Step 4: Alice's UserChats (Unchanged)

**Collection:** `userChats/alice123`

**Before & After (SAMA - TIDAK ADA PERUBAHAN):**
```json
{
  "userId": "alice123",
  "updatedAt": "2025-10-19T11:00:00Z",
  "chats": [
    {
      "chatId": "abc123",
      "chatType": "GROUP",
      "groupName": "Team Chat",
      "groupAvatar": "https://...",
      "lastMessage": "See you tomorrow!",
      "lastMessageTime": "2025-10-19T11:00:00Z",
      "unreadCount": 0
    }
  ]
}
```

**Important:**
- ❌ Chat **TIDAK** dihapus dari array `chats`
- ❌ `lastMessage` **TIDAK** diupdate
- ❌ Alice masih bisa melihat chat di sidebar
- ❌ Alice masih bisa membaca chat history
- ✅ Alice **TIDAK BISA** mengirim pesan (karena bukan participant)

---

## Admin Transfer Logic

### Case 1: Admin Leave & Ada Participants Lain

**Scenario:** Alice (admin) leave, Bob dan Charlie masih ada

**Process:**
1. Remove Alice dari `participants`
2. Remove Alice dari `admins`
3. Check: `updatedAdmins.length === 0` ✅ (true)
4. Check: `updatedParticipants.length > 0` ✅ (true - Bob & Charlie)
5. **Random Pick:** Pilih random dari `["bob456", "charlie789"]`
6. Add random user ke `admins` array

**Result:**
```javascript
// Before
participants: ["alice123", "bob456", "charlie789"]
admins: ["alice123"]

// After
participants: ["bob456", "charlie789"]
admins: ["bob456"]  // atau "charlie789" (random)
```

---

### Case 2: Admin Leave & Tidak Ada Participants Lain

**Scenario:** Alice (admin) leave, tidak ada member lain

**Process:**
1. Remove Alice dari `participants`
2. Remove Alice dari `admins`
3. Check: `updatedAdmins.length === 0` ✅ (true)
4. Check: `updatedParticipants.length > 0` ❌ (false - kosong)
5. **Skip random pick**

**Result:**
```javascript
// Before
participants: ["alice123"]
admins: ["alice123"]

// After
participants: []
admins: []
```

**Note:** Group masih ada di database tapi kosong (ghost group)

---

### Case 3: Non-Admin Leave

**Scenario:** Bob (bukan admin) leave, Alice (admin) dan Charlie masih ada

**Process:**
1. Remove Bob dari `participants`
2. Check: Bob ada di `admins`? ❌ (false)
3. **Skip admin logic**

**Result:**
```javascript
// Before
participants: ["alice123", "bob456", "charlie789"]
admins: ["alice123"]

// After
participants: ["alice123", "charlie789"]
admins: ["alice123"]  // Tidak berubah
```

---

## Message Composer Behavior

### User yang Leave Group

**Check di ChatRoom component:**
```typescript
const isParticipant = groupChat.participants.includes(currentUserId)
```

**If `isParticipant === false`:**
```jsx
<div className="flex items-center justify-center px-4 py-3 bg-muted">
  <p className="text-sm text-muted-foreground">
    You are no longer a participant in this group
  </p>
</div>
```

**Result:**
- ❌ Message Composer **TIDAK** ditampilkan
- ❌ User **TIDAK BISA** kirim text
- ❌ User **TIDAK BISA** kirim image/video/document
- ✅ User masih bisa scroll dan baca chat history

---

## System Message Display

**Di ChatRoom component:**
```typescript
if (message.senderId === 'system') {
  return (
    <div className="flex justify-center my-2">
      <div className="bg-muted/50 px-3 py-1.5 rounded-lg">
        <p className="text-xs text-muted-foreground">
          {message.text}
        </p>
      </div>
    </div>
  )
}
```

**Visual:**
```
┌─────────────────────────────────────┐
│                                     │
│     ┌───────────────────────┐       │
│     │ Alice telah keluar    │       │
│     │ dari grup             │       │
│     └───────────────────────┘       │
│          (centered, muted)          │
│                                     │
└─────────────────────────────────────┘
```

---

## Batch Write Operations

**Semua operasi dilakukan dalam 1 batch write untuk atomicity:**

```typescript
const batch = writeBatch(db())

// 1. Update groupChats
batch.update(groupChatRef, { participants, admins, updatedAt })

// 2. Create system message
batch.set(systemMessageRef, { messageId, senderId: 'system', ... })

// 3. Update userChats untuk Bob
batch.update(bobUserChatsRef, { chats: updatedChats, updatedAt })

// 4. Update userChats untuk Charlie
batch.update(charlieUserChatsRef, { chats: updatedChats, updatedAt })

// Execute all at once
await batch.commit()
```

**Benefits:**
- ✅ All-or-nothing: Semua berhasil atau semua gagal
- ✅ Konsistensi data terjaga
- ✅ Tidak ada partial update

---

## Error Handling

### Error 1: Group Chat Not Found

**Cause:** chatId tidak valid atau group sudah dihapus

**Response:**
```json
{
  "status": "error",
  "message": "Group chat not found"
}
```

**Firestore:** Tidak ada perubahan

---

### Error 2: User Not a Participant

**Cause:** User sudah leave sebelumnya atau tidak pernah jadi member

**Response:**
```json
{
  "status": "error",
  "message": "You are not a member of this group"
}
```

**Firestore:** Tidak ada perubahan

---

### Error 3: Batch Commit Failed

**Cause:** Network error, permission error, dll

**Response:**
```json
{
  "status": "error",
  "message": "Failed to leave group chat"
}
```

**Firestore:** Rollback otomatis (karena menggunakan batch)

---

## Message Filtering for Left Users

### New Field: `leftMembers`

**Collection:** `groupChats/{chatId}`

**Field Structure:**
```typescript
leftMembers: Record<string, Timestamp>
// Example:
{
  "alice123": Timestamp("2025-10-19T12:30:00Z"),
  "bob456": Timestamp("2025-10-20T15:45:00Z")
}
```

**Purpose:**
- Track when each user left the group
- Filter messages to hide messages sent after user left
- Remove entry when user is re-added to group

---

### Message Filtering Logic

**In ChatRoom Component:**
```typescript
// Get leftAt timestamp
const leftAt = groupChat.leftMembers?.[currentUserId]?.toDate()

// Filter messages
messages.filter(m => {
  if (leftAt && m.timestamp) {
    const messageTime = m.timestamp.toDate()
    return messageTime <= leftAt  // Only show messages before or at leftAt
  }
  return true  // Show all if user is participant
})
```

**Behavior:**
- ✅ User yang leave hanya bisa lihat messages sampai saat mereka leave
- ✅ Messages baru yang masuk setelah leave **TIDAK TERLIHAT**
- ✅ Jika di-add kembali, bisa lihat semua messages termasuk yang baru

---

### Example Timeline

**Timeline:**
```
10:00 - Alice: "Good morning!"
10:30 - Bob: "Hi everyone"
11:00 - Charlie: "Hello!"
12:00 - Alice leaves group  <-- leftMembers["alice"] = 12:00
12:30 - Bob: "Alice left"
13:00 - Charlie: "See you Alice"
14:00 - Alice is re-added   <-- leftMembers["alice"] deleted
14:30 - Bob: "Welcome back Alice!"
```

**What Alice sees:**

**Before leaving (10:00 - 11:59):**
- ✅ "Good morning!" (10:00)
- ✅ "Hi everyone" (10:30)
- ✅ "Hello!" (11:00)

**After leaving (12:00 - 13:59):**
- ✅ "Good morning!" (10:00)
- ✅ "Hi everyone" (10:30)
- ✅ "Hello!" (11:00)
- ✅ "Alice telah keluar dari grup" (12:00) - system message
- ❌ "Alice left" (12:30) - HIDDEN
- ❌ "See you Alice" (13:00) - HIDDEN

**After re-added (14:00+):**
- ✅ "Good morning!" (10:00)
- ✅ "Hi everyone" (10:30)
- ✅ "Hello!" (11:00)
- ✅ "Alice telah keluar dari grup" (12:00)
- ✅ "Alice left" (12:30) - NOW VISIBLE
- ✅ "See you Alice" (13:00) - NOW VISIBLE
- ✅ "Welcome back Alice!" (14:30)

---

## Summary

### Collections yang Diubah:
1. ✅ `groupChats/{chatId}` - Update participants, admins, **leftMembers**
2. ✅ `groupChats/{chatId}/messages/{newMessageId}` - Create system message
3. ✅ `userChats/{participantId}` - Update lastMessage (untuk setiap participant yang tersisa)

### Collections yang TIDAK Diubah:
- ❌ `userChats/{leavingUserId}` - Tetap ada, tidak diupdate

### Total Operations:
- 1x UPDATE: groupChats document
- 1x SET: system message document
- Nx UPDATE: userChats documents (N = jumlah participants yang tersisa)

### Data Integrity:
- ✅ Chat history tetap utuh
- ✅ Messages tidak hilang
- ✅ User yang leave hanya bisa baca messages **sampai saat leave**
- ✅ Messages baru setelah leave **TIDAK TERLIHAT**
- ✅ Admin transfer otomatis jika diperlukan
- ✅ System message untuk notifikasi
- ✅ Jika re-added, bisa lihat semua messages lagi

---

## Diagram Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Click "Leave Group"                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Get Group Chat Document                                  │
│     - Verify group exists                                    │
│     - Verify user is participant                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Create Batch Write                                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Update groupChats/{chatId}                               │
│     - Remove from participants                               │
│     - Remove from admins (if admin)                          │
│     - Random pick new admin (if needed)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Create System Message                                    │
│     - senderId: "system"                                     │
│     - text: "{userName} telah keluar dari grup"              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Update UserChats for Remaining Participants              │
│     - Update lastMessage                                     │
│     - Update lastMessageTime                                 │
│     - Update updatedAt                                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Commit Batch                                             │
│     - All operations execute atomically                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Success Response                                         │
│     - Toast: "You have left the group"                       │
│     - Close dialog                                           │
│     - Trigger onLeaveGroup callback                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Reference

**File:** `/lib/repositories/chat.repository.ts`
**Method:** `leaveGroupChat(userId: string, chatId: string, userName: string)`
**Lines:** 270-395

**File:** `/components/chat/group-info-dialog.tsx`
**Method:** `confirmLeaveGroup()`
**Lines:** 141-160

**File:** `/components/chat/chat-room.tsx`
**System Message Rendering:** Lines 310-319
**Participant Check:** Lines 369-374
