# User Management Implementation

## Overview
Dashboard admin sekarang terintegrasi dengan Firestore untuk menampilkan daftar users secara real-time dengan pagination dan fitur active/deactive toggle.

## Features Implemented

### 1. **Fetch Users dari Firestore**
**File**: `src/firebase/firestore/getUsers.ts`

#### Functions:
- `getUsers(pageSize, lastDoc)` - Fetch users dengan pagination
  - Default page size: 10 users
  - Support untuk next/previous page
  - Ordered by `createdAt` descending (terbaru first)

- `getUsersCount()` - Get total count users untuk pagination info

### 2. **Update User Status**
**File**: `src/firebase/firestore/updateUser.ts`

Function untuk update data user di Firestore (termasuk status active/deactive)

### 3. **Dashboard Integration**
**File**: `src/app/dashboard/page.tsx`

#### State Management:
```tsx
const [users, setUsers] = useState<User[]>([])
const [usersLoading, setUsersLoading] = useState(true)
const [totalUsers, setTotalUsers] = useState(0)
const [currentPage, setCurrentPage] = useState(1)
const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
const [pageSize] = useState(10)
const [totalPages, setTotalPages] = useState(0)
```

#### Features:

**A. Auto Fetch Users on Load**
- Fetch users saat dashboard dimuat
- Fetch total count untuk pagination
- Loading state dengan spinner

**B. Pagination (10 items per page)**
- Previous button (back to page 1)
- Next button (load next 10 users)
- Page indicator: "Page X of Y"
- Disabled state saat loading atau sudah di edge

**C. Active/Deactive Toggle**
- Toggle switch per user
- Update real-time ke Firestore
- Toast notification untuk feedback
- Local state update untuk instant UI

**D. Auto Reload After Add User**
- Setelah user baru ditambahkan, list auto refresh
- Total count updated
- Reset ke page 1

## Data Structure

### User Interface:
```typescript
interface User {
  id: string
  email: string
  displayName?: string
  createdAt: string
  isActive: boolean
}
```

### Firestore Collection: `users`
```json
{
  "userId": {
    "email": "user@example.com",
    "displayName": "user",
    "createdAt": "2025-10-12T07:00:00.000Z",
    "isActive": true
  }
}
```

## UI Components

### 1. Users Table
- **Columns**:
  - NAME: Display name atau email
  - JOINING DATE: Format Indonesia (DD/MM/YYYY)
  - ACTIVE/DEACTIVE: Toggle switch
  - ACTION: Edit button

### 2. Loading State
```tsx
<div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
```

### 3. Empty State
```tsx
<div className="py-8 text-center text-gray-500">
  Belum ada user terdaftar
</div>
```

### 4. Pagination Controls
```tsx
<div className="mt-4 flex items-center justify-between">
  <div className="text-sm text-gray-600">
    Page {currentPage} of {totalPages || 1}
  </div>
  <div className="flex gap-2">
    <Button onClick={loadPreviousPage} disabled={currentPage === 1}>
      Previous
    </Button>
    <Button onClick={loadNextPage} disabled={!lastDoc || currentPage >= totalPages}>
      Next
    </Button>
  </div>
</div>
```

## Functions

### 1. Load Next Page
```typescript
const loadNextPage = async () => {
  if (!lastDoc) return

  setUsersLoading(true)
  const { result, error, lastVisible } = await getUsers(pageSize, lastDoc)

  if (!error && result) {
    setUsers(result as User[])
    setLastDoc(lastVisible || null)
    setCurrentPage((prev) => prev + 1)
  }

  setUsersLoading(false)
}
```

### 2. Load Previous Page
```typescript
const loadPreviousPage = async () => {
  if (currentPage === 1) return

  setUsersLoading(true)
  // Reset to first page (simplified)
  const { result, error, lastVisible } = await getUsers(pageSize)

  if (!error && result) {
    setUsers(result as User[])
    setLastDoc(lastVisible || null)
    setCurrentPage(1)
  }

  setUsersLoading(false)
}
```

### 3. Handle Status Toggle
```typescript
const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
  const newStatus = !currentStatus

  try {
    const { error } = await updateUser(userId, { isActive: newStatus })

    if (!error) {
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, isActive: newStatus } : u
        )
      )
      toast.success(`User berhasil di${newStatus ? "aktifkan" : "nonaktifkan"}`)
    }
  } catch (err) {
    toast.error("Gagal mengubah status user")
  }
}
```

### 4. Reload Users
```typescript
const reloadUsers = async () => {
  setUsersLoading(true)
  const { result, error, lastVisible } = await getUsers(pageSize)

  if (!error && result) {
    setUsers(result as User[])
    setLastDoc(lastVisible || null)
    setCurrentPage(1)

    // Update count
    const { count } = await getUsersCount()
    setTotalUsers(count)
    setTotalPages(Math.ceil(count / pageSize))
  }

  setUsersLoading(false)
}
```

## Toast Notifications

### Success Messages:
- User berhasil diaktifkan
- User berhasil dinonaktifkan

### Error Messages:
- Gagal memuat data users
- Gagal mengubah status user

## Statistics Display

### Total User Count
Menampilkan total users di:
1. Card "Total User" - dashboard stats
2. Table header - "Total: X users"
3. Automatically updates setelah add/remove user

## Pagination Logic

1. **Page Size**: 10 users per page
2. **Total Pages**: Calculated from total count / page size
3. **Current Page**: Track current page number
4. **Last Document**: Firestore document snapshot untuk cursor-based pagination
5. **Navigation**:
   - Previous: Disabled di page 1
   - Next: Disabled di last page atau no more docs

## Notes

### Limitations:
1. Previous button currently resets to page 1 (simplified implementation)
2. Full bidirectional pagination would require storing document snapshots for each page

### Future Improvements:
- Full bidirectional pagination
- Search/filter functionality
- Bulk actions (activate/deactivate multiple users)
- User editing modal
- User deletion

## Usage Example

1. **View Users**:
   - Dashboard loads → Users table displays first 10 users
   - Shows: Name, joining date, active status, edit button

2. **Navigate Pages**:
   - Click "Next" → Load next 10 users
   - Click "Previous" → Back to page 1

3. **Toggle Status**:
   - Click switch → User status changes in Firestore
   - Toast notification appears
   - Switch updates instantly

4. **Add New User**:
   - Fill form → Add user → Users table refreshes
   - New user appears at top of list
   - Total count updates
