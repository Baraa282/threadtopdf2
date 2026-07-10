/**
 * Plain JS functions for Puppeteer page.evaluate().
 * Must stay in .js (no esbuild __name helpers) so serialization works in the browser.
 */

export async function fetchTweetDetail(id, queryIds, features, bearer) {
  let ct0 = document.cookie.match(/ct0=([^;]+)/)?.[1];
  let guestToken = null;

  if (!ct0) {
    try {
      const guestResp = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
        method: 'POST',
        headers: { authorization: bearer },
      });
      if (guestResp.ok) {
        const guestData = await guestResp.json();
        guestToken = guestData.guest_token ?? null;
      }
    } catch {
      // continue
    }
  }

  if (!ct0 && !guestToken) return null;

  const variables = JSON.stringify({
    focalTweetId: id,
    with_rux_injections: false,
    rankingMode: 'Relevance',
    includePromotedContent: false,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
  });

  const featuresStr = JSON.stringify(features);

  for (const queryId of queryIds) {
    const url =
      'https://x.com/i/api/graphql/' +
      queryId +
      '/TweetDetail?variables=' +
      encodeURIComponent(variables) +
      '&features=' +
      encodeURIComponent(featuresStr);
    try {
      const headers = {
        authorization: bearer,
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
      };

      if (ct0) {
        headers['x-csrf-token'] = ct0;
        headers['x-twitter-auth-type'] = 'OAuth2Session';
      }
      if (guestToken) {
        headers['x-guest-token'] = guestToken;
      }

      const resp = await fetch(url, { headers, credentials: 'include' });
      if (!resp.ok) continue;
      const json = await resp.json();
      if (json?.data?.threaded_conversation_with_injections_v2) return json;
    } catch {
      continue;
    }
  }
  return null;
}

export function expandTruncatedTweets() {
  let count = 0;
  document.querySelectorAll('[data-testid="tweet-text-show-more-link"]').forEach(function (el) {
    el.click();
    count++;
  });
  document.querySelectorAll('span[role="button"], button').forEach(function (el) {
    const text = (el.textContent || '').toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    if (
      text.includes('show more') ||
      text.includes('عرض') ||
      aria.includes('show more') ||
      aria.includes('more')
    ) {
      el.click();
      count++;
    }
  });
  return count;
}

export function extractTweetsFromDom() {
  const results = [];
  const articles = Array.from(document.querySelectorAll('article'));
  if (articles.length === 0) return results;

  function getAuthor(article) {
    const userName = article.querySelector('[data-testid="User-Name"]');
    const link = userName ? userName.querySelector('a[href^="/"]') : null;
    const href = link ? link.getAttribute('href') || '' : '';
    const match = href.match(/^\/([^/?]+)/);
    return match ? match[1].toLowerCase() : null;
  }

  const threadAuthor = getAuthor(articles[0]);

  function extractArticleText(article) {
    const textParts = [];
    article.querySelectorAll('[data-testid="tweetText"]').forEach(function (el) {
      const t = el.textContent ? el.textContent.trim() : '';
      if (t) textParts.push(t);
    });

    const standardText = textParts.join('\n');
    if (standardText.length > 0) return standardText;

    // Long-form / note tweets use div[dir="auto"] instead of tweetText
    var best = '';
    article.querySelectorAll('div[dir="auto"]').forEach(function (el) {
      if (el.closest('[data-testid="User-Name"]')) return;
      if (el.closest('[data-testid="socialContext"]')) return;
      if (el.closest('[role="group"]')) return;
      var t = el.textContent ? el.textContent.trim() : '';
      if (t && t.length > best.length) best = t;
    });

    return best;
  }

  articles.forEach(function (article, index) {
    const author = getAuthor(article);
    if (threadAuthor && author && author !== threadAuthor) return;

    const text = extractArticleText(article);

    const images = [];
    article.querySelectorAll('img').forEach(function (img) {
      const src = img.getAttribute('src') || '';
      if (src.includes('pbs.twimg.com/media') && images.indexOf(src) === -1) {
        images.push(src.replace(/&name=\w+/, '&name=large'));
      }
    });

    if (text || images.length > 0) {
      const tweetLink = article.querySelector('a[href*="/status/"]');
      const tweetUrl = tweetLink ? tweetLink.getAttribute('href') : '';
      const idMatch = tweetUrl ? tweetUrl.match(/status\/(\d+)/) : null;
      results.push({
        id: idMatch ? idMatch[1] : 'tweet-' + index,
        text: text,
        images: images.slice(0, 4),
      });
    }
  });

  return results;
}

