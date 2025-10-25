# Admin Management - Technical Documentation

## Overview
This document describes the technical implementation of group admin management features, specifically the ability to promote users to admin (set admin) and demote users from admin (unset admin) in group chats.

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Database Structure](#database-structure)
- [Repository Methods](#repository-methods)
- [UI Components](#ui-components)
- [Business Rules](#business-rules)
- [User Flow](#user-flow)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)

---

## Features

### 1. Set Admin (Promote to Admin)
Allows existing admins to promote regular group members to admin status.

**Location in code:**
- Repository: `lib/repositories/chat.repository.ts:594-634`
- UI Handler: `components/chat/group-info-dialog.tsx:173-190`

### 2. Unset Admin (Demote from Admin)
Allows existing admins to demote other admins to regular member status.

**Location in code:**
- Repository: `lib/repositories/chat.repository.ts:639-673`
- UI Handler: `components/chat/group-info-dialog.tsx:192-209`

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     GroupInfoDialog                          │
│  - Displays group members                                    │
│  - Shows admin badges                                        │
│  - Provides admin management dropdown menu                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─ handlePromoteToAdmin()
                     ├─ handleDemoteFromAdmin()
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    ChatRepository                            │
│  - promoteToAdmin(chatId, userId)                           │
│  - demoteFromAdmin(chatId, userId)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Firestore Database                         │
│  Collection: groupChats                                      │
│    - admins: string[]                                        │
│    - participants: string[]                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Structure

### GroupChat Document
```typescript
{
  chatId: string
  name: string
  participants: string[]      // All group members
  participantsMap: Record<string, boolean>
  admins: string[]           // Admin user IDs (max 5)
  createdAt: Timestamp
  createdBy: string          // Creator is auto-admin
  updatedAt: Timestamp
  // ... other fields
}
```

### Key Fields for Admin Management
- **admins**: Array of user IDs who have admin privileges
  - Maximum: 5 admins per group
  - Minimum: 1 admin per group (cannot remove last admin)
  - Creator is automatically added as first admin

---

## Repository Methods

### 1. promoteToAdmin

**File:** `lib/repositories/chat.repository.ts:594-634`

**Function Signature:**
```typescript
async promoteToAdmin(
  chatId: string,
  userId: string
): Promise<Resource<void>>
```

**Implementation Details:**

1. **Validation Checks:**
   - Group chat exists
   - User is a participant of the group
   - User is not already an admin
   - Admin count is less than 5 (max limit)

2. **Database Update:**
   - Uses Firestore `arrayUnion` to add userId to admins array
   - Updates `updatedAt` timestamp

3. **Return Values:**
   - Success: `Resource.success(undefined)`
   - Error: `Resource.error(message)`

**Error Messages:**
- "Group chat not found"
- "User is not a member of this group"
- "User is already an admin"
- "Maksimal 5 admin per grup. Hapus admin lain terlebih dahulu."

**Code Reference:**
```typescript
// Check max admin limit (5 admins)
const currentAdminCount = groupChat.admins?.length || 0;
if (currentAdminCount >= 5) {
  return Resource.error('Maksimal 5 admin per grup. Hapus admin lain terlebih dahulu.');
}

// Add user to admins list
await updateDoc(groupChatRef, {
  admins: arrayUnion(userId),
  updatedAt: Timestamp.now(),
});
```

---

### 2. demoteFromAdmin

**File:** `lib/repositories/chat.repository.ts:639-673`

**Function Signature:**
```typescript
async demoteFromAdmin(
  chatId: string,
  userId: string
): Promise<Resource<void>>
```

**Implementation Details:**

1. **Validation Checks:**
   - Group chat exists
   - User is currently an admin
   - Not the last admin (at least 1 admin must remain)

2. **Database Update:**
   - Uses Firestore `arrayRemove` to remove userId from admins array
   - Updates `updatedAt` timestamp

3. **Return Values:**
   - Success: `Resource.success(undefined)`
   - Error: `Resource.error(message)`

**Error Messages:**
- "Group chat not found"
- "User is not an admin"
- "Cannot remove the last admin"

**Code Reference:**
```typescript
// Cannot demote if they are the last admin
if (groupChat.admins.length === 1) {
  return Resource.error('Cannot remove the last admin');
}

// Remove user from admins list
await updateDoc(groupChatRef, {
  admins: arrayRemove(userId),
  updatedAt: Timestamp.now(),
});
```

---

## UI Components

### GroupInfoDialog Component

**File:** `components/chat/group-info-dialog.tsx`

#### Member List Display
- Members are sorted with admins appearing first
- Each admin has a "Admin" badge displayed
- Dropdown menu appears on hover for manageable members

**Code Reference (lines 623-749):**
```typescript
{[...groupMembers]
  .sort((a, b) => {
    const aIsAdmin = groupAdmins.includes(a.userId)
    const bIsAdmin = groupAdmins.includes(b.userId)

    // Sort admins first
    if (aIsAdmin && !bIsAdmin) return -1
    if (!aIsAdmin && bIsAdmin) return 1

    // Then sort alphabetically by display name
    return a.displayName.localeCompare(b.displayName)
  })
  .map((member) => {
    // ... render member with admin badge and dropdown
  })
}
```

#### Dropdown Menu Options

**For Regular Members:**
- "Jadikan admin grup" - Promote to admin
  - Disabled if max admin limit (5) reached
  - Shows "(Max)" indicator when disabled
- "Keluarkan" - Remove from group

**For Admin Members:**
- "Hapus dari admin" - Demote from admin
- "Keluarkan" - Remove from group

**Visibility Rules:**
- Only admins can see management dropdown
- Current user cannot manage themselves
- Options shown based on member's current admin status

**Code Reference (lines 686-744):**
```typescript
{canManage && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          "h-8 w-8 transition-opacity",
          isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      {isAdmin ? (
        <DropdownMenuItem onClick={() => handleDemoteFromAdmin(...)}>
          <UserCog className="h-4 w-4 mr-2" />
          <span>Hapus dari admin</span>
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          onClick={() => handlePromoteToAdmin(...)}
          disabled={!canPromoteToAdmin}
        >
          <UserCog className="h-4 w-4 mr-2" />
          <span>Jadikan admin grup</span>
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

#### Event Handlers

**handlePromoteToAdmin** (lines 173-190):
```typescript
const handlePromoteToAdmin = async (userId: string, userName: string) => {
  if (!isCurrentUserAdmin) {
    toast.error('Hanya admin yang dapat menambahkan admin baru')
    return
  }

  const result = await chatRepository.promoteToAdmin(chatId, userId)

  if (result.status === 'success') {
    toast.success(`${userName} sekarang menjadi admin`)
    // Update parent state with new admin
    if (onAdminsUpdate) {
      onAdminsUpdate([...groupAdmins, userId])
    }
  } else if (result.status === 'error') {
    toast.error(result.message || 'Gagal menjadikan admin')
  }
}
```

**handleDemoteFromAdmin** (lines 192-209):
```typescript
const handleDemoteFromAdmin = async (userId: string, userName: string) => {
  if (!isCurrentUserAdmin) {
    toast.error('Hanya admin yang dapat menghapus admin')
    return
  }

  const result = await chatRepository.demoteFromAdmin(chatId, userId)

  if (result.status === 'success') {
    toast.success(`${userName} bukan lagi admin`)
    // Update parent state by removing admin
    if (onAdminsUpdate) {
      onAdminsUpdate(groupAdmins.filter(id => id !== userId))
    }
  } else if (result.status === 'error') {
    toast.error(result.message || 'Gagal menghapus admin')
  }
}
```

---

## Business Rules

### Admin Limits
1. **Maximum Admins:** 5 per group
2. **Minimum Admins:** 1 per group (cannot remove last admin)
3. **Creator:** Group creator is automatically the first admin

### Permissions
1. **Who Can Promote:**
   - Only existing admins can promote members

2. **Who Can Be Promoted:**
   - Any regular member (non-admin)
   - Must be an active participant in the group
   - Group must have less than 5 admins

3. **Who Can Demote:**
   - Only existing admins can demote other admins

4. **Who Can Be Demoted:**
   - Any admin except the last remaining admin
   - User cannot demote themselves (UI prevents this)

### Automatic Admin Assignment
- When the last admin leaves a group with remaining participants, a random participant is promoted to admin
- **Code Location:** `lib/repositories/chat.repository.ts:334-345`

```typescript
// If last admin leaves and there are other participants, randomly pick new admin
if (updatedParticipants.length > 0 && updatedAdmins.length === 0) {
  const randomIndex = Math.floor(Math.random() * updatedParticipants.length);
  const newAdmin = updatedParticipants[randomIndex];
  updatedAdmins = [newAdmin];
}
```

### Constraints for Member Removal
- Cannot remove all participants from a group
- When removing an admin, must ensure at least one admin remains
- **Code Location:** `lib/repositories/chat.repository.ts:468-480`

---

## User Flow

### Promote Member to Admin Flow

```
1. Admin opens Group Info Dialog
   ↓
2. Hovers over a regular member
   ↓
3. Clicks dropdown menu (ChevronDown icon appears)
   ↓
4. Selects "Jadikan admin grup"
   ↓
5. System validates:
   - User is admin
   - Target is member
   - Admin count < 5
   ↓
6. Success:
   - Member added to admins array in Firestore
   - UI updates with admin badge
   - Toast: "{userName} sekarang menjadi admin"
   ↓
7. Failure:
   - Toast displays error message
```

### Demote Admin to Member Flow

```
1. Admin opens Group Info Dialog
   ↓
2. Hovers over an admin member
   ↓
3. Clicks dropdown menu (ChevronDown icon appears)
   ↓
4. Selects "Hapus dari admin"
   ↓
5. System validates:
   - User is admin
   - Target is admin
   - Not the last admin
   ↓
6. Success:
   - Member removed from admins array in Firestore
   - UI updates (admin badge removed)
   - Toast: "{userName} bukan lagi admin"
   ↓
7. Failure:
   - Toast displays error message
```

---

## Error Handling

### Client-Side Validation
1. **Permission Check:**
   ```typescript
   if (!isCurrentUserAdmin) {
     toast.error('Hanya admin yang dapat menambahkan admin baru')
     return
   }
   ```

2. **Max Admin Check (UI):**
   ```typescript
   const canPromoteToAdmin = !isAdmin && groupAdmins.length < 5
   ```

### Server-Side Validation
All validations in repository methods return `Resource<T>` type:

```typescript
type Resource<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
```

### Common Error Scenarios

| Scenario | Error Message | Location |
|----------|--------------|----------|
| Non-admin tries to promote | "Hanya admin yang dapat menambahkan admin baru" | UI Handler |
| Non-admin tries to demote | "Hanya admin yang dapat menghapus admin" | UI Handler |
| Max admins reached | "Maksimal 5 admin per grup. Hapus admin lain terlebih dahulu." | Repository |
| User not a member | "User is not a member of this group" | Repository |
| User already admin | "User is already an admin" | Repository |
| User not an admin | "User is not an admin" | Repository |
| Last admin removal | "Cannot remove the last admin" | Repository |
| Group not found | "Group chat not found" | Repository |

---

## Code Examples

### Example 1: Promoting a User to Admin

```typescript
import { ChatRepository } from '@/lib/repositories/chat.repository'

const chatRepository = new ChatRepository()

async function promoteUserToAdmin(
  groupChatId: string,
  userId: string,
  userName: string
) {
  // Call repository method
  const result = await chatRepository.promoteToAdmin(groupChatId, userId)

  // Handle result
  if (result.status === 'success') {
    console.log(`${userName} is now an admin`)
    // Update UI state
    // Show success notification
  } else {
    console.error('Failed to promote user:', result.message)
    // Show error notification
  }
}
```

### Example 2: Demoting an Admin to Regular Member

```typescript
import { ChatRepository } from '@/lib/repositories/chat.repository'

const chatRepository = new ChatRepository()

async function demoteAdminToMember(
  groupChatId: string,
  userId: string,
  userName: string
) {
  // Call repository method
  const result = await chatRepository.demoteFromAdmin(groupChatId, userId)

  // Handle result
  if (result.status === 'success') {
    console.log(`${userName} is no longer an admin`)
    // Update UI state
    // Show success notification
  } else {
    console.error('Failed to demote admin:', result.message)
    // Show error notification
  }
}
```

### Example 3: Checking Admin Status Before Action

```typescript
interface GroupChat {
  chatId: string
  admins: string[]
  participants: string[]
}

function canPromoteUser(
  currentUserId: string,
  targetUserId: string,
  groupChat: GroupChat
): { canPromote: boolean; reason?: string } {
  // Check if current user is admin
  if (!groupChat.admins.includes(currentUserId)) {
    return {
      canPromote: false,
      reason: 'Only admins can promote members'
    }
  }

  // Check if target is already admin
  if (groupChat.admins.includes(targetUserId)) {
    return {
      canPromote: false,
      reason: 'User is already an admin'
    }
  }

  // Check if target is a member
  if (!groupChat.participants.includes(targetUserId)) {
    return {
      canPromote: false,
      reason: 'User is not a member of this group'
    }
  }

  // Check max admin limit
  if (groupChat.admins.length >= 5) {
    return {
      canPromote: false,
      reason: 'Maximum admin limit (5) reached'
    }
  }

  return { canPromote: true }
}
```

### Example 4: UI Component Integration

```typescript
import { useState } from 'react'
import { ChatRepository } from '@/lib/repositories/chat.repository'
import { toast } from 'sonner'

function MemberManagementDropdown({
  member,
  groupAdmins,
  chatId,
  onAdminsUpdate
}) {
  const chatRepository = new ChatRepository()
  const isAdmin = groupAdmins.includes(member.userId)
  const canPromote = !isAdmin && groupAdmins.length < 5

  const handlePromote = async () => {
    const result = await chatRepository.promoteToAdmin(chatId, member.userId)

    if (result.status === 'success') {
      toast.success(`${member.displayName} sekarang menjadi admin`)
      onAdminsUpdate([...groupAdmins, member.userId])
    } else {
      toast.error(result.message || 'Gagal menjadikan admin')
    }
  }

  const handleDemote = async () => {
    const result = await chatRepository.demoteFromAdmin(chatId, member.userId)

    if (result.status === 'success') {
      toast.success(`${member.displayName} bukan lagi admin`)
      onAdminsUpdate(groupAdmins.filter(id => id !== member.userId))
    } else {
      toast.error(result.message || 'Gagal menghapus admin')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button>Options</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {isAdmin ? (
          <DropdownMenuItem onClick={handleDemote}>
            Remove from admin
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={handlePromote}
            disabled={!canPromote}
          >
            Make group admin
            {!canPromote && <span>(Max)</span>}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## Real-Time Updates

### Admin Badge Updates
When a user is promoted or demoted, the UI updates in real-time through the parent component's state management:

**File:** `components/chat/chat-room.tsx:411-469`

The ChatRoom component listens to real-time updates from the group document:

```typescript
useEffect(() => {
  if (!isGroupChat) return

  const groupRef = doc(db(), 'groupChats', chatId)
  const unsubscribe = onSnapshot(groupRef, (snapshot) => {
    if (snapshot.exists()) {
      const groupData = snapshot.data()
      const admins = groupData?.admins || []

      // Update admins state in real-time
      setGroupAdmins(admins)
    }
  })

  return () => unsubscribe()
}, [chatId, currentUserId, isGroupChat])
```

This ensures that:
- Admin badges appear/disappear immediately when users are promoted/demoted
- All participants see the changes in real-time
- The dropdown menu options update based on current admin status

---

## Testing Considerations

### Unit Tests
1. **Repository Methods:**
   - Test promoteToAdmin with valid user
   - Test promoteToAdmin with invalid user (not a member)
   - Test promoteToAdmin with already admin user
   - Test promoteToAdmin when max limit reached
   - Test demoteFromAdmin with valid admin
   - Test demoteFromAdmin with last admin (should fail)
   - Test demoteFromAdmin with non-admin user (should fail)

2. **UI Handlers:**
   - Test permission checks (non-admin attempting actions)
   - Test state updates after successful promotion/demotion
   - Test error toast display on failure

### Integration Tests
1. End-to-end flow for promoting a member
2. End-to-end flow for demoting an admin
3. Verify Firestore document updates
4. Verify real-time UI updates across multiple clients

### Edge Cases
1. Last admin leaves group → random member promoted
2. Concurrent admin promotions (race conditions)
3. Network failures during promotion/demotion
4. User removed from group while being promoted

---

## Related Features

### Group Member Management
- **Add Members:** `lib/repositories/chat.repository.ts:678-806`
- **Remove Members:** `lib/repositories/chat.repository.ts:441-589`
- **Leave Group:** `lib/repositories/chat.repository.ts:292-435`

### Group Settings
- **Update Group Name:** `lib/repositories/chat.repository.ts:811-859`
- **Update Group Avatar:** `lib/repositories/chat.repository.ts:864-914`

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025 | Initial implementation of admin management features |

---

## References

- **Repository Implementation:** `lib/repositories/chat.repository.ts`
- **UI Component:** `components/chat/group-info-dialog.tsx`
- **Real-time Updates:** `components/chat/chat-room.tsx:411-469`
- **Type Definitions:** `types/models.ts`

---

## Support

For questions or issues related to admin management features, please refer to:
1. This documentation
2. Code comments in the implementation files
3. Related feature documentation (LEAVE_GROUP_FEATURE.md, etc.)
