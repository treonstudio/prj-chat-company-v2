import firebase_app from "../config";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import addData from "../firestore/addData";

// Get the authentication instance using the Firebase app
const auth = getAuth(firebase_app);

// Function to create a new user with email and password and save to Firestore
export default async function createUser(email: string, password: string, additionalData?: any) {
  let result = null;
  let error = null;

  try {
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    result = userCredential;

    // Save additional user data to Firestore
    if (userCredential.user) {
      const userData = {
        email: email,
        createdAt: serverTimestamp(), // Use Firestore server timestamp
        isActive: true,
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
  } catch (e) {
    error = e;
  }

  return { result, error };
}
