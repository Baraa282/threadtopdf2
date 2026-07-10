import { LRUCache } from 'lru-cache';
import { config } from '../config.js';

const CACHE_VERSION = 'v8'; // bump when fetch/render logic changes

export const pdfCache = new LRUCache<string, Buffer>({
  max: config.cacheMaxSize,
  ttl: config.cacheTtlMs,
});

export function getCacheKey(url: string, optionsKey: string): string {
  return `${CACHE_VERSION}::${url}::${optionsKey}`;
}

export function clearPdfCache(): void {
  pdfCache.clear();
}

export function isCacheEnabled(): boolean {
  return config.nodeEnv === 'production';
}
