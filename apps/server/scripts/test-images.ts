import { fetchThread } from '../src/services/thread-fetcher.js';
import { prepareThreadAssets, cleanupThreadAssets } from '../src/services/image-assets.js';
import { buildThreadHtml } from '../src/services/html-builder.js';
import { DEFAULT_PDF_OPTIONS } from '@thread-to-pdf/shared';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const thread = await fetchThread('https://x.com/rhg7684/status/2036818421736731008');
  console.log('Before assets:', thread.tweets.map((t) => t.images.length));

  const { thread: prepared, assetsDir } = await prepareThreadAssets(thread);
  console.log('After assets:', prepared.tweets.map((t) => t.images.length));

  const html = buildThreadHtml(prepared, DEFAULT_PDF_OPTIONS);
  await writeFile(join(assetsDir, 'index.html'), html);
  console.log('img tags:', (html.match(/<img/g) ?? []).length);
  console.log('assets dir:', assetsDir);

  await cleanupThreadAssets(assetsDir);
}

main().catch(console.error);
