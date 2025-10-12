import firebase_app from "../config";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Function to update max file size in Firebase usageControls collection
export default async function updateMaxFileSize(maxFileSize: number) {
  let result = null;
  let error = null;

  try {
    // Get the Firestore instance inside the function to ensure it's initialized
    const db = getFirestore(firebase_app);

    // Reference to the document in appConfigs/usageControls
    const docRef = doc(db, "appConfigs", "usageControls");

    // Update maxFileSizeUploadedInMB field, merging with existing data
    result = await setDoc(
      docRef,
      {
        maxFileSizeUploadedInMB: maxFileSize,
      },
      { merge: true }
    );
  } catch (e) {
    error = e;
    console.error("Error in updateMaxFileSize:", e);
  }

  return { result, error };
}
