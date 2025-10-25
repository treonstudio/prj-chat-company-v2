/**
 * Upload a photo to Chatku Asset Server
 * Migrated from Firebase Storage to custom API endpoint
 * @param file - The file to upload
 * @param userId - The user ID (optional, for logging/tracking purposes)
 * @returns The download URL of the uploaded photo
 */

interface UploadResponse {
  status: 'success' | 'error';
  code: number;
  message: string;
  data: {
    url: string;
  } | null;
}

export default async function uploadPhoto(file: File, userId?: string) {
  let result = null;
  let error = null;

  try {
    console.log('=== Upload Photo Start ===');
    console.log('File name:', file.name);
    console.log('File type:', file.type);
    console.log('File size:', (file.size / 1024).toFixed(2), 'KB');
    if (userId) console.log('User ID:', userId);

    // Validate file type - only allow image formats
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only PNG, JPG, WEBP, and GIF are allowed.');
    }

    // Validate file size (max 10MB for images)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      throw new Error('File is too large. Maximum size is 10 MB.');
    }

    console.log('File validation passed');

    // Create FormData and append the file
    const formData = new FormData();
    formData.append('file', file);

    console.log('Uploading to Chatku Asset Server...');

    // Upload to Chatku asset server
    const response = await fetch('https://chatku-asset.treonstudio.com/upload', {
      method: 'POST',
      body: formData
      // Note: Do NOT set Content-Type header - browser will set it automatically with boundary
    });

    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed response:', errorText);
      throw new Error(`Upload failed with status: ${response.status} - ${errorText}`);
    }

    const uploadResult: UploadResponse = await response.json();
    console.log('Upload response:', uploadResult);

    if (uploadResult.status === 'success' && uploadResult.data) {
      result = uploadResult.data.url;
      console.log('✅ Photo uploaded successfully');
      console.log('URL:', result);
    } else {
      console.error('Upload result status not success:', uploadResult);
      throw new Error(uploadResult.message || 'Upload failed');
    }
  } catch (e) {
    console.error("❌ Error uploading photo:", e);
    error = e;
  }

  console.log('=== Upload Photo End ===');
  console.log('Result:', result);
  console.log('Error:', error);

  return { result, error };
}