export function isLoginWall() {
  const body = document.body ? document.body.innerText : '';
  return (
    (body.includes('Sign in to X') || body.includes('Log in to X')) &&
    document.querySelectorAll('article').length === 0
  );
}

export function scrollToBottom() {
  window.scrollTo(0, document.body.scrollHeight);
}

export function clickShowMoreReplies() {
  var count = 0;
  document.querySelectorAll('span[role="button"], a, button').forEach(function (el) {
    var text = (el.textContent || '').toLowerCase();
    if (
      text.includes('show more replies') ||
      text.includes('show replies') ||
      text.includes('عرض المزيد من الردود') ||
      text.includes('عرض الردود') ||
      text.includes('show this thread')
    ) {
      el.click();
      count++;
    }
  });
  return count;
}

export function getThreadAuthor() {
  var link = document.querySelector('article [data-testid="User-Name"] a[href^="/"]');
  var href = link ? link.getAttribute('href') || '' : '';
  var m = href.match(/^\/([^/?]+)/);
  return m ? m[1] : '';
}

/** Collect tweet IDs from visible articles (same-author thread on page). */
export function discoverThreadTweetIds(rootId, author) {
  var ids = [];
  var seen = {};

  function add(id) {
    if (!id || seen[id]) return;
    seen[id] = true;
    ids.push(id);
  }

  add(rootId);

  var authorLower = (author || '').toLowerCase();

  document.querySelectorAll('article').forEach(function (article) {
    var userName = article.querySelector('[data-testid="User-Name"]');
    var link = userName ? userName.querySelector('a[href^="/"]') : null;
    var href = link ? link.getAttribute('href') || '' : '';
    var authorMatch = href.match(/^\/([^/?]+)/);
    var articleAuthor = authorMatch ? authorMatch[1].toLowerCase() : '';

    if (authorLower && articleAuthor && articleAuthor !== authorLower) return;

    article.querySelectorAll('a[href*="/status/"]').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      var m = h.match(/status\/(\d{15,25})/);
      if (m) add(m[1]);
    });
  });

  ids.sort(function (a, b) {
    try {
      if (BigInt(a) < BigInt(b)) return -1;
      if (BigInt(a) > BigInt(b)) return 1;
      return 0;
    } catch (e) {
      return 0;
    }
  });

  return ids;
}

/** Scan full page HTML for tweet IDs (catches IDs in embedded JSON). */
export function discoverThreadIdsFromHtml(rootId, author) {
  var seen = {};
  var ids = [];

  function add(id) {
    if (!id || seen[id]) return;
    seen[id] = true;
    ids.push(id);
  }

  add(rootId);

  var html = document.documentElement.innerHTML;

  if (author) {
    var authorRe = new RegExp('/' + author + '/status/(\\d{15,25})', 'gi');
    var m;
    while ((m = authorRe.exec(html)) !== null) {
      add(m[1]);
    }
  } else {
    var re = /\/status\/(\d{15,25})/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      add(m[1]);
    }
  }

  ids.sort(function (a, b) {
    try {
      if (BigInt(a) < BigInt(b)) return -1;
      if (BigInt(a) > BigInt(b)) return 1;
      return 0;
    } catch (e) {
      return 0;
    }
  });

  return ids;
}
