import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Use environment variables
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const formattedPrivateKey = privateKey
      ? privateKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '')
      : undefined;

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedPrivateKey,
      }),
    });

    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase admin initialization error', error);
    throw error;
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;
