import { Resource } from '@/types/resource';
import { uploadFileToChatkuAPI, validateFile } from '@/lib/utils/file-upload.utils';

/**
 * Compress image before upload
 */
async function compressImage(file: File, maxSizeMB = 1): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        const maxDimension = 1024;
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

/**
 * Upload group avatar to Chatku Asset Server
 */
export async function uploadGroupAvatar(
  groupId: string,
  file: File
): Promise<Resource<string>> {
  try {
    // Validate file
    const validationError = validateFile(file, {
      maxSizeMB: 5,
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    });

    if (validationError) {
      return Resource.error(validationError);
    }

    // Compress image
    const compressedFile = await compressImage(file);

    // Upload to Chatku asset server
    const uploadResult = await uploadFileToChatkuAPI(compressedFile);

    if (uploadResult.status === 'success' && uploadResult.data) {
      return Resource.success(uploadResult.data);
    } else {
      const errorMsg = uploadResult.status === 'error' ? uploadResult.message : 'Failed to upload image';
      return Resource.error(errorMsg || 'Failed to upload image');
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    return Resource.error(error.message || 'Failed to upload image');
  }
}

/**
 * Delete group avatar
 * Note: Chatku Asset Server does not provide delete endpoint
 * This function is kept for backward compatibility but does nothing
 */
export async function deleteGroupAvatar(avatarUrl: string): Promise<Resource<void>> {
  // Chatku Asset Server doesn't support file deletion via API
  // Files are managed on the server side
  // Return success to maintain backward compatibility
  return Resource.success(undefined);
}
