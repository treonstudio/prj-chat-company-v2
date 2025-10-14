import firebase_app from "../config";
import * as firestore from "firebase/firestore";

// Interface for user data
interface UserData {
  id: string;
  email?: string;
  username?: string;
  displayName?: string;
  createdAt?: any;
  isActive?: boolean;
  role?: string;
  [key: string]: any;
}

// Cache untuk menyimpan semua users yang sudah di-sort
let sortedUsersCache: UserData[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5000; // 5 seconds

// Function to get all users, sorted
async function getAllUsersSorted(excludeUserId?: string): Promise<UserData[]> {
  // Check if cache is still valid
  const now = Date.now();
  if (sortedUsersCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return sortedUsersCache;
  }

  // Get Firestore instance
  const db = firestore.getFirestore(firebase_app);
  const usersCol = firestore.collection(db, "users");

  // Fetch all users
  const querySnapshot = await firestore.getDocs(usersCol);

  // Map and filter out excluded user
  const allUsers: UserData[] = querySnapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as UserData))
    .filter((user) => !excludeUserId || user.id !== excludeUserId);

  // Sort in memory by createdAt descending
  allUsers.sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
    return dateB - dateA; // desc order
  });

  // Update cache
  sortedUsersCache = allUsers;
  cacheTimestamp = now;

  return allUsers;
}

// Function to invalidate cache (call this after adding/deleting users)
export function invalidateUsersCache() {
  sortedUsersCache = null;
  cacheTimestamp = 0;
}

// Function to get users with pagination
export async function getUsers(pageSize: number = 10, lastDoc?: firestore.DocumentSnapshot, excludeUserId?: string) {
  let result: UserData[] = [];
  let error = null;
  let lastVisible: firestore.DocumentSnapshot | null = null;

  try {
    // Get all users sorted
    const allUsers = await getAllUsersSorted(excludeUserId);

    // If lastDoc is provided, find the index and paginate from there
    let startIndex = 0;
    if (lastDoc) {
      const lastDocId = lastDoc.id;
      const lastIndex = allUsers.findIndex(user => user.id === lastDocId);
      startIndex = lastIndex + 1;
    }

    // Get the page of users
    result = allUsers.slice(startIndex, startIndex + pageSize);

    // Set lastVisible - we'll use a mock document with just the ID
    // since we're doing in-memory pagination
    if (result.length > 0) {
      const lastUser = result[result.length - 1];
      lastVisible = { id: lastUser.id } as any;
    }
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
