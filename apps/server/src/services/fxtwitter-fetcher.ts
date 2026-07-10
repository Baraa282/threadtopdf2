import type { Thread, Tweet } from '@thread-to-pdf/shared';
import { MAX_TWEETS } from '@thread-to-pdf/shared';
import { AppError } from '../lib/errors.js';
import { extractTweetId, isAllowedImageUrl } from '../lib/url-validator.js';
import { sanitizeTweetText } from '../lib/sanitize.js';
import { config } from '../config.js';
import { fetchThreadWithPuppeteer } from './thread-fetcher-puppeteer.js';

const FXTWITTER_API = 'https://api.fxtwitter.com';

const FETCH_HEADERS = {
  'User-Agent': 'ThreadToPDF/1.0',
  Accept: 'application/json',
};

interface FxMediaItem {
  type?: string;
  url?: string;
}

interface FxStatus {
  id?: string;
  text?: string;
  media?: {
    all?: FxMediaItem[];
    photos?: FxMediaItem[];
  };
}

interface FxThreadResponse {
  code?: number;
  message?: string;
  status?: FxStatus;
  thread?: FxStatus[];
}

function extractImages(status: FxStatus): string[] {
  const images: string[] = [];
  const sources = [...(status.media?.all ?? []), ...(status.media?.photos ?? [])];

  for (const item of sources) {
    if (item.type === 'photo' && item.url && isAllowedImageUrl(item.url)) {
      if (!images.includes(item.url)) images.push(item.url);
    }
  }

  return images.slice(0, 4);
}

function toTweet(status: FxStatus): Tweet | null {
  const id = status.id;
  const text = sanitizeTweetText(status.text ?? '');
  const images = extractImages(status);

  if (!id || (!text && images.length === 0)) return null;

  return { id, text, images };
}

function mapFxError(code: number, message?: string): AppError {
  const msg = message ?? 'Unknown error';

  if (code === 404 || msg.includes('NOT_FOUND')) {
    return new AppError(
      'THREAD_NOT_FOUND',
      'This thread was not found. It may have been deleted or the URL is incorrect.',
      404,
    );
  }
  if (code === 401 || msg.includes('PRIVATE')) {
    return new AppError(
      'PRIVATE_THREAD',
      'This thread is private. Only public threads can be converted.',
      403,
    );
  }
  if (code === 429) {
    return new AppError(
      'RATE_LIMIT',
      'FxTwitter rate limit reached. Please wait a moment and try again.',
      429,
    );
  }
  return new AppError('INTERNAL_ERROR', `Failed to fetch thread: ${msg}`, 502);
}

async function fetchFxThread(tweetId: string): Promise<FxThreadResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const url = `${FXTWITTER_API}/2/thread/${tweetId}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
    });

    const data = (await response.json()) as FxThreadResponse;
    const code = data.code ?? response.status;

    if (!response.ok || (code !== 200 && code !== undefined && code >= 400)) {
      throw mapFxError(code, data.message);
    }

    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(
        'NETWORK_TIMEOUT',
        'The request timed out. Please try again.',
        504,
      );
    }
    throw new AppError(
      'NETWORK_TIMEOUT',
      'Unable to reach FxTwitter API. Please try again.',
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseFxThread(data: FxThreadResponse, rootId: string): Tweet[] {
  const tweets: Tweet[] = [];
  const seen = new Set<string>();

  const items = data.thread?.length ? data.thread : data.status ? [data.status] : [];

  for (const item of items) {
    const tweet = toTweet(item);
    if (!tweet || seen.has(tweet.id)) continue;
    seen.add(tweet.id);
    tweets.push(tweet);
  }

  // Ensure chronological order by snowflake ID
  tweets.sort((a, b) => {
    try {
      return Number(BigInt(a.id) - BigInt(b.id));
    } catch {
      return 0;
    }
  });

  // If URL pointed to middle of thread, start from that tweet
  const rootIdx = tweets.findIndex((t) => t.id === rootId);
  const slice = rootIdx >= 0 ? tweets.slice(rootIdx) : tweets;

  if (slice.length > MAX_TWEETS) {
    throw new AppError(
      'THREAD_TOO_LONG',
      `This thread has more than ${MAX_TWEETS} tweets. Please use a shorter thread.`,
      413,
    );
  }

  return slice;
}

function generateTitle(tweets: Tweet[]): string {
  const first = tweets[0];
  if (!first?.text) return 'Thread';

  const text = first.text.trim();
  if (text.length <= 80) return text;

  const truncated = text.slice(0, 80);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

export async function fetchThreadViaFxTwitter(url: string): Promise<Thread> {
  const rootId = extractTweetId(url);
  const data = await fetchFxThread(rootId);
  const tweets = parseFxThread(data, rootId);

  if (tweets.length === 0) {
    throw new AppError(
      'UNSUPPORTED_CONTENT',
      'This thread has no readable text or images to include in the PDF.',
      422,
    );
  }

  return {
    id: rootId,
    title: generateTitle(tweets),
    tweets,
  };
}

export async function fetchThread(url: string): Promise<Thread> {
  try {
    return await fetchThreadViaFxTwitter(url);
  } catch (error) {
    // Fall back to Puppeteer scraping only for recoverable fetch failures
    if (error instanceof AppError) {
      const retryable = ['NETWORK_TIMEOUT', 'INTERNAL_ERROR', 'RATE_LIMIT'];
      if (!retryable.includes(error.code)) throw error;
    }

    try {
      return await fetchThreadWithPuppeteer(url);
    } catch (fallbackError) {
      if (error instanceof AppError) throw error;
      throw fallbackError;
    }
  }
}
