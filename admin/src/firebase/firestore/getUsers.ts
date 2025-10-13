import firebase_app from "../config";
import * as firestore from "firebase/firestore";

// Function to get users with pagination
export async function getUsers(pageSize: number = 10, lastDoc?: firestore.DocumentSnapshot, excludeUserId?: string) {
  let result: any[] = [];
  let error = null;
  let lastVisible = null;

  try {
    // Get Firestore instance
    const db = firestore.getFirestore(firebase_app);

    // Create collection reference
    const usersCol = firestore.collection(db, "users");

    // Simple query without orderBy (to avoid index requirement)
    let q;

    if (lastDoc) {
      q = firestore.query(
        usersCol,
        firestore.startAfter(lastDoc),
        firestore.limit(pageSize)
      );
    } else {
      q = firestore.query(usersCol, firestore.limit(pageSize));
    }

    const querySnapshot = await firestore.getDocs(q);

    result = querySnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((user) => !excludeUserId || user.id !== excludeUserId); // Exclude current user if specified

    // Sort in memory by createdAt descending
    result.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // desc order
    });

    // Get last visible document for pagination
    lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
  } catch (e) {
    console.error("[getUsers] ERROR:", e);
    error = e;
  }

  return { result, error, lastVisible };
}

// Function to get total count of users
export async function getUsersCount(excludeUserId?: string) {
  let count = 0;
  let error = null;

  try {
    // Get Firestore instance
    const db = firestore.getFirestore(firebase_app);
    const usersRef = firestore.collection(db, "users");

    const querySnapshot = await firestore.getDocs(usersRef);

    if (excludeUserId) {
      // Count all users except the excluded one
      count = querySnapshot.docs.filter(doc => doc.id !== excludeUserId).length;
    } else {
      count = querySnapshot.size;
    }
  } catch (e) {
    console.error("[getUsersCount] ERROR:", e);
    error = e;
  }

  return { count, error };
}
