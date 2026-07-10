import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Same cache path for local dev, Render build, and Render runtime. */
export function resolvePuppeteerCacheDir(): string {
  if (process.env.PUPPETEER_CACHE_DIR?.trim()) {
    return process.env.PUPPETEER_CACHE_DIR.trim();
  }

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
  return join(repoRoot, '.cache', 'puppeteer');
}

export function ensurePuppeteerCacheEnv(): string {
  const cacheDir = resolvePuppeteerCacheDir();
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  return cacheDir;
}
