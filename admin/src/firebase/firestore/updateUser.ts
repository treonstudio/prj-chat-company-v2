import firebase_app from "../config";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

// Get the Firestore instance
const db = getFirestore(firebase_app);

// Function to update user data
export default async function updateUser(userId: string, data: any) {
  let result = null;
  let error = null;

  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, data);
    result = { success: true };
  } catch (e) {
    error = e;
  }

  return { result, error };
}
