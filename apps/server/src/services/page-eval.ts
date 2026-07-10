import type { Page } from 'puppeteer';
import {
  expandTruncatedTweets as expandTruncatedTweetsFn,
  extractTweetsFromDom as extractTweetsFromDomFn,
  fetchTweetDetail as fetchTweetDetailFn,
  isLoginWall as isLoginWallFn,
  scrollToBottom as scrollToBottomFn,
  discoverThreadTweetIds as discoverThreadTweetIdsFn,
  clickShowMoreReplies as clickShowMoreRepliesFn,
  getThreadAuthor as getThreadAuthorFn,
  discoverThreadIdsFromHtml as discoverThreadIdsFromHtmlFn,
} from '../browser/page-scripts.js';
import {
  TWEET_DETAIL_FEATURES,
  TWEET_DETAIL_QUERY_IDS,
  BEARER_TOKEN,
} from './twitter-graphql.js';

export async function fetchTweetDetailInPage(page: Page, tweetId: string): Promise<unknown | null> {
  return page.evaluate(
    fetchTweetDetailFn,
    tweetId,
    TWEET_DETAIL_QUERY_IDS,
    TWEET_DETAIL_FEATURES,
    BEARER_TOKEN,
  );
}

export async function expandTruncatedTweets(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate(expandTruncatedTweetsFn);
    if (clicked === 0) break;
    await new Promise((r) => setTimeout(r, 400));
  }
}

export async function extractTweetsFromDom(page: Page): Promise<
  { id: string; text: string; images: string[] }[]
> {
  return page.evaluate(extractTweetsFromDomFn);
}

export async function checkLoginWall(page: Page): Promise<boolean> {
  return page.evaluate(isLoginWallFn);
}

export async function scrollPageToBottom(page: Page): Promise<void> {
  await page.evaluate(scrollToBottomFn);
}

export async function clickShowMoreReplies(page: Page): Promise<number> {
  return page.evaluate(clickShowMoreRepliesFn);
}

export async function discoverThreadTweetIds(
  page: Page,
  rootId: string,
  author: string,
): Promise<string[]> {
  return page.evaluate(discoverThreadTweetIdsFn, rootId, author);
}

export async function getThreadAuthor(page: Page): Promise<string> {
  return page.evaluate(getThreadAuthorFn);
}

export async function discoverThreadIdsFromHtml(
  page: Page,
  rootId: string,
  author: string,
): Promise<string[]> {
  return page.evaluate(discoverThreadIdsFromHtmlFn, rootId, author);
}
