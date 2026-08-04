import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Đảm bảo URL hợp lệ
    let finalUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      finalUrl = 'https://' + url;
    }

    const response = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 400 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('title').text() || $('meta[property="og:title"]').attr('content') || finalUrl;
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    
    // Tìm favicon
    let faviconUrl = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || $('link[rel="apple-touch-icon"]').attr('href');
    
    // Xử lý đường dẫn tương đối của favicon
    if (faviconUrl) {
      try {
        faviconUrl = new URL(faviconUrl, finalUrl).href;
      } catch (e) {
        console.warn("Invalid favicon URL format", e);
      }
    } else {
      // Fallback
      try {
        const urlObj = new URL(finalUrl);
        faviconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
      } catch (e) {
        faviconUrl = "";
      }
    }

    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      favicon_url: faviconUrl,
      url: finalUrl
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json({ error: 'Failed to parse metadata' }, { status: 500 });
  }
}
