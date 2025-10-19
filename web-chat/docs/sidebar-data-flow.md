# Sidebar Data Flow - Collection yang Digunakan

## Overview
Sidebar menampilkan daftar chat (direct chat & group chat) dari user yang sedang login. Data diambil dari **SATU collection utama** yaitu `userChats`, kemudian digabungkan dengan informasi dari collection lainnya.

---

## Collection yang Digunakan

### 1. **Collection Utama: `userChats`** ✨
Ini adalah collection yang **LANGSUNG** digunakan untuk mendapatkan daftar chat di sidebar.

**Path Collection:**
```
userChats/{userId}
```

**Struktur Document:**
```typescript
{
  userId: string,
  chats: ChatItem[],  // Array of chat items
  updatedAt: Timestamp
}
```

**Struktur `ChatItem` (isi dari array `chats`):**
```typescript
{
  chatId: string,           // ID dari directChats atau groupChats
  chatType: "DIRECT" | "GROUP",

  // Direct Chat fields
  otherUserId?: string,     // ID user lawan bicara (hanya untuk DIRECT)
  otherUserName?: string,   // Nama user lawan bicara (hanya untuk DIRECT)
  otherUserAvatar?: string, // Avatar user lawan bicara (hanya untuk DIRECT)

  // Group Chat fields
  groupName?: string,       // Nama grup (hanya untuk GROUP)
  groupAvatar?: string,     // Avatar grup (hanya untuk GROUP)

  // Common fields
  lastMessage: string,      // Text pesan terakhir
  lastMessageTime: Timestamp, // Waktu pesan terakhir
  unreadCount: number       // Jumlah pesan yang belum dibaca
}
```

---

## Flow Data ke Sidebar

### Step 1: Subscribe ke `userChats` Collection
**File:** `lib/hooks/use-chat-list.ts`

```typescript
const unsubscribe = chatRepository.getUserChats(
  userId,
  (chats) => {
    // Callback ketika ada update
    setChats(chats);
  },
  (error) => {
    // Callback ketika error
    setError(error);
  }
);
```

### Step 2: Repository Method `getUserChats`
**File:** `lib/repositories/chat.repository.ts` (line 635-662)

```typescript
getUserChats(
  userId: string,
  onUpdate: (chats: ChatItem[]) => void,
  onError: (error: string) => void
): () => void {
  const userChatsRef = doc(db(), 'userChats', userId);

  const unsubscribe = onSnapshot(
    userChatsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserChats;
        // Sort by lastMessageTime descending
        const sortedChats = [...data.chats].sort((a, b) => {
          return b.lastMessageTime.seconds - a.lastMessageTime.seconds;
        });
        onUpdate(sortedChats);
      } else {
        onUpdate([]);
      }
    },
    (error) => {
      onError(error.message || 'Failed to fetch chats');
    }
  );

  return unsubscribe;
}
```

**Penjelasan:**
- Subscribe ke document `userChats/{userId}` menggunakan `onSnapshot`
- Setiap ada perubahan di document ini, callback `onUpdate` akan dipanggil
- Data di-sort berdasarkan `lastMessageTime` (descending)
- Return unsubscribe function untuk cleanup

### Step 3: Hook `useChatList` Process Data
**File:** `lib/hooks/use-chat-list.ts` (line 22-48)

```typescript
const unsubscribe = chatRepository.getUserChats(
  userId,
  (chats) => {
    // Remove duplicates based on chatId
    const uniqueChats = chats.reduce((acc: ChatItem[], chat) => {
      const existingIndex = acc.findIndex((c) => c.chatId === chat.chatId);
      if (existingIndex === -1) {
        acc.push(chat);
      } else {
        // Keep the one with more recent timestamp
        if (chat.lastMessageTime.seconds > acc[existingIndex].lastMessageTime.seconds) {
          acc[existingIndex] = chat;
        }
      }
      return acc;
    }, []);

    setChats(uniqueChats);
    setLoading(false);
    setError(null);
  },
  (error) => {
    setError(error);
    setLoading(false);
  }
);
```

**Penjelasan:**
- Remove duplicate berdasarkan `chatId`
- Jika ada duplicate, keep yang punya `lastMessageTime` lebih baru
- Set state `chats`, `loading`, dan `error`

### Step 4: Sidebar Component Display Data
**File:** `components/chat/sidebar.tsx` (line 40)

```typescript
const { chats, loading, error } = useChatList(currentUserId);
```

**Render di UI (line 217-286):**
```typescript
{filtered.map((c) => {
  const name = c.chatType === 'GROUP' ? c.groupName : c.otherUserName;
  const avatar = c.chatType === 'GROUP' ? c.groupAvatar : c.otherUserAvatar;
  const isGroup = c.chatType === 'GROUP';
  const timeAgo = formatDistanceToNow(c.lastMessageTime.toDate(), { addSuffix: true });

  // ... render chat item
})}
```

---

## Collection Pendukung (Tidak Langsung Diakses oleh Sidebar)

### 2. **`directChats` Collection**
**Path:** `directChats/{chatId}`

