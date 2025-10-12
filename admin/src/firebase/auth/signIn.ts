import firebase_app from "../config";
import { signInWithEmailAndPassword, getAuth } from "firebase/auth";
import getUserByUsername from "../firestore/getUserByUsername";

// Get the authentication instance using the Firebase app
const auth = getAuth(firebase_app);

// Function to sign in with username and password (admin only)
export default async function signIn(username: string, password: string) {
  let result = null, // Variable to store the sign-in result
    error = null; // Variable to store any error that occurs

  try {
    // First, get the user from Firestore by username to retrieve the email
    const { result: userData, error: getUserError } = await getUserByUsername(username);

    if (getUserError) {
      throw getUserError;
    }

    // Type assertion for userData with email and role fields
    const userWithData = userData as { id: string; email?: string; role?: string } | null;

    if (!userWithData || !userWithData.email) {
      // If user not found, create a custom error similar to Firebase auth errors
      const notFoundError: any = new Error("User not found");
      notFoundError.code = "auth/user-not-found";
      throw notFoundError;
    }

    // Check if user has admin role
    if (userWithData.role !== "admin") {
      const notAdminError: any = new Error("Access denied. Admin role required.");
      notAdminError.code = "auth/access-denied";
      throw notAdminError;
    }

    // Now sign in with the email associated with this username
    result = await signInWithEmailAndPassword(auth, userWithData.email, password);
  } catch (e) {
    error = e; // Catch and store any error that occurs during sign-in
  }

  return { result, error }; // Return the sign-in result and error (if any)
}
