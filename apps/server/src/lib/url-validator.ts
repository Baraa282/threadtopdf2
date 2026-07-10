import { MAX_URL_LENGTH } from '@thread-to-pdf/shared';
import { AppError } from './errors.js';

const ALLOWED_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
  'mobile.x.com',
]);

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '169.254.169.254',
  'metadata.google.internal',
]);

const TWEET_URL_PATTERN =
  /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(?:\w+\/)?status\/(\d+)/i;

const TWEET_ID_PATTERN = /^\d{15,25}$/;

export function extractTweetId(url: string): string {
  if (url.length > MAX_URL_LENGTH) {
    throw new AppError('INVALID_URL', 'URL is too long.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new AppError('INVALID_URL', 'Please enter a valid X (Twitter) thread URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('INVALID_URL', 'URL must use HTTP or HTTPS.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname)) {
    throw new AppError('INVALID_URL', 'Invalid URL host.');
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new AppError(
      'INVALID_URL',
      'Only X (Twitter) thread URLs are supported (x.com or twitter.com).',
    );
  }

  const match = parsed.href.match(TWEET_URL_PATTERN);
  if (!match?.[1]) {
    throw new AppError(
      'INVALID_URL',
      'Could not find a tweet ID in the URL. Use a link like https://x.com/user/status/1234567890',
    );
  }

  const tweetId = match[1];
  if (!TWEET_ID_PATTERN.test(tweetId)) {
    throw new AppError('INVALID_URL', 'Invalid tweet ID format.');
  }

  return tweetId;
}

export function generateSyndicationToken(tweetId: string): string {
  return ((Number(tweetId) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, '');
}

export function isAllowedImageUrl(url: string): boolean {
  if (url.startsWith('images/') && !url.includes('..')) {
    return /^images\/img-\d+\.(jpg|jpeg|png|webp|gif)$/i.test(url);
  }

  if (url.startsWith('data:image/')) {
    return /^data:image\/[\w.+-]+;base64,/i.test(url);
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'pbs.twimg.com' ||
      host.endsWith('.pbs.twimg.com') ||
      host === 'video.twimg.com'
    );
  } catch {
    return false;
  }
}
