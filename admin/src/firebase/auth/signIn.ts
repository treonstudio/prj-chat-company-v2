import firebase_app from "../config";
import { signInWithEmailAndPassword, getAuth } from "firebase/auth";
import getUserByUsername from "../firestore/getUserByUsername";

// Get the authentication instance using the Firebase app
const auth = getAuth(firebase_app);

// Helper function to check if input is an email
function isEmail(input: string): boolean {
  // Simple email regex pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(input);
}

// Function to sign in with email/username and password (admin only)
export default async function signIn(emailOrUsername: string, password: string) {
  let result = null, // Variable to store the sign-in result
    error = null; // Variable to store any error that occurs

  try {
    let emailToUse = emailOrUsername;
    let userRole: string | undefined;

    // Check if input is an email or username
    if (isEmail(emailOrUsername)) {
      // Input is an email, try to sign in directly
      // But first, we need to check if this user is admin
      // We'll try to sign in first, then check the role
      const signInResult = await signInWithEmailAndPassword(auth, emailOrUsername, password);

      // Now check the user's role from Firestore
      const { getDoc, doc } = await import("firebase/firestore");
      const { getFirestore } = await import("firebase/firestore");
      const db = getFirestore(firebase_app);
      const userDoc = await getDoc(doc(db, "users", signInResult.user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        userRole = userData.role;

        // Check if user has admin role
        if (userRole !== "admin") {
          // Sign out the user since they're not admin
          await auth.signOut();
          const notAdminError: any = new Error("Access denied. Admin role required.");
          notAdminError.code = "auth/access-denied";
          throw notAdminError;
        }
      }

      result = signInResult;
    } else {
      // Input is a username, get the user from Firestore to retrieve the email
      const { result: userData, error: getUserError } = await getUserByUsername(emailOrUsername);

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
    }
  } catch (e) {
    error = e; // Catch and store any error that occurs during sign-in
  }

  return { result, error }; // Return the sign-in result and error (if any)
}
