import type { Page } from 'puppeteer';
import type { Thread, Tweet } from '@thread-to-pdf/shared';
import { MAX_TWEETS } from '@thread-to-pdf/shared';
import { AppError } from '../lib/errors.js';
import { extractTweetId, isAllowedImageUrl } from '../lib/url-validator.js';
import { sanitizeTweetText } from '../lib/sanitize.js';
import { config } from '../config.js';
import { getBrowser } from './pdf-generator.js';
import {
  extractAuthorFromGraphQL,
  extractAuthorFromUrl,
  isTweetDetailResponse,
  parseThreadFromGraphQL,
} from './twitter-graphql.js';
import {
  checkLoginWall,
  clickShowMoreReplies,
  getThreadAuthor,
  discoverThreadTweetIds,
  discoverThreadIdsFromHtml,
  expandTruncatedTweets,
  extractTweetsFromDom,
  fetchTweetDetailInPage,
  scrollPageToBottom,
} from './page-eval.js';
import { fetchSyndicationTweet, fetchThreadByIds } from './syndication-thread.js';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html,*/*',
  'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
};

interface SyndicationPhoto {
  url?: string;
}

interface SyndicationMedia {
  type?: string;
  media_url_https?: string;
}

interface SyndicationTweet {
  id_str?: string;
  text?: string;
  photos?: SyndicationPhoto[];
  mediaDetails?: SyndicationMedia[];
  entities?: { media?: SyndicationMedia[] };
  note_tweet?: {
    id?: string;
    note_tweet_results?: { result?: { text?: string } };
    text?: string;
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...FETCH_HEADERS, ...options.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(
        'NETWORK_TIMEOUT',
        'The request timed out. The thread may be very long — please try again.',
        504,
      );
    }
    throw new AppError(
      'NETWORK_TIMEOUT',
      'Unable to reach X. Please check your connection and try again.',
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function extractImagesFromSyndication(tweet: SyndicationTweet): string[] {
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
    if (url && isAllowedImageUrl(url) && !images.includes(url)) {
      images.push(url);
    }
  }
  return images;
}

function extractTextFromSyndication(tweet: SyndicationTweet): string {
  const noteText =
    tweet.note_tweet?.note_tweet_results?.result?.text ||
    tweet.note_tweet?.text ||
    '';
  if (noteText) return sanitizeTweetText(noteText);
  return sanitizeTweetText(tweet.text ?? '');
}

async function fetchSyndicationTweetFull(tweetId: string): Promise<SyndicationTweet | null> {
  return (await fetchSyndicationTweet(tweetId)) as SyndicationTweet | null;
}

function setupGraphQLInterceptor(page: Page): {
  getCaptured: () => unknown | null;
  waitForCapture: (timeoutMs: number) => Promise<unknown | null>;
} {
  let captured: unknown | null = null;
  let resolveCapture: ((value: unknown | null) => void) | null = null;

  const handler = async (response: import('puppeteer').HTTPResponse) => {
    if (!isTweetDetailResponse(response.url())) return;
    try {
      const json = await response.json();
      if (json?.data?.threaded_conversation_with_injections_v2) {
        captured = json;
        resolveCapture?.(json);
        resolveCapture = null;
      }
    } catch {
      // ignore parse errors
    }
  };

  page.on('response', handler);

  return {
    getCaptured: () => captured,
    waitForCapture: (timeoutMs: number) =>
      new Promise((resolve) => {
        if (captured) {
          resolve(captured);
          return;
        }
        resolveCapture = resolve;
        setTimeout(() => {
          resolveCapture = null;
          resolve(captured);
        }, timeoutMs);
      }),
  };
}

async function expandTruncatedTweetsOnPage(page: Page): Promise<void> {
  await expandTruncatedTweets(page);
}

async function extractTweetsFromDomPage(page: Page): Promise<Tweet[]> {
  const domTweets = await extractTweetsFromDom(page);
  return domTweets.map((t, i) => ({
    id: t.id || `tweet-${i}`,
    text: sanitizeTweetText(t.text),
    images: t.images.filter(isAllowedImageUrl).slice(0, 4),
  }));
}

async function fetchThreadWithGraphQL(
  page: Page,
  tweetId: string,
  sourceUrl: string,
): Promise<Tweet[]> {
  const interceptor = setupGraphQLInterceptor(page);
  let author = extractAuthorFromUrl(sourceUrl) ?? '';

  const pageUrls = [
    sourceUrl,
    `https://x.com/i/status/${tweetId}`,
    `https://twitter.com/i/status/${tweetId}`,
  ];

  let loaded = false;
  for (const url of pageUrls) {
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      if (response?.status() === 404) {
        throw new AppError(
          'THREAD_NOT_FOUND',
          'This thread was not found. It may have been deleted or the URL is incorrect.',
          404,
        );
      }

      await page.waitForSelector('article, [data-testid="primaryColumn"]', {
        timeout: 20000,
      }).catch(() => null);

      loaded = true;
      break;
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
  }

  if (!loaded) {
    throw new AppError(
      'NETWORK_TIMEOUT',
      'Unable to load the thread page. Please try again.',
      504,
    );
  }

  const isLoginWall = await checkLoginWall(page);

  if (isLoginWall) {
    throw new AppError(
      'PRIVATE_THREAD',
      'This thread is private or requires login. Only public threads can be converted.',
      403,
    );
  }

  await expandTruncatedTweetsOnPage(page);
  for (let i = 0; i < 12; i++) {
    await clickShowMoreReplies(page);
    await scrollPageToBottom(page);
    await new Promise((r) => setTimeout(r, 900));
    await expandTruncatedTweetsOnPage(page);
  }

  if (!author) {
    author = await getThreadAuthor(page);
  }

  let tweets: Tweet[] = [];

  let graphqlData = await interceptor.waitForCapture(8000);
  if (!graphqlData) graphqlData = interceptor.getCaptured();
  if (!graphqlData) {
    await new Promise((r) => setTimeout(r, 1500));
    graphqlData = await fetchTweetDetailInPage(page, tweetId);
  }

  if (graphqlData) {
    if (!author || author === 'i') {
      author = extractAuthorFromGraphQL(graphqlData, tweetId) ?? author;
    }
    tweets = parseThreadFromGraphQL(graphqlData, author, tweetId);
  }

  const domTweets = await extractTweetsFromDomPage(page);

  const discoveredIds = await discoverThreadTweetIds(page, tweetId, author);
  const htmlIds = await discoverThreadIdsFromHtml(page, tweetId, author);
  const allIds = [...new Set([...discoveredIds, ...htmlIds])];
  let syndicationTweets: Tweet[] = [];
  if (allIds.length > 0) {
    syndicationTweets = await fetchThreadByIds(allIds);
  }

  tweets = mergeTweetSources([tweets, domTweets, syndicationTweets], tweetId);

  return tweets;
}

function mergeTweetSources(sources: Tweet[][], rootId: string): Tweet[] {
  const byId = new Map<string, Tweet>();

  for (const list of sources) {
    for (const tweet of list) {
      const existing = byId.get(tweet.id);
      if (!existing) {
        byId.set(tweet.id, tweet);
        continue;
      }
      const text =
        tweet.text.length > existing.text.length ? tweet.text : existing.text;
      const images = existing.images.length >= tweet.images.length ? existing.images : tweet.images;
      byId.set(tweet.id, { id: tweet.id, text, images });
    }
  }

  const ids = [...byId.keys()].sort((a, b) => {
    try {
      return Number(BigInt(a) - BigInt(b));
    } catch {
      return 0;
    }
  });

  const rootIdx = ids.indexOf(rootId);
  const ordered = rootIdx >= 0 ? ids.slice(rootIdx) : ids;

  return ordered
    .slice(0, MAX_TWEETS)
    .map((id) => byId.get(id)!)
    .filter((t) => t && (t.text || t.images.length > 0));
}

async function enrichWithSyndication(tweets: Tweet[], rootId: string): Promise<Tweet[]> {
  if (tweets.length === 0) return tweets;
  const syndicationTweets = await fetchThreadByIds(tweets.map((t) => t.id));
  return mergeTweetSources([tweets, syndicationTweets], rootId);
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

export async function fetchThreadWithPuppeteer(url: string): Promise<Thread> {
  const rootId = extractTweetId(url);
  let page: Page | undefined;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(FETCH_HEADERS['User-Agent']);

    let tweets = await fetchThreadWithGraphQL(page, rootId, url.trim());

    if (tweets.length === 0) {
      const syndication = await fetchSyndicationTweetFull(rootId);
      if (syndication?.text || syndication?.photos?.length || syndication?.note_tweet) {
        tweets = [
          {
            id: syndication.id_str ?? rootId,
            text: extractTextFromSyndication(syndication),
            images: extractImagesFromSyndication(syndication),
          },
        ];
      }
    } else {
      tweets = await enrichWithSyndication(tweets, rootId);
    }

    const filtered = tweets.filter((t) => t.text || t.images.length > 0);

    if (filtered.length === 0) {
      throw new AppError(
        'UNSUPPORTED_CONTENT',
        'This tweet has no readable text or images to include in the PDF.',
        422,
      );
    }

    if (filtered.length > MAX_TWEETS) {
      throw new AppError(
        'THREAD_TOO_LONG',
        `This thread has more than ${MAX_TWEETS} tweets. Please use a shorter thread.`,
        413,
      );
    }

    const uniqueTweets = filtered.filter(
      (tweet, index, arr) => arr.findIndex((t) => t.id === tweet.id) === index,
    );

    return {
      id: rootId,
      title: generateTitle(uniqueTweets),
      tweets: uniqueTweets,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new AppError('INTERNAL_ERROR', `Failed to fetch thread: ${message}`, 500);
  } finally {
    if (page) await page.close().catch(() => undefined);
  }
}
