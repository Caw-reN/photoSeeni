import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy route untuk gambar dari backend.
 * Ini diperlukan karena ngrok memblokir request langsung dari <img> tag
 * yang tidak menyertakan header 'ngrok-skip-browser-warning'.
 * Next.js server bisa menyertakan header tersebut, lalu meneruskan gambar ke browser.
 *
 * Usage: /api/proxy-image?url=https://ngrok-url/api/frame-templates/1/image
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'ngrok-skip-browser-warning': '69420',
        'Accept': 'image/*,*/*',
      },
      // Don't cache on server side, let browser cache
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/png';

    // If upstream returned HTML (ngrok warning page), reject it
    if (contentType.includes('text/html') || contentType.includes('text/plain')) {
      return new NextResponse('Upstream returned non-image content', { status: 502 });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[proxy-image] Error:', err);
    return new NextResponse('Failed to fetch image', { status: 500 });
  }
}
