import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PdfOptions } from '@thread-to-pdf/shared';
import { DEFAULT_PDF_OPTIONS } from '@thread-to-pdf/shared';
import { config } from '../config.js';
import { getCacheKey, pdfCache, isCacheEnabled } from '../lib/cache.js';
import { isAppError } from '../lib/errors.js';
import { ensurePuppeteerCacheEnv } from '../lib/puppeteer-env.js';
import { fetchThread } from '../services/thread-fetcher.js';
import { generatePdf, getChromeExecutablePath } from '../services/pdf-generator.js';

const generateBodySchema = z.object({
  url: z.string().min(1).max(2048),
  options: z
    .object({
      coverPage: z.boolean().optional(),
      pageNumbers: z.boolean().optional(),
      fontFamily: z.enum(['thmanyah', 'inter', 'geist', 'ibm-plex', 'noto-sans']).optional(),
      fontSize: z.number().min(14).max(22).optional(),
      theme: z.enum(['classic', 'modern', 'minimal']).optional(),
    })
    .optional(),
});

function resolveOptions(options?: PdfOptions): Required<PdfOptions> {
  return {
    ...config.defaultPdfOptions,
    ...options,
  };
}

function optionsCacheKey(options: Required<PdfOptions>): string {
  return JSON.stringify(options);
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
    .toLowerCase() || 'thread';
}

export async function registerGenerateRoute(app: FastifyInstance): Promise<void> {
  app.post('/generate', async (request, reply) => {
    const parsed = generateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'INVALID_URL',
        message: 'Invalid request. Please provide a valid X thread URL.',
      });
    }

    const { url, options: rawOptions } = parsed.data;
    const options = resolveOptions(rawOptions);
    const cacheKey = getCacheKey(url, optionsCacheKey(options));

    if (isCacheEnabled()) {
      const cached = pdfCache.get(cacheKey);
      if (cached) {
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', 'attachment; filename="thread.pdf"')
          .header('X-Cache', 'HIT')
          .send(cached);
      }
    }

    try {
      const thread = await fetchThread(url);
      const pdf = await generatePdf(thread, options);

      if (isCacheEnabled()) {
        pdfCache.set(cacheKey, pdf);
      }

      const filename = `${sanitizeFilename(thread.title)}.pdf`;
      const totalChars = thread.tweets.reduce((sum, t) => sum + t.text.length, 0);

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('X-Cache', 'MISS')
        .header('X-Tweet-Count', String(thread.tweets.length))
        .header('X-Content-Chars', String(totalChars))
        .send(pdf);
    } catch (error) {
      if (isAppError(error)) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message,
        });
      }

      request.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong while generating your PDF. Please try again.',
      });
    }
  });

  app.get('/health', async () => ({
    status: 'ok',
    version: 'v4-fxtwitter',
    timestamp: new Date().toISOString(),
    chrome: getChromeExecutablePath() ?? null,
    puppeteerCacheDir: ensurePuppeteerCacheEnv(),
  }));
}
