import { Resource } from '@/types/resource';

/**
 * Chatku Asset Upload API Configuration
 */
const CHATKU_ASSET_API_URL = 'https://chatku-asset.treonstudio.com/upload';

/**
 * Response from Chatku asset upload API
 */
interface UploadResponse {
  status: 'success' | 'error';
  code: number;
  message: string;
  data: {
    url: string;
  } | null;
}

/**
 * Upload file to Chatku asset server
 * @param file - The file to upload (image, video, or document)
 * @param onProgress - Optional callback for upload progress (0-100)
 * @param abortSignal - Optional AbortSignal to cancel the upload
 * @param timeoutMs - Timeout in milliseconds (default: 120000ms = 2 minutes)
 * @returns Resource with the uploaded file URL
 */
export async function uploadFileToChatkuAPI(
  file: File,
  onProgress?: (progress: number) => void,
  abortSignal?: AbortSignal,
  timeoutMs: number = 120000 // 2 minutes default timeout
): Promise<Resource<string>> {
  try {
    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      let timeoutId: NodeJS.Timeout | null = null;

      // Set timeout to prevent hanging uploads
      timeoutId = setTimeout(() => {
        xhr.abort();
        resolve(Resource.error('Upload timeout - network connection too slow or server not responding'));
      }, timeoutMs);

      // Listen to abort signal
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          if (timeoutId) clearTimeout(timeoutId);
          xhr.abort();
        });
      }

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            onProgress(percentComplete);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        // Clear timeout on successful load
        if (timeoutId) clearTimeout(timeoutId);

        if (xhr.status === 200) {
          try {
            const result: UploadResponse = JSON.parse(xhr.responseText);
            if (result.status === 'success' && result.data?.url) {
              resolve(Resource.success(result.data.url));
            } else {
              resolve(Resource.error(result.message || 'Upload failed'));
            }
          } catch (error) {
            resolve(Resource.error('Failed to parse server response'));
          }
        } else {
          resolve(Resource.error(`Upload failed with status: ${xhr.status}`));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(Resource.error('Network error occurred during upload'));
      });

      xhr.addEventListener('abort', () => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(Resource.error('Upload cancelled'));
      });

      // Send request
      xhr.open('POST', CHATKU_ASSET_API_URL);
      xhr.send(formData);
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return Resource.error(error.message || 'Failed to upload file');
  }
}

/**
 * Upload file with retry logic
 * @param file - The file to upload
 * @param onProgress - Optional callback for upload progress
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Resource with the uploaded file URL
 */
export async function uploadFileWithRetry(
  file: File,
  onProgress?: (progress: number) => void,
  maxRetries: number = 3
): Promise<Resource<string>> {
  let lastError: string = 'Upload failed';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await uploadFileToChatkuAPI(file, onProgress);

    if (result.status === 'success') {
      return result;
    }

    lastError = result.status === 'error' ? result.message : 'Upload failed';

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return Resource.error(lastError);
}

/**
 * Validate file before upload
 * @param file - The file to validate
 * @param options - Validation options
 * @returns Error message if validation fails, null if valid
 */
export function validateFile(
  file: File,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  }
): string | null {
  // Check file size
  if (options?.maxSizeMB) {
    const maxSize = options.maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      return `File is too large. Maximum size is ${options.maxSizeMB}MB.`;
    }
  }

  // Check file type
  if (options?.allowedTypes && options.allowedTypes.length > 0) {
    if (!options.allowedTypes.includes(file.type)) {
      const types = options.allowedTypes.map(t => t.split('/')[1]).join(', ');
      return `Invalid file type. Allowed types: ${types}`;
    }
  }

  return null;
}
