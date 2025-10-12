# Role-Based Authentication System

## Overview
Sistem authentication telah ditambahkan fitur role-based access control (RBAC). Hanya user dengan role **admin** yang dapat login dan mengakses dashboard admin.

## Roles Available

- **user** (default) - User biasa, tidak dapat login ke dashboard admin
- **admin** - Administrator, memiliki akses penuh ke dashboard admin

## How It Works

### 1. User Creation
Saat membuat user baru di dashboard:
- Admin dapat memilih role: **User** atau **Admin**
- Default role adalah **User**
- Role disimpan di Firestore collection `users`

### 2. Login Process
Saat user mencoba login:
1. System mencari username di Firestore
2. System memeriksa field `role`
3. Jika role ≠ "admin", login ditolak dengan error:
   ```
   "Akses ditolak. Hanya admin yang dapat login."
   ```
4. Jika role = "admin", proses login dilanjutkan dengan Firebase Auth

### 3. Dashboard Protection
Saat user mengakses dashboard:
1. System memeriksa authentication status
2. System fetch user data dari Firestore
3. System verifikasi field `role`
4. Jika role ≠ "admin", user di-redirect ke `/signin`

## Implementation Details

### File Changes

1. **`/src/firebase/auth/createUser.ts`**
   - Menambahkan field `role` dengan default value "user"
   - Role dapat di-override via parameter `additionalData`

2. **`/src/firebase/auth/signIn.ts`**
   - Menambahkan validasi role sebelum sign in
   - Throw error `auth/access-denied` jika role bukan admin

3. **`/src/firebase/firestore/getUserData.ts`** (NEW)
   - Helper function untuk mendapatkan user data dari Firestore by user ID

4. **`/src/app/signin/page.tsx`**
   - Menambahkan error handling untuk `auth/access-denied`
   - Menampilkan pesan error yang jelas

5. **`/src/app/dashboard/page.tsx`**
   - Menambahkan role verification di useEffect
   - Menambahkan dropdown select untuk memilih role saat create user
   - Menambahkan kolom ROLE di tabel users
   - Menampilkan badge untuk role (Admin = purple, User = blue)

### Data Structure

```typescript
// Firestore: users/{userId}
{
  username: string,
  email: string,
  displayName: string,
  createdAt: timestamp,
  isActive: boolean,
  role: "user" | "admin"  // <- NEW FIELD
}
```

## Creating First Admin User

### Method 1: Via Firebase Console (Recommended)
1. Buka Firebase Console → Firestore Database
2. Buat user pertama secara manual:
   ```
   Collection: users
   Document ID: (auto-generate atau manual)
   Fields:
   - username: "admin"
   - email: "admin@chatzy.local"
   - role: "admin"
   - isActive: true
   - createdAt: (use server timestamp)
   ```
3. Buat user di Firebase Authentication:
   - Email: `admin@chatzy.local`
   - Password: (set password)
   - Copy UID dari Authentication
4. Update Document ID di Firestore dengan UID yang sama

### Method 2: Temporary Admin Creation Script
Buat file temporary untuk membuat admin pertama:

```typescript
// scripts/createFirstAdmin.ts
import createUser from "@/firebase/auth/createUser";

async function createFirstAdmin() {
  const { result, error } = await createUser("admin", "admin123", {
    displayName: "Administrator",
    role: "admin"
  });

  if (error) {
    console.error("Error creating admin:", error);
  } else {
    console.log("Admin created successfully:", result);
  }
}

createFirstAdmin();
```

### Method 3: Via Dashboard (After First Login)
Setelah admin pertama sudah ada:
1. Login dengan akun admin
2. Pergi ke Dashboard
3. Klik "Tambah User Baru"
4. Isi form:
   - Username: (pilih username)
   - Password: (pilih password)
   - Role: Pilih **Admin**
5. Klik "Tambah User"

## Testing

### Test Case 1: Admin Login (Success)
1. Buat user dengan role "admin"
2. Login dengan username dan password
3. ✅ Harus berhasil dan redirect ke dashboard

### Test Case 2: Regular User Login (Denied)
1. Buat user dengan role "user"
2. Login dengan username dan password
3. ❌ Harus ditolak dengan error: "Akses ditolak. Hanya admin yang dapat login."

### Test Case 3: Dashboard Access Protection
1. Login sebagai non-admin user (manipulasi manual)
2. Akses `/dashboard`
3. ❌ Harus otomatis redirect ke `/signin`

## UI Features

### Add User Form
- **Role Dropdown**: Memilih role (User/Admin)
- Default: "User"
- Location: Dashboard → "Tambah User Baru" form

### Users Table
- **ROLE Column**: Menampilkan badge role
  - Admin: Purple badge
  - User: Blue badge
- **NAME Column**: Menampilkan username (priority), atau displayName, atau email

## Security Notes

⚠️ **Important Security Considerations:**

1. **Firestore Security Rules**: Update rules untuk protect role field
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         // Allow read for authenticated users
         allow read: if request.auth != null;

         // Only allow writes from admin or self
         allow write: if request.auth != null && (
           request.auth.uid == userId ||
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
         );

         // Prevent role escalation - only existing admin can set role to admin
         allow update: if request.auth != null && (
           request.resource.data.role == resource.data.role ||
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
         );
       }
     }
   }
   ```

2. **Client-Side Validation**: Hanya mencegah akses UI, bukan data
3. **Server-Side Validation**: Gunakan Firebase Functions untuk validasi server-side jika diperlukan

## Migration Guide

Jika sudah ada user existing di database:

```typescript
// Migration script to add role field to existing users
import { getFirestore, collection, getDocs, updateDoc } from "firebase/firestore";

async function migrateExistingUsers() {
  const db = getFirestore();
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // If role doesn't exist, set default to "user"
    if (!data.role) {
      await updateDoc(doc.ref, {
        role: "user"
      });
      console.log(`Updated user ${doc.id} with role: user`);
    }
  }

  console.log("Migration completed!");
}

// Run migration
migrateExistingUsers();
```

## Troubleshooting

### Issue: "Akses ditolak. Hanya admin yang dapat login"
**Solution**: Pastikan user memiliki field `role: "admin"` di Firestore

### Issue: Redirect loop di dashboard
**Solution**: Pastikan user yang login memiliki role "admin" dan UID cocok dengan document ID di Firestore

### Issue: Role tidak tersimpan saat create user
**Solution**: Pastikan parameter `role` dikirim ke `createUser()` function

### Issue: Existing users tidak bisa login
**Solution**: Jalankan migration script untuk menambahkan field `role` ke semua user existing
