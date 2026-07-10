import { getBrowser } from '../src/services/pdf-generator.js';
import { closeBrowser } from '../src/services/pdf-generator.js';
import {
  extractEntries,
  parseThreadFromGraphQL,
  unwrapResult,
} from '../src/services/twitter-graphql.js';
import { fetchTweetDetailInPage } from '../src/services/page-eval.js';
import { isTweetDetailResponse } from '../src/services/twitter-graphql.js';

const tweetId = '2036818421736731008';
const url = `https://x.com/rhg7684/status/${tweetId}`;

async function main() {
  const browser = await getBrowser();
  const page = await browser.newPage();

  let captured: unknown = null;
  page.on('response', async (response) => {
    if (!isTweetDetailResponse(response.url())) return;
    try {
      const json = await response.json();
      if (json?.data?.threaded_conversation_with_injections_v2) captured = json;
    } catch {
      // ignore
    }
  });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2000));

  let data = captured;
  if (!data) {
    console.log('No intercepted GraphQL, trying in-page fetch...');
    data = await fetchTweetDetailInPage(page, tweetId);
  }

  if (!data) {
    console.log('No GraphQL data at all');
    await page.close();
    await closeBrowser();
    return;
  }

  console.log('Got GraphQL data');

  const entries = extractEntries(data);
  console.log('Entries count:', entries.length);

  // Inspect focal tweet
  for (const entry of entries) {
    const results = [
      entry.content?.itemContent?.tweet_results?.result,
      ...(entry.content?.items ?? []).map((i) => i.item?.itemContent?.tweet_results?.result),
    ];
    for (const result of results) {
      const unwrapped = unwrapResult(result) as Record<string, unknown> | null;
      if (!unwrapped) continue;
      const id = (unwrapped.rest_id as string) || '';
      if (id !== tweetId) continue;

      const legacy = unwrapped.legacy as Record<string, unknown> | undefined;
      const noteTweet = unwrapped.note_tweet as Record<string, unknown> | undefined;
      const noteResults = noteTweet?.note_tweet_results as Record<string, unknown> | undefined;
      const noteResult = noteResults?.result as Record<string, unknown> | undefined;

      console.log('legacy full_text length:', ((legacy?.full_text as string) || '').length);
      console.log('note_tweet text length:', ((noteResult?.text as string) || '').length);
      console.log('has note_tweet:', !!noteTweet);
      console.log('__typename:', unwrapped.__typename);
    }
  }

  const tweets = parseThreadFromGraphQL(data, 'rhg7684', tweetId);
  console.log('Parsed tweets:', tweets.length);
  console.log('Parsed text length:', tweets[0]?.text.length ?? 0);
  console.log('First 200 chars:', tweets[0]?.text.slice(0, 200));

  await page.close();
  await closeBrowser();
}

main().catch(console.error);
