import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import firebase_app from "../config";

const storage = getStorage(firebase_app);

/**
 * Upload a photo to Firebase Storage
 * @param file - The file to upload
 * @param userId - The user ID to use in the storage path
 * @returns The download URL of the uploaded photo
 */
export default async function uploadPhoto(file: File, userId: string) {
  let result = null;
  let error = null;

  try {
    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const filename = `${userId}_${timestamp}.${fileExtension}`;

    // Create a reference to the file location in Storage
    const storageRef = ref(storage, `profile-photos/${filename}`);

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    result = downloadURL;
  } catch (e) {
    console.error("Error uploading photo:", e);
    error = e;
  }

  return { result, error };
}
