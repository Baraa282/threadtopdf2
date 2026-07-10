import type { PdfOptions } from '@thread-to-pdf/shared';
import { DEFAULT_PDF_OPTIONS } from '@thread-to-pdf/shared';

function parseCorsOrigins(value: string | undefined): string[] | null {
  if (!value?.trim()) return null;
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '10', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS ?? '120000', 10),
  cacheTtlMs: parseInt(process.env.CACHE_TTL_MS ?? '3600000', 10),
  cacheMaxSize: parseInt(process.env.CACHE_MAX_SIZE ?? '100', 10),
  defaultPdfOptions: DEFAULT_PDF_OPTIONS as Required<PdfOptions>,
};
