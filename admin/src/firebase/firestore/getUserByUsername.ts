import firebase_app from "../config";
import * as firestore from "firebase/firestore";

// Function to get user by username
export default async function getUserByUsername(username: string) {
  let result = null;
  let error = null;

  try {
    console.log("[getUserByUsername] Starting with username:", username);

    // Get Firestore instance
    const db = firestore.getFirestore(firebase_app);

    // Create collection reference
    const usersCol = firestore.collection(db, "users");

    // Query for user with matching username
    const q = firestore.query(
      usersCol,
      firestore.where("username", "==", username),
      firestore.limit(1)
    );

    console.log("[getUserByUsername] Executing query...");
    const querySnapshot = await firestore.getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      result = {
        id: doc.id,
        ...doc.data(),
      };
      console.log("[getUserByUsername] User found:", result);
    } else {
      console.log("[getUserByUsername] No user found with username:", username);
    }
  } catch (e) {
    console.error("[getUserByUsername] ERROR:", e);
    error = e;
  }

  return { result, error };
}
