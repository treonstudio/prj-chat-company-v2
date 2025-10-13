import firebase_app from "../config";
import * as firestore from "firebase/firestore";

// Function to get user data by user ID
export default async function getUserData(userId: string) {
  let result = null;
  let error = null;

  try {
    // Get Firestore instance
    const db = firestore.getFirestore(firebase_app);

    // Get document reference
    const docRef = firestore.doc(db, "users", userId);

    // Get document
    const docSnap = await firestore.getDoc(docRef);

    if (docSnap.exists()) {
      result = {
        id: docSnap.id,
        ...docSnap.data(),
      };
    }
  } catch (e) {
    console.error("[getUserData] ERROR:", e);
    error = e;
  }

  return { result, error };
}