**Kapan Digunakan:**
- Saat membuka chat room direct chat
- Saat create direct chat baru
- Saat send message di direct chat

**Struktur:**
```typescript
{
  chatId: string,
  participants: string[],  // [userId1, userId2]
  lastMessage?: LastMessage,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Catatan:**
- Data dari collection ini TIDAK langsung ditampilkan di sidebar
- Sidebar hanya menggunakan data dari `userChats`
- Data di `directChats` digunakan untuk update `userChats` ketika ada pesan baru

### 3. **`groupChats` Collection**
**Path:** `groupChats/{chatId}`

**Kapan Digunakan:**
- Saat membuka chat room group chat
- Saat create group chat baru
- Saat send message di group chat
- Saat add/remove member
- Saat leave group

**Struktur:**
```typescript
{
  chatId: string,
  name: string,
  avatar?: string,
  avatarUrl?: string,
  participants: string[],
  admins: string[],
  leftMembers?: Record<string, Timestamp>,  // Track when users left
  lastMessage?: LastMessage,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Catatan:**
- Data dari collection ini TIDAK langsung ditampilkan di sidebar
- Sidebar hanya menggunakan data dari `userChats`
- Data di `groupChats` digunakan untuk update `userChats` ketika ada pesan baru

---

## Kapan `userChats` Di-update?

`userChats` collection di-update setiap kali ada event berikut:

### 1. **Send Message**
- Update `lastMessage` dan `lastMessageTime` untuk semua participants
- Update `unreadCount` untuk participants lain (kecuali sender)

### 2. **Read Message**
- Reset `unreadCount` menjadi 0 untuk user yang membaca

### 3. **Create Direct Chat**
- Tambahkan `ChatItem` baru ke array `chats` untuk kedua participants

### 4. **Create Group Chat**
- Tambahkan `ChatItem` baru ke array `chats` untuk semua participants

### 5. **Add Member to Group**
- Tambahkan `ChatItem` baru ke array `chats` untuk member baru

### 6. **Leave Group**
- ❌ **TIDAK** menghapus `ChatItem` dari `userChats`
- User masih bisa lihat chat di sidebar tapi read-only
- Update `leftMembers` di `groupChats` untuk tracking

### 7. **Remove Member from Group**
- ❌ **TIDAK** menghapus `ChatItem` dari `userChats`
- Member yang di-kick masih bisa lihat historical chat

---

## Real-time Updates

### Firestore Listener
Sidebar menggunakan **`onSnapshot`** untuk real-time updates:

```typescript
onSnapshot(userChatsRef, (snapshot) => {
  // This callback fires:
  // 1. Immediately with current data
  // 2. Every time userChats document changes
  if (snapshot.exists()) {
    const data = snapshot.data() as UserChats;
    onUpdate(data.chats);
  }
});
```

### Kapan Listener Trigger?
- Saat ada pesan baru masuk
- Saat user send message
- Saat user/member lain send message di group
- Saat group name/avatar di-update
- Saat user lain update profile (nama/avatar)

---

## Example: Data di Firestore

### Document `userChats/userA23`
```json
{
  "userId": "userA23",
  "chats": [
    {
      "chatId": "group123",
      "chatType": "GROUP",
      "groupName": "HIDUP JOKOWI",
      "groupAvatar": "https://...",
      "lastMessage": "userA18 hahahahahahahah: Testt",
      "lastMessageTime": { "_seconds": 1234567890 },
      "unreadCount": 0
    },
    {
      "chatId": "userA14_userA23",
      "chatType": "DIRECT",
      "otherUserId": "userA14",
      "otherUserName": "userA14",
      "otherUserAvatar": "https://...",
      "lastMessage": "bsbss sjjs",
      "lastMessageTime": { "_seconds": 1234567880 },
      "unreadCount": 0
    },
    {
      "chatId": "group456",
      "chatType": "GROUP",
      "groupName": "test dong",
      "lastMessage": "Pesan ini dihapus",
      "lastMessageTime": { "_seconds": 1234567870 },
      "unreadCount": 2
    }
  ],
  "updatedAt": { "_seconds": 1234567890 }
}
```

---

## Summary

| Collection | Diakses Langsung oleh Sidebar? | Fungsi |
|------------|-------------------------------|--------|
| **`userChats`** | ✅ **YA** | Collection utama untuk sidebar, berisi daftar chat dengan info lengkap |
| `directChats` | ❌ Tidak | Digunakan saat buka chat room direct chat |
| `groupChats` | ❌ Tidak | Digunakan saat buka chat room group chat |
| `messages` | ❌ Tidak | Digunakan saat buka chat room untuk load messages |
| `users` | ❌ Tidak | Digunakan untuk get user profile info |

**Kesimpulan:**
Sidebar **HANYA** menggunakan collection `userChats/{userId}` untuk mendapatkan semua data yang ditampilkan. Collection lain (`directChats`, `groupChats`, `messages`) hanya digunakan saat user membuka chat room atau melakukan action tertentu.
