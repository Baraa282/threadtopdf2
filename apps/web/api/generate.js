/**
 * Vercel serverless proxy → Render API.
 * Frontend calls /api/generate (same origin, no CORS).
 * Set RENDER_API_URL or VITE_API_URL on Vercel.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      code: 'INTERNAL_ERROR',
      message: 'Method not allowed.',
    });
  }

  const apiBase = (process.env.RENDER_API_URL || process.env.VITE_API_URL || '')
    .trim()
    .replace(/\/$/, '');

  if (!apiBase) {
    return res.status(503).json({
      code: 'API_UNAVAILABLE',
      message:
        'Set RENDER_API_URL (or VITE_API_URL) on Vercel to your Render backend URL, then redeploy.',
    });
  }

  try {
    const upstream = await fetch(`${apiBase}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);

    for (const header of ['content-disposition', 'x-cache', 'x-tweet-count', 'x-content-chars']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    if (contentType.includes('application/json')) {
      const json = await upstream.json();
      return res.json(json);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch {
    return res.status(503).json({
      code: 'API_UNAVAILABLE',
      message: 'Cannot reach the PDF server. Check that your Render backend is running.',
    });
  }
}
