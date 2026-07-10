/**
 * Netlify Function — proxies /api/generate to Render.
 * Set RENDER_API_URL in Netlify environment variables.
 */
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { Allow: 'POST', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Method not allowed.' }),
    };
  }

  const apiBase = (process.env.RENDER_API_URL || process.env.VITE_API_URL || '')
    .trim()
    .replace(/\/$/, '');

  if (!apiBase) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'API_UNAVAILABLE',
        message:
          'Set RENDER_API_URL in Netlify/Vercel to your Render backend URL, then redeploy.',
      }),
    };
  }

  try {
    const upstream = await fetch(`${apiBase}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body,
    });

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const headers = { 'Content-Type': contentType };

    for (const name of ['content-disposition', 'x-cache', 'x-tweet-count', 'x-content-chars']) {
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }

    if (contentType.includes('application/json')) {
      return {
        statusCode: upstream.status,
        headers,
        body: await upstream.text(),
      };
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return {
      statusCode: upstream.status,
      headers,
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'API_UNAVAILABLE',
        message: 'Cannot reach the PDF server. Check that your Render backend is running.',
      }),
    };
  }
}
