import firebase_app from "../config";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

// Get the Firestore instance
const db = getFirestore(firebase_app);

// Function to delete a user document from Firestore
export default async function deleteUser(userId: string) {
  let result = null;
  let error = null;

  try {
    // Reference to the user document
    const userRef = doc(db, "users", userId);

    // Delete the document
    await deleteDoc(userRef);
    result = { success: true };
  } catch (e) {
    error = e;
    console.error("Error deleting user:", e);
  }

  return { result, error };
}
