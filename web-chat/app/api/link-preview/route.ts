import { NextRequest, NextResponse } from 'next/server';

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract metadata from HTML
    const preview: LinkPreviewData = {
      url,
    };

    // Extract Open Graph tags
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
    const ogDescription = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
    const ogSiteName = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]*)"[^>]*>/i);

    // Fallback to regular meta tags
    const metaTitle = html.match(/<meta[^>]*name="title"[^>]*content="([^"]*)"[^>]*>/i);
    const metaDescription = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    // Extract favicon
    const faviconLink = html.match(/<link[^>]*rel="(?:icon|shortcut icon)"[^>]*href="([^"]*)"[^>]*>/i);

    // Set preview data
    preview.title = ogTitle?.[1] || metaTitle?.[1] || titleTag?.[1] || '';
    preview.description = ogDescription?.[1] || metaDescription?.[1] || '';
    preview.image = ogImage?.[1] || '';
    preview.siteName = ogSiteName?.[1] || '';
    preview.favicon = faviconLink?.[1] || '';

    // Make image URL absolute if relative
    if (preview.image && !preview.image.startsWith('http')) {
      const urlObj = new URL(url);
      preview.image = new URL(preview.image, urlObj.origin).href;
    }

    // Make favicon URL absolute if relative
    if (preview.favicon && !preview.favicon.startsWith('http')) {
      const urlObj = new URL(url);
      preview.favicon = new URL(preview.favicon, urlObj.origin).href;
    }

    return NextResponse.json(preview);
  } catch (error) {
    console.error('Error fetching link preview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch link preview' },
      { status: 500 }
    );
  }
}
