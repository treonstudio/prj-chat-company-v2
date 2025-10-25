/**
 * Media compression utilities for images and videos
 */

import imageCompression from 'browser-image-compression';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoading = false;

/**
 * Load FFmpeg.wasm (lazy loading)
 * Can be called early to pre-load FFmpeg for faster video compression
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;

  if (ffmpegLoading) {
    // Wait for existing load to complete
    while (ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (ffmpeg) return ffmpeg;
  }

  ffmpegLoading = true;

  try {
    ffmpeg = new FFmpeg();

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegLoading = false;
    return ffmpeg;
  } catch (error) {
    ffmpegLoading = false;
    throw error;
  }
}

/**
 * Compress an image file using browser-image-compression
 * @param file - The image file to compress
 * @param quality - Compression quality (0-1), default 0.8 for 80%
 * @param maxWidthOrHeight - Maximum width or height in pixels, default 1920
 * @returns Compressed image file
 */
export async function compressImage(
  file: File,
  quality: number = 0.8,
  maxWidthOrHeight: number = 1920
): Promise<File> {
  try {
    const options = {
      maxSizeMB: 1, // Max 1MB
      maxWidthOrHeight,
      useWebWorker: true,
      initialQuality: quality,
    };

    const compressedFile = await imageCompression(file, options);

    // Create new file with original name
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('Image compression error:', error);
    throw error;
  }
}

/**
 * Compress a video file using FFmpeg.wasm
 * @param file - The video file to compress
 * @param quality - Target quality (0-1), default 0.3 for 30%
 * @returns Compressed video file
 */
export async function compressVideo(
  file: File,
  quality: number = 0.3
): Promise<File> {
  try {
    // Load FFmpeg
    const ffmpegInstance = await loadFFmpeg();

    // Write input file to FFmpeg filesystem
    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    await ffmpegInstance.writeFile(inputFileName, await fetchFile(file));

    // Calculate CRF value from quality (lower quality = higher CRF)
    // OPTIMIZED: Reduced compression range for faster encoding
    // Quality 0.3 (30%) -> CRF ~28 (faster, still good quality)
    // Quality 1.0 (100%) -> CRF ~23 (less compression)
    const crf = Math.round(23 + (1 - quality) * 5); // CRF range: 23-28

    // Compress video with FFmpeg
    // -crf: Constant Rate Factor (23-28, balanced quality/speed)
    // -preset: veryfast for much faster encoding (was "fast")
    // -vf scale: Resize to max 1280x720 (720p)
    await ffmpegInstance.exec([
      '-i', inputFileName,
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease',
      '-c:v', 'libx264',
      '-crf', crf.toString(),
      '-preset', 'veryfast',
      '-c:a', 'aac',
      '-b:a', '128k',
      outputFileName
    ]);

    // Read output file
    const data = await ffmpegInstance.readFile(outputFileName);

    // Clean up
    await ffmpegInstance.deleteFile(inputFileName);
    await ffmpegInstance.deleteFile(outputFileName);

    // Create blob and file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([data as any], { type: 'video/mp4' });
    const compressedFile = new File([blob], file.name, {
      type: 'video/mp4',
      lastModified: Date.now(),
    });

    return compressedFile;
  } catch (error) {
    console.error('Video compression error:', error);
    throw error;
  }
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
