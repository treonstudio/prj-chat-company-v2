import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { Resource } from '@/types/resource';

export class StorageRepository {
  private readonly PROFILE_IMAGES_PATH = 'profile_images';

  /**
   * Upload avatar image to Firebase Storage
   * @param userId - The user ID
   * @param file - The image file to upload
   * @param maxSizeInMB - Maximum file size in MB (optional, for extra validation)
   * @returns Resource with the download URL
   */
  async uploadAvatar(userId: string, file: File, maxSizeInMB?: number): Promise<Resource<string>> {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return Resource.error('Please select a valid image file');
      }

      // Validate file size if maxSizeInMB is provided
      if (maxSizeInMB) {
        const maxSize = maxSizeInMB * 1024 * 1024;
        if (file.size > maxSize) {
          return Resource.error(`Image size must be less than ${maxSizeInMB}MB`);
        }
      }

      // Create a unique filename with timestamp
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const filename = `${timestamp}.${extension}`;
      const filePath = `${this.PROFILE_IMAGES_PATH}/${userId}/${filename}`;

      // Create storage reference
      const storageRef = ref(storage(), filePath);

      // Upload file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      return Resource.success(downloadURL);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to upload avatar');
    }
  }

  /**
   * Delete avatar image from Firebase Storage
   * @param imageUrl - The full URL of the image to delete
   * @returns Resource indicating success or failure
   */
  async deleteAvatar(imageUrl: string): Promise<Resource<void>> {
    try {
      // Extract the path from the URL
      const storageRef = ref(storage(), imageUrl);
      await deleteObject(storageRef);
      return Resource.success(undefined);
    } catch (error: any) {
      // If file doesn't exist, consider it a success
      if (error.code === 'storage/object-not-found') {
        return Resource.success(undefined);
      }
      return Resource.error(error.message || 'Failed to delete avatar');
    }
  }
}
