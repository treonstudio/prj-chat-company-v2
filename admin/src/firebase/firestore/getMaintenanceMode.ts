import firebase_app from "../config";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Function to retrieve maintenance mode from Firebase usageControls collection
export default async function getMaintenanceMode() {
  let result = null;
  let error = null;

  try {
    // Get the Firestore instance inside the function to ensure it's initialized
    const db = getFirestore(firebase_app);

    // Reference to the document in appConfigs/usageControls
    const docRef = doc(db, "appConfigs", "usageControls");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Get isMaintaince from the document
      result = data.isMaintaince ?? false;
    } else {
      // Return default value if document doesn't exist
      result = false;
    }
  } catch (e) {
    error = e;
    console.error("Error in getMaintenanceMode:", e);
  }

  return { result, error };
}
