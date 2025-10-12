import firebase_app from "../config";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Function to retrieve max file size from Firebase usageControls collection
export default async function getMaxFileSize() {
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
      // Get maxFileSizeUploadedInMB from the document
      result = data.maxFileSizeUploadedInMB ?? 64;
    } else {
      // Return default value if document doesn't exist
      result = 64;
    }
  } catch (e) {
    error = e;
    console.error("Error in getMaxFileSize:", e);
  }

  return { result, error };
}
