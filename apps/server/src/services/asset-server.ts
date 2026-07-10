import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export interface AssetServer {
  port: number;
  close: () => Promise<void>;
}

export function startAssetServer(rootDir: string): Promise<AssetServer> {
  const root = normalize(rootDir);

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url?.split('?')[0] ?? '/');
        const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
        const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const filePath = normalize(join(root, safePath));

        if (!filePath.startsWith(root)) {
          res.writeHead(403).end();
          return;
        }

        const data = await readFile(filePath);
        const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      } catch {
        res.writeHead(404).end();
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start asset server'));
        return;
      }

      resolve({
        port: address.port,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
      });
    });
  });
}
