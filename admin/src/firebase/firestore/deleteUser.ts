import firebase_app from "../config";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

// Get the Firestore instance
const db = getFirestore(firebase_app);

// Function to delete a user document from Firestore and Firebase Authentication
export default async function deleteUser(userId: string) {
  let result = null;
  let error = null;

  try {
    // First, delete the user document from Firestore
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);

    // Then, delete the user from Firebase Authentication via API
    try {
      const response = await fetch('/api/deleteAuthUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error deleting user from Authentication:", errorData);
        // Continue even if auth deletion fails, since Firestore deletion succeeded
      }
    } catch (authError) {
      console.error("Error calling delete auth API:", authError);
      // Continue even if auth deletion fails, since Firestore deletion succeeded
    }

    result = { success: true };
  } catch (e) {
    error = e;
    console.error("Error deleting user:", e);
  }

  return { result, error };
}
