import firebase_app from "../config";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Function to update maintenance mode in Firebase usageControls collection
export default async function updateMaintenanceMode(isMaintaince: boolean) {
  let result = null;
  let error = null;

  try {
    // Get the Firestore instance inside the function to ensure it's initialized
    const db = getFirestore(firebase_app);

    // Reference to the document in appConfigs/usageControls
    const docRef = doc(db, "appConfigs", "usageControls");

    // Update isMaintaince field, merging with existing data
    result = await setDoc(
      docRef,
      {
        isMaintaince: isMaintaince,
      },
      { merge: true }
    );
  } catch (e) {
    error = e;
    console.error("Error in updateMaintenanceMode:", e);
  }

  return { result, error };
}
