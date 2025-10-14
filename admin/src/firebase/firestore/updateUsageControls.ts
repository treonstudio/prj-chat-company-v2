import firebase_app from "../config";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { UsageControls } from "./getUsageControls";

// Function to update usage controls in Firebase
export default async function updateUsageControls(usageControls: UsageControls) {
  let result = null;
  let error = null;

  try {
    // Get the Firestore instance inside the function to ensure it's initialized
    const db = getFirestore(firebase_app);

    // Reference to the specific document in appConfigs/features
    const docRef = doc(db, "appConfigs", "features");

    // Update fields directly at root level, merging with existing data
    result = await setDoc(
      docRef,
      {
        allowCall: usageControls.allowCall,
        allowSendText: usageControls.allowSendText,
        allowSendMedia: usageControls.allowSendMedia,
      },
      { merge: true }
    );
  } catch (e) {
    error = e;
    console.error("Error in updateUsageControls:", e);
  }

  return { result, error };
}
