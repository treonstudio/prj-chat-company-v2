import firebase_app from "../config";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export interface UsageControls {
  allowCall: boolean;
  allowChat: boolean;
  allowCreateGroup: boolean;
}

// Function to retrieve usage controls from Firebase
export default async function getUsageControls() {
  let result = null;
  let error = null;

  try {
    // Get the Firestore instance inside the function to ensure it's initialized
    const db = getFirestore(firebase_app);

    // Reference to the specific document in appConfigs/features
    const docRef = doc(db, "appConfigs", "features");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Get values directly from root fields
      result = {
        allowCall: data.allowCall ?? true,
        allowChat: data.allowChat ?? true,
        allowCreateGroup: data.allowCreateGroup ?? true,
      };
    } else {
      // Return default values if document doesn't exist
      result = {
        allowCall: true,
        allowChat: true,
        allowCreateGroup: true,
      };
    }
  } catch (e) {
    error = e;
    console.error("Error in getUsageControls:", e);
  }

  return { result, error };
}
