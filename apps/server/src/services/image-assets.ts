import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Thread } from '@thread-to-pdf/shared';
import { isAllowedImageUrl } from '../lib/url-validator.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const MAX_CONCURRENT = 4;

export const THMANYAH_FONT_FILENAME = 'thmanyahseriftext-Regular.otf';
export const THMANYAH_FONT_RELATIVE = `fonts/${THMANYAH_FONT_FILENAME}`;

const BUNDLED_FONT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../assets/fonts',
  THMANYAH_FONT_FILENAME,
);

export interface ThreadWithAssets {
  thread: Thread;
  assetsDir: string;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ThreadToPDF/1.0',
        Accept: 'image/*',
        Referer: 'https://x.com/',
      },
    });

    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') ?? 'image/jpeg')
      .split(';')[0]
      .trim();
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;

    return buffer;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}


async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

export async function prepareThreadAssets(thread: Thread): Promise<ThreadWithAssets> {
  const assetsDir = await mkdtemp(join(tmpdir(), 'thread-pdf-'));
  const imagesDir = join(assetsDir, 'images');
  const fontsDir = join(assetsDir, 'fonts');
  await mkdir(imagesDir);
  await mkdir(fontsDir);
  await copyFile(BUNDLED_FONT_PATH, join(fontsDir, THMANYAH_FONT_FILENAME));

  const uniqueUrls = new Set<string>();
  for (const tweet of thread.tweets) {
    for (const url of tweet.images) {
      if (isAllowedImageUrl(url)) uniqueUrls.add(url);
    }
  }

  const urls = [...uniqueUrls];
  const urlToLocal = new Map<string, string>();

  const saved = await mapWithConcurrency(urls, MAX_CONCURRENT, async (url, index) => {
    const buffer = await fetchImageBuffer(url);
    if (!buffer) return { url, localPath: null as string | null };

    const localName = `img-${index}.jpg`;
    const absolutePath = join(imagesDir, localName);
    await writeFile(absolutePath, buffer);
    return { url, localPath: `images/${localName}` };
  });

  for (const { url, localPath } of saved) {
    if (localPath) urlToLocal.set(url, localPath);
  }

  const preparedThread: Thread = {
    ...thread,
    tweets: thread.tweets.map((tweet) => ({
      ...tweet,
      images: tweet.images
        .map((url) => urlToLocal.get(url))
        .filter((path): path is string => Boolean(path)),
    })),
  };

  return { thread: preparedThread, assetsDir };
}

export async function cleanupThreadAssets(assetsDir: string): Promise<void> {
  await rm(assetsDir, { recursive: true, force: true }).catch(() => undefined);
}
