export function fetchTweetDetail(
  id: string,
  queryIds: string[],
  features: Record<string, boolean>,
  bearer: string,
): Promise<unknown | null>;

export function expandTruncatedTweets(): number;

export function extractTweetsFromDom(): { id: string; text: string; images: string[] }[];

export function isLoginWall(): boolean;

export function scrollToBottom(): void;

export function getThreadAuthor(): string;

export function discoverThreadTweetIds(rootId: string, author: string): string[];

export function discoverThreadIdsFromHtml(rootId: string, author: string): string[];

export function clickShowMoreReplies(): number;
