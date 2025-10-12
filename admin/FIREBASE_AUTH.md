# Firebase Authentication Integration

## Overview
Aplikasi admin ini telah terintegrasi dengan Firebase Authentication untuk login dan manajemen user.

## Fitur yang Telah Diimplementasikan

### 1. Login dengan Firebase Auth
- **File**: `src/app/signin/page.tsx`
- Login dengan email & password melalui Firebase Authentication
- Error handling lengkap untuk berbagai kasus:
  - User not found
  - Wrong password
  - Invalid email
  - Account disabled
  - Too many attempts
  - Invalid credentials

### 2. Add User ke Firebase
- **File**: `src/firebase/auth/createUser.ts`
- Fungsi untuk membuat user baru di Firebase Authentication
- Otomatis menyimpan data user ke Firestore collection "users"
- Data yang disimpan:
  - email
  - createdAt
  - isActive
  - displayName

### 3. Authentication Context
- **File**: `src/context/AuthContext.tsx`
- Mengelola state authentication global
- Menggunakan Firebase Authentication
- Menyediakan loading state
- Auto-detect authentication status

### 4. Protected Pages
Semua halaman dashboard dilindungi dengan auth check:
- `/dashboard` - Main dashboard
- `/dashboard/usage-control` - Usage control page
- `/admin` - Admin page

### 5. Form Tambah User (Dashboard)
- **File**: `src/app/dashboard/page.tsx`
- Form untuk menambah user baru
- Validasi:
  - Email format
  - Password minimal 6 karakter
  - Required fields
- Feedback visual (success/error messages)
- Loading state

## Cara Menggunakan

### Login
1. Buka http://localhost:3001/signin
2. Gunakan email dan password yang sudah terdaftar di Firebase Authentication
3. Jika belum punya akun, minta admin untuk menambahkan user melalui dashboard

### Menambah User Baru
1. Login ke dashboard
2. Di halaman dashboard, isi form "Tambah User Baru"
3. Masukkan email dan password (min. 6 karakter)
4. Klik "Tambah User"
5. User baru akan dibuat di Firebase Authentication dan Firestore

### Logout
1. Klik tombol "Logout" di sidebar
2. Akan redirect ke halaman signin

## Struktur Data Firestore

### Collection: `users`
```json
{
  "uid": {
    "email": "user@example.com",
    "displayName": "user",
    "createdAt": "2025-10-12T07:00:00.000Z",
    "isActive": true
  }
}
```

## Error Handling
Aplikasi memiliki error handling untuk:
- Firebase authentication errors
- Network errors
- Invalid credentials
- Rate limiting
- Firestore errors

## Security Notes
- Password minimal 6 karakter (Firebase requirement)
- Email validation
- Protected routes (redirect ke signin jika tidak terautentikasi)
- Logout functionality untuk clear Firebase session
- Semua user harus terdaftar di Firebase Authentication

## Testing
Server development berjalan di: http://localhost:3001

Untuk testing:
1. Pertama kali, buat user admin melalui Firebase Console atau gunakan fungsi signup
2. Test login dengan Firebase user
3. Test tambah user baru melalui dashboard
4. Test login dengan user yang baru dibuat
5. Test protected pages (coba akses tanpa login)
6. Test logout functionality

## Setup Awal
Untuk menggunakan aplikasi pertama kali:
1. Buat user pertama melalui Firebase Console (Authentication > Users > Add user)
2. Atau gunakan Firebase CLI untuk membuat user admin
3. Login menggunakan email dan password yang telah dibuat
4. Setelah login, gunakan form "Tambah User Baru" untuk menambah user lainnya
