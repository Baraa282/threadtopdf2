import './lib/puppeteer-env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { ensurePuppeteerCacheEnv } from './lib/puppeteer-env.js';
import { registerGenerateRoute } from './routes/generate.js';
import { closeBrowser, getChromeExecutablePath } from './services/pdf-generator.js';

function resolveCorsOrigin():
  | boolean
  | string[]
  | RegExp[]
  | ((origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => void) {
  if (config.nodeEnv === 'development') return true;

  if (config.corsOrigins?.length) {
    return config.corsOrigins;
  }

  return [
    /^https:\/\/[\w-]+\.netlify\.app$/,
    /^https:\/\/[\w-]+\.netlify\.live$/,
    /^https:\/\/[\w-]+\.vercel\.app$/,
  ];
}

const app = Fastify({
  logger: config.nodeEnv === 'development',
  bodyLimit: 10_240,
});

await app.register(cors, {
  origin: resolveCorsOrigin(),
  methods: ['GET', 'POST', 'OPTIONS'],
});

await app.register(rateLimit, {
  max: config.rateLimitMax,
  timeWindow: config.rateLimitWindowMs,
  errorResponseBuilder: () => ({
    code: 'RATE_LIMIT',
    message: 'Too many requests. Please wait a moment before trying again.',
  }),
});

await registerGenerateRoute(app);

const shutdown = async () => {
  await closeBrowser();
  await app.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`Server running at http://${config.host}:${config.port}`);
  console.log(`Puppeteer cache: ${ensurePuppeteerCacheEnv()}`);
  console.log(`Chrome binary: ${getChromeExecutablePath() ?? 'NOT FOUND'}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
