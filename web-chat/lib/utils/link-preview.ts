/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches || [];
}

/**
 * Check if text contains URL
 */
export function hasUrl(text: string): boolean {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return urlRegex.test(text);
}

/**
 * Link preview metadata interface
 */
export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

/**
 * Fetch link preview metadata using WebFetch or API
 * This is a client-side implementation
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    // Use an API endpoint to fetch metadata (to avoid CORS issues)
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);

    if (!response.ok) {
      console.error('Failed to fetch link preview:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching link preview:', error);
    return null;
  }
}

/**
 * Extract domain from URL for display
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}
