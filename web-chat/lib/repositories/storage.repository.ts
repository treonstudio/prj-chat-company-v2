import { Resource } from '@/types/resource';
import { uploadFileToChatkuAPI, validateFile } from '@/lib/utils/file-upload.utils';

export class StorageRepository {
  private readonly PROFILE_IMAGES_PATH = 'profile_images';
  private readonly GROUP_AVATARS_PATH = 'group_avatars';

  /**
   * Upload avatar image to Chatku Asset Server
   * @param userId - The user ID (not used in new API, kept for backward compatibility)
   * @param file - The image file to upload
   * @param maxSizeInMB - Maximum file size in MB (optional, for extra validation)
   * @param onProgress - Optional callback for upload progress (0-100)
   * @returns Resource with the download URL
   */
  async uploadAvatar(userId: string, file: File, maxSizeInMB?: number, onProgress?: (progress: number) => void): Promise<Resource<string>> {
    try {
      // Validate file
      const validationError = validateFile(file, {
        maxSizeMB: maxSizeInMB || 10,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      });

      if (validationError) {
        return Resource.error(validationError);
      }

      // Upload to Chatku asset server with progress tracking
      const uploadResult = await uploadFileToChatkuAPI(file, onProgress);

      if (uploadResult.status === 'success' && uploadResult.data) {
        return Resource.success(uploadResult.data);
      } else {
        const errorMsg = uploadResult.status === 'error' ? uploadResult.message : 'Failed to upload avatar';
        return Resource.error(errorMsg || 'Failed to upload avatar');
      }
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to upload avatar');
    }
  }

  /**
   * Upload group avatar image to Chatku Asset Server
   * @param chatId - The group chat ID (not used in new API, kept for backward compatibility)
   * @param file - The image file to upload
   * @param maxSizeInMB - Maximum file size in MB (optional, for extra validation)
   * @returns Resource with the download URL
   */
  async uploadGroupAvatar(chatId: string, file: File, maxSizeInMB?: number): Promise<Resource<string>> {
    try {
      // Validate file
      const validationError = validateFile(file, {
        maxSizeMB: maxSizeInMB || 10,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      });

      if (validationError) {
        return Resource.error(validationError);
      }

      // Upload to Chatku asset server
      const uploadResult = await uploadFileToChatkuAPI(file);

      if (uploadResult.status === 'success' && uploadResult.data) {
        return Resource.success(uploadResult.data);
      } else {
        const errorMsg = uploadResult.status === 'error' ? uploadResult.message : 'Failed to upload group avatar';
        return Resource.error(errorMsg || 'Failed to upload group avatar');
      }
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to upload group avatar');
    }
  }

  /**
   * Delete avatar image
   * Note: Chatku Asset Server does not provide delete endpoint
   * This function is kept for backward compatibility but does nothing
   * @param imageUrl - The full URL of the image to delete
   * @returns Resource indicating success or failure
   */
  async deleteAvatar(imageUrl: string): Promise<Resource<void>> {
    // Chatku Asset Server doesn't support file deletion via API
    // Files are managed on the server side
    // Return success to maintain backward compatibility
    return Resource.success(undefined);
  }
}
