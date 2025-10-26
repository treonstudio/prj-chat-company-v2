import firebase_app from "../config";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

// Get the Firestore instance
const db = getFirestore(firebase_app);

// Function to hard delete a user from Firestore
export default async function deleteUser(userId: string) {
  let result = null;
  let error = null;

  try {
    // Hard delete: Delete the user document from Firestore
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);

    result = { success: true };
  } catch (e) {
    error = e;
    console.error("Error deleting user from Firestore:", e);
  }

  return { result, error };
}
