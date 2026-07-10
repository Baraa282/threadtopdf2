import { getBrowser, closeBrowser } from '../src/services/pdf-generator.js';
import { expandTruncatedTweets } from '../src/services/page-eval.js';

const url = 'https://x.com/rhg7684/status/2036818421736731008';

async function main() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await expandTruncatedTweets(page);

  const info = await page.evaluate(() => {
    const article = document.querySelector('article');
    if (!article) return { error: 'no article' };

    const selectors = [
      '[data-testid="tweetText"]',
      '[data-testid="tweet"] [lang]',
      'div[dir="auto"][lang]',
      '[data-testid="card.wrapper"]',
      'div[data-testid="tweetText"] span',
    ];

    const results: Record<string, number> = {};
    for (const sel of selectors) {
      const els = article.querySelectorAll(sel);
      let total = 0;
      els.forEach((el) => {
        total += (el.textContent || '').length;
      });
      results[sel] = total;
    }

    // Try extracting clean text: all div[dir=auto] with lang inside article, skip user-name area
    const textBlocks: string[] = [];
    article.querySelectorAll('div[dir="auto"]').forEach((el) => {
      if (el.closest('[data-testid="User-Name"]')) return;
      if (el.closest('a[href*="/status/"]') && el.tagName === 'TIME') return;
      const t = el.textContent?.trim();
      if (t && t.length > 50) textBlocks.push(t);
    });

    return {
      selectorLengths: results,
      textBlocksCount: textBlocks.length,
      textBlock0Len: textBlocks[0]?.length ?? 0,
      textBlock0Preview: textBlocks[0]?.slice(0, 200) ?? '',
      langDivs: article.querySelectorAll('div[lang]').length,
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await page.close();
  await closeBrowser();
}

main().catch(console.error);
