import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, Auth } from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import addData from "../firestore/addData";
import uploadPhoto from "../storage/uploadPhoto"; // Now uses Chatku Asset Server API

// Firebase configuration - same as main app
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // Keep for backward compatibility
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
      // Upload photo if provided
      let imageURL = null;
      if (additionalData?.photoFile) {
        console.log("Starting photo upload for user:", userCredential.user.uid);
        const { result: uploadResult, error: uploadError } = await uploadPhoto(
          additionalData.photoFile,
          userCredential.user.uid
        );

        if (uploadError) {
          console.error("Error uploading photo:", uploadError);
          // Don't fail user creation if photo upload fails, but log it
        } else if (uploadResult) {
          imageURL = uploadResult;
          console.log("Photo uploaded successfully, URL:", imageURL);
        } else {
          console.warn("Photo upload returned no result and no error");
        }
      }

      // Remove photoFile from additionalData before saving to Firestore
      const { photoFile, ...restAdditionalData } = additionalData || {};

      const userData = {
        username: username, // Store the actual username
        email: email, // Store the generated email
        createdAt: serverTimestamp(), // Use Firestore server timestamp
        isActive: true,
        isDeleted: false, // User is not deleted by default
        role: additionalData?.role || "user", // Default role is "user", can be overridden
        ...(imageURL && { imageURL }), // Add imageURL only if it exists
        ...restAdditionalData,
      };

      console.log("Saving user data to Firestore:", {
        ...userData,
        createdAt: "[serverTimestamp]",
        hasImageURL: !!imageURL,
        imageURL: imageURL || "not set"
      });

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
