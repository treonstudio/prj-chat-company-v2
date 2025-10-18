import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { Resource } from '@/types/resource';

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
 * Upload group avatar to Firebase Storage
 */
export async function uploadGroupAvatar(
  groupId: string,
  file: File
): Promise<Resource<string>> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return Resource.error('Please select an image file');
    }

    // Validate file size (max 5MB before compression)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return Resource.error('Image size must be less than 5MB');
    }

    // Compress image
    const compressedFile = await compressImage(file);

    // Create storage reference
    const timestamp = Date.now();
    const fileName = `group_${groupId}_${timestamp}.jpg`;
    const storageRef = ref(storage(), `group-avatars/${fileName}`);

    // Upload file
    await uploadBytes(storageRef, compressedFile);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    return Resource.success(downloadURL);
  } catch (error: any) {
    console.error('Upload error:', error);
    return Resource.error(error.message || 'Failed to upload image');
  }
}

/**
 * Delete group avatar from Firebase Storage
 */
export async function deleteGroupAvatar(avatarUrl: string): Promise<Resource<void>> {
  try {
    // Extract file path from URL
    const fileRef = ref(storage(), avatarUrl);
    await deleteObject(fileRef);
    return Resource.success(undefined);
  } catch (error: any) {
    // It's okay if file doesn't exist
    if (error.code === 'storage/object-not-found') {
      return Resource.success(undefined);
    }
    return Resource.error(error.message || 'Failed to delete image');
  }
}
