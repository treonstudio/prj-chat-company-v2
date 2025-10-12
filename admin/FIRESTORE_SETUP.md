# Firestore Setup for Username Authentication

## Overview
The application has been updated to use username-based authentication instead of email-based authentication.

## Changes Made

1. **Authentication Flow**:
   - Users now login with username instead of email
   - Firebase Auth still uses email internally (generated as `username@chatzy.local`)
   - Firestore stores the actual username in the `users` collection

2. **Data Structure**:
   ```
   users/{userId}
   ├── username: string (the actual username)
   ├── email: string (generated email for Firebase Auth)
   ├── displayName: string
   ├── createdAt: timestamp
   └── isActive: boolean
   ```

## Required Firestore Setup

### Create Composite Index

You need to create a composite index in Firestore for the `users` collection to support username queries.

**Option 1: Via Firebase Console**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database → Indexes
4. Click "Create Index"
5. Configure the index:
   - Collection ID: `users`
   - Fields to index:
     - `username` - Ascending
   - Query scope: Collection

**Option 2: Via CLI**
If you have a `firestore.indexes.json` file, add this configuration:
```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "username",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
```

Then deploy with:
```bash
firebase deploy --only firestore:indexes
```

**Option 3: Auto-create via Error**
1. Run the application and try to login
2. Check the browser console for a Firestore index URL
3. Click the URL to automatically create the required index
4. Wait a few minutes for the index to build

## Testing

After setting up the index:

1. **Create a test user** via Dashboard:
   - Go to `/dashboard`
   - Add a new user with username (e.g., `testuser`) and password

2. **Test login** via Signin page:
   - Go to `/signin`
   - Enter the username and password
   - Should successfully login and redirect to dashboard

## Username Validation Rules

- Minimum 3 characters
- Only letters, numbers, and underscores allowed
- Pattern: `/^[a-zA-Z0-9_]+$/`

## Migration Notes

If you have existing users with email-based authentication:

1. You'll need to migrate them by adding a `username` field
2. You can create a migration script or manually update each user document in Firestore
3. Example migration script:
   ```javascript
   // Run this once to migrate existing users
   const migrateUsers = async () => {
     const usersSnapshot = await getDocs(collection(db, 'users'));

     for (const doc of usersSnapshot.docs) {
       const data = doc.data();
       if (!data.username && data.email) {
         // Generate username from email
         const username = data.email.split('@')[0];
         await updateDoc(doc.ref, { username });
       }
     }
   };
   ```

## Security Rules

Make sure your Firestore security rules allow username queries:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Allow read by username (for login)
      allow read: if request.auth != null;

      // Allow write only for authenticated users
      allow write: if request.auth != null;
    }
  }
}
```

## Troubleshooting

**Error: "The query requires an index"**
- Follow the URL in the error message to create the index
- Wait 5-10 minutes for the index to build

**Error: "Username tidak ditemukan"**
- Make sure the user was created after the username system was implemented
- Check that the user document has a `username` field in Firestore

**Error: "auth/email-already-in-use"**
- This means a username is already taken
- Usernames must be unique across the system
