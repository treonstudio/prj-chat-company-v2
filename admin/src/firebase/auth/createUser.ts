import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, Auth } from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import addData from "../firestore/addData";

// Firebase configuration - same as main app
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Create a secondary Firebase app instance specifically for user creation
// This prevents the admin from being logged out when creating a new user
let secondaryApp: any;
let secondaryAuth: Auth;

try {
  secondaryApp = initializeApp(firebaseConfig, "Secondary");
  secondaryAuth = getAuth(secondaryApp);
} catch (error: any) {
  // If app already exists, get the existing instance
  if (error.code === 'app/duplicate-app') {
    const { getApp } = require("firebase/app");
    secondaryApp = getApp("Secondary");
    secondaryAuth = getAuth(secondaryApp);
  } else {
    throw error;
  }
}

// Function to create a new user with username and password and save to Firestore
export default async function createUser(username: string, password: string, additionalData?: any) {
  let result = null;
  let error = null;

  try {
    // Generate a unique email from username for Firebase Auth
    // Firebase Auth requires email, so we create a pseudo-email
    const email = `${username}@chatapp.com`;

    // Create user in Firebase Authentication using secondary auth instance
    // This prevents the current admin session from being logged out
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    result = userCredential;

    // Save additional user data to Firestore
    if (userCredential.user) {
      const userData = {
        username: username, // Store the actual username
        email: email, // Store the generated email
        createdAt: serverTimestamp(), // Use Firestore server timestamp
        isActive: true,
        role: additionalData?.role || "user", // Default role is "user", can be overridden
        ...additionalData,
      };

      const { error: firestoreError } = await addData(
        "users",
        userCredential.user.uid,
        userData
      );

      if (firestoreError) {
        console.error("Error saving user data to Firestore:", firestoreError);
        // Note: User is created in Auth but data not saved to Firestore
      }
    }

    // Sign out from the secondary auth instance to clean up
    await secondaryAuth.signOut();
  } catch (e) {
    error = e;
  }

  return { result, error };
}
