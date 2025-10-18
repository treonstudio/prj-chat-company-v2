import firebase_app from "../config";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

// Get the Firestore instance
const db = getFirestore(firebase_app);

// Function to soft delete a user by setting isDeleted to true
export default async function deleteUser(userId: string) {
  let result = null;
  let error = null;

  try {
    // Soft delete: Update the user document to set isDeleted to true
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      isDeleted: true
    });

    result = { success: true };
  } catch (e) {
    error = e;
    console.error("Error soft deleting user:", e);
  }

  return { result, error };
}
