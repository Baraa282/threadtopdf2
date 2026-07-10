import type { Tweet } from '@thread-to-pdf/shared';
import { isAllowedImageUrl } from '../lib/url-validator.js';
import { sanitizeTweetText } from '../lib/sanitize.js';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

interface SyndicationTweet {
  id_str?: string;
  text?: string;
  photos?: { url?: string }[];
  mediaDetails?: { type?: string; media_url_https?: string }[];
  entities?: { media?: { type?: string; media_url_https?: string }[] };
  note_tweet?: {
    id?: string;
    note_tweet_results?: { result?: { text?: string } };
    text?: string;
  };
}

function syndicationToken(tweetId: string): string {
  return ((Number(tweetId) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, '');
}

function extractImages(tweet: SyndicationTweet): string[] {
  const images: string[] = [];
  const sources = [
    ...(tweet.photos ?? []).map((p) => p.url),
    ...(tweet.mediaDetails ?? [])
      .filter((m) => m.type === 'photo')
      .map((m) => m.media_url_https),
    ...(tweet.entities?.media ?? [])
      .filter((m) => m.type === 'photo')
      .map((m) => m.media_url_https),
  ];
  for (const url of sources) {
    if (url && isAllowedImageUrl(url) && !images.includes(url)) images.push(url);
  }
  return images.slice(0, 4);
}

function extractText(tweet: SyndicationTweet): string {
  const noteText =
    tweet.note_tweet?.note_tweet_results?.result?.text || tweet.note_tweet?.text || '';
  return sanitizeTweetText(noteText || tweet.text || '');
}

function toTweet(tweet: SyndicationTweet, fallbackId: string): Tweet | null {
  const id = tweet.id_str ?? fallbackId;
  const text = extractText(tweet);
  const images = extractImages(tweet);
  if (!text && images.length === 0) return null;
  return { id, text, images };
}

export async function fetchSyndicationTweet(
  tweetId: string,
  timeoutMs = 30000,
): Promise<SyndicationTweet | null> {
  const token = syndicationToken(tweetId);
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) return null;
    return (await response.json()) as SyndicationTweet;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSyndicationBatch(tweetIds: string[]): Promise<Map<string, Tweet>> {
  const results = new Map<string, Tweet>();
  const batchSize = 10;

  for (let i = 0; i < tweetIds.length; i += batchSize) {
    const batch = tweetIds.slice(i, i + batchSize);
    const token = syndicationToken(batch[0]);
    const batchUrl = `https://cdn.syndication.twimg.com/tweets-json?ids=${batch.join(',')}&token=${token}`;

    try {
      const response = await fetch(batchUrl, { headers: FETCH_HEADERS });
      if (response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('json')) {
          const data = (await response.json()) as SyndicationTweet[] | Record<string, SyndicationTweet>;
          const tweets = Array.isArray(data) ? data : Object.values(data);
          for (const raw of tweets) {
            const id = raw.id_str ?? '';
            const parsed = toTweet(raw, id);
            if (parsed) results.set(parsed.id, parsed);
          }
          continue;
        }
      }
    } catch {
      // fall through to individual fetch
    }

    await Promise.all(
      batch.map(async (id) => {
        const raw = await fetchSyndicationTweet(id);
        if (!raw) return;
        const parsed = toTweet(raw, id);
        if (parsed) results.set(parsed.id, parsed);
      }),
    );
  }

  return results;
}

export function sortTweetIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    try {
      return Number(BigInt(a) - BigInt(b));
    } catch {
      return 0;
    }
  });
}

export async function fetchThreadByIds(tweetIds: string[]): Promise<Tweet[]> {
  const unique = sortTweetIds([...new Set(tweetIds.filter(Boolean))]);
  if (unique.length === 0) return [];

  const map = await fetchSyndicationBatch(unique);
  return unique.map((id) => map.get(id)).filter((t): t is Tweet => !!t);
}
