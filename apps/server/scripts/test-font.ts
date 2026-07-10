import { fetchThread } from '../src/services/thread-fetcher.js';
import { prepareThreadAssets } from '../src/services/image-assets.js';
import { buildThreadHtml } from '../src/services/html-builder.js';
import { startAssetServer } from '../src/services/asset-server.js';
import { getBrowser, closeBrowser } from '../src/services/pdf-generator.js';
import { DEFAULT_PDF_OPTIONS } from '@thread-to-pdf/shared';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  await closeBrowser();
  const thread = await fetchThread('https://x.com/rhg7684/status/2036818421736731008');
  const { thread: prepared, assetsDir } = await prepareThreadAssets(thread);
  const html = buildThreadHtml(prepared, DEFAULT_PDF_OPTIONS);
  await writeFile(join(assetsDir, 'index.html'), html);

  const server = await startAssetServer(assetsDir);
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/index.html`, { waitUntil: 'networkidle0', timeout: 90_000 });
  await page.evaluate(() => document.fonts.ready);

  const fontInfo = await page.evaluate(
    `({
      bodyFont: getComputedStyle(document.body).fontFamily,
      fontsLoaded: Array.from(document.fonts).map(function(f) { return f.family + ' ' + f.status; })
    })`,
  );
  console.log(fontInfo);

  await server.close();
  await page.close();
  await closeBrowser();
}

main().catch(console.error);
