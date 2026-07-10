import type { Tweet } from '@thread-to-pdf/shared';
import { isAllowedImageUrl } from '../lib/url-validator.js';
import { sanitizeTweetText } from '../lib/sanitize.js';

// TweetDetail query IDs (X rotates these; try multiple)
const BEARER_TOKEN =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

export { BEARER_TOKEN };

const TWEET_DETAIL_QUERY_IDS = [
  't66713qxyDI9pc4Jyb6wxQ',
  '_NvJCnIjOW__EP5-RF197A',
  'VWFGPVAGkZMGRKGe3GFFnA',
  '0hWvDhmW8YQ-S_ib3azIrw',
];

export { TWEET_DETAIL_QUERY_IDS };

const TWEET_DETAIL_FEATURES = {
  rweb_video_screen_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

export { TWEET_DETAIL_FEATURES };

interface GraphQLTweet {
  id: string;
  author: string;
  text: string;
  timestamp: string | null;
  inReplyTo: string | null;
  images: string[];
}

interface TimelineEntry {
  content?: {
    itemContent?: { tweet_results?: { result?: unknown } };
    items?: { item?: { itemContent?: { tweet_results?: { result?: unknown } } } }[];
  };
}

export function unwrapResult(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  if (r.__typename === 'TweetWithVisibilityResults' && r.tweet) {
    return r.tweet as Record<string, unknown>;
  }
  return r;
}

function getScreenName(result: Record<string, unknown>): string {
  const core = result.core as Record<string, unknown> | undefined;
  const userResults = core?.user_results as Record<string, unknown> | undefined;
  const user = userResults?.result as Record<string, unknown> | undefined;
  const userCore = user?.core as Record<string, unknown> | undefined;
  const legacy = user?.legacy as Record<string, unknown> | undefined;
  return (
    (userCore?.screen_name as string) ||
    (legacy?.screen_name as string) ||
    ''
  );
}

function extractImages(result: Record<string, unknown>): string[] {
  const legacy = result.legacy as Record<string, unknown> | undefined;
  const extended = legacy?.extended_entities as Record<string, unknown> | undefined;
  const media = (extended?.media as Array<Record<string, unknown>>) ?? [];
  const images: string[] = [];

  for (const m of media) {
    if (m.type === 'photo' && typeof m.media_url_https === 'string') {
      const url = m.media_url_https;
      if (isAllowedImageUrl(url) && !images.includes(url)) {
        images.push(url);
      }
    }
  }
  return images.slice(0, 4);
}

function parseTweetResult(result: unknown): GraphQLTweet | null {
  const unwrapped = unwrapResult(result);
  if (!unwrapped?.legacy) return null;

  const legacy = unwrapped.legacy as Record<string, unknown>;
  const author = getScreenName(unwrapped);
  const noteTweet = unwrapped.note_tweet as Record<string, unknown> | undefined;
  const noteResults = noteTweet?.note_tweet_results as Record<string, unknown> | undefined;
  const noteResult = noteResults?.result as Record<string, unknown> | undefined;

  const text = sanitizeTweetText(
    (noteResult?.text as string) || (legacy.full_text as string) || '',
  );

  const createdAt = legacy.created_at as string | undefined;

  return {
    id: (unwrapped.rest_id as string) || (legacy.id_str as string) || '',
    author,
    text,
    timestamp: createdAt ? new Date(createdAt).toISOString() : null,
    inReplyTo: (legacy.in_reply_to_status_id_str as string) || null,
    images: extractImages(unwrapped),
  };
}

export function extractEntries(graphqlData: unknown): TimelineEntry[] {
  const data = graphqlData as Record<string, unknown>;
  const inner = data?.data as Record<string, unknown> | undefined;
  const conversation = inner?.threaded_conversation_with_injections_v2 as
    | Record<string, unknown>
    | undefined;
  const instructions = (conversation?.instructions as Array<Record<string, unknown>>) ?? [];

  const entries: TimelineEntry[] = [];
  for (const inst of instructions) {
    if (Array.isArray(inst.entries)) {
      entries.push(...(inst.entries as TimelineEntry[]));
    }
  }
  return entries;
}

function collectAuthorTweets(
  entries: TimelineEntry[],
  mainAuthor: string,
): Map<string, GraphQLTweet> {
  const candidates = new Map<string, GraphQLTweet>();
  const authorLower = mainAuthor.toLowerCase();

  const processResult = (result: unknown) => {
    const unwrapped = unwrapResult(result);
    if (!unwrapped) return;
    if (getScreenName(unwrapped).toLowerCase() !== authorLower) return;
    const parsed = parseTweetResult(unwrapped);
    if (parsed?.id) candidates.set(parsed.id, parsed);
  };

  for (const entry of entries) {
    processResult(entry.content?.itemContent?.tweet_results?.result);
    for (const item of entry.content?.items ?? []) {
      processResult(item.item?.itemContent?.tweet_results?.result);
    }
  }

  return candidates;
}

function buildConnectedThread(
  candidates: Map<string, GraphQLTweet>,
  mainTweetId: string,
): GraphQLTweet[] {
  const connected = new Set<string>();
  const queue = [mainTweetId];

  while (queue.length > 0) {
    const id = queue.pop()!;
    if (connected.has(id) || !candidates.has(id)) continue;
    connected.add(id);

    const tweet = candidates.get(id)!;
    if (tweet.inReplyTo && candidates.has(tweet.inReplyTo)) {
      queue.push(tweet.inReplyTo);
    }
    for (const other of candidates.values()) {
      if (other.inReplyTo === id) queue.push(other.id);
    }
  }

  const result = Array.from(candidates.values()).filter((t) => connected.has(t.id));
  return sortTweets(result.length > 0 ? result : Array.from(candidates.values()));
}

function buildSelfReplyChain(
  candidates: Map<string, GraphQLTweet>,
  mainTweetId: string,
): GraphQLTweet[] {
  if (candidates.size === 0) return [];
  if (candidates.size === 1) return sortTweets(Array.from(candidates.values()));

  const children = new Map<string, GraphQLTweet[]>();
  for (const tweet of candidates.values()) {
    if (tweet.inReplyTo && candidates.has(tweet.inReplyTo)) {
      const list = children.get(tweet.inReplyTo) ?? [];
      list.push(tweet);
      children.set(tweet.inReplyTo, list);
    }
  }

  let rootId = mainTweetId;
  let node = candidates.get(mainTweetId);
  const visited = new Set<string>();
  while (node?.inReplyTo && candidates.has(node.inReplyTo) && !visited.has(node.inReplyTo)) {
    visited.add(node.inReplyTo);
    rootId = node.inReplyTo;
    node = candidates.get(rootId);
  }

  const chain: GraphQLTweet[] = [];
  let currentId: string | null = rootId;
  const chainVisited = new Set<string>();

  while (currentId && candidates.has(currentId) && !chainVisited.has(currentId)) {
    chainVisited.add(currentId);
    const current = candidates.get(currentId)!;
    chain.push(current);

    const kids: GraphQLTweet[] = children.get(currentId) ?? [];
    kids.sort((a: GraphQLTweet, b: GraphQLTweet) => {
      try {
        return Number(BigInt(a.id) - BigInt(b.id));
      } catch {
        return 0;
      }
    });
    currentId = kids[0]?.id ?? null;
  }

  // If linear chain missed tweets, use full connected component
  if (chain.length < candidates.size) {
    const connected = buildConnectedThread(candidates, mainTweetId);
    if (connected.length > chain.length) return connected;
  }

  if (chain.length > 0) return chain;

  return sortTweets(Array.from(candidates.values()));
}

function sortTweets(tweets: GraphQLTweet[]): GraphQLTweet[] {
  return tweets.sort((a, b) => {
    try {
      return Number(BigInt(a.id) - BigInt(b.id));
    } catch {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    }
  });
}

export function parseThreadFromGraphQL(
  graphqlData: unknown,
  mainAuthor: string,
  mainTweetId: string,
): Tweet[] {
  const entries = extractEntries(graphqlData);
  if (entries.length === 0) return [];

  const candidates = collectAuthorTweets(entries, mainAuthor);
  if (candidates.size === 0) return [];

  // Resolve author from focal tweet if URL had no username
  let author = mainAuthor;
  if (!author || author === 'i') {
    const focal = candidates.get(mainTweetId);
    author = focal?.author ?? Array.from(candidates.values())[0]?.author ?? '';
  }

  const filtered =
    author && author !== 'i'
      ? collectAuthorTweets(entries, author)
      : candidates;

  const thread = buildSelfReplyChain(filtered, mainTweetId);

  return thread
    .filter((t) => t.text || t.images.length > 0)
    .map((t) => ({
      id: t.id,
      text: t.text,
      images: t.images,
    }));
}

export function extractAuthorFromGraphQL(
  graphqlData: unknown,
  mainTweetId: string,
): string | null {
  const entries = extractEntries(graphqlData);
  for (const entry of entries) {
    const results = [
      entry.content?.itemContent?.tweet_results?.result,
      ...(entry.content?.items ?? []).map((i) => i.item?.itemContent?.tweet_results?.result),
    ];
    for (const result of results) {
      const unwrapped = unwrapResult(result);
      if (!unwrapped) continue;
      const id = (unwrapped.rest_id as string) || '';
      if (id === mainTweetId) {
        return getScreenName(unwrapped) || null;
      }
    }
  }
  return null;
}

export function isTweetDetailResponse(url: string): boolean {
  return /graphql\/[^/]+\/TweetDetail/i.test(url);
}

export function extractAuthorFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    if (parts[0] && parts[0] !== 'i' && parts[0] !== 'status') {
      return parts[0];
    }
  } catch {
    // ignore
  }
  return null;
}
