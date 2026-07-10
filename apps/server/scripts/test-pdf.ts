import { fetchThread } from '../src/services/thread-fetcher.js';
import { buildThreadHtml } from '../src/services/html-builder.js';
import { generatePdf, closeBrowser } from '../src/services/pdf-generator.js';
import { DEFAULT_PDF_OPTIONS } from '@thread-to-pdf/shared';
import fs from 'fs';

const url = process.argv[2] ?? 'https://x.com/rhg7684/status/2036818421736731008';

async function main() {
  const thread = await fetchThread(url);
  console.log('tweets:', thread.tweets.length, 'chars:', thread.tweets[0]?.text.length);

  const html = buildThreadHtml(thread, DEFAULT_PDF_OPTIONS);
  fs.writeFileSync('/tmp/thread-preview.html', html);
  console.log('HTML length:', html.length);
  console.log('HTML has المنشورات:', html.includes('المنشورات'));

  const pdf = await generatePdf(thread, DEFAULT_PDF_OPTIONS);
  fs.writeFileSync('/tmp/thread-full.pdf', pdf);
  console.log('PDF bytes:', pdf.length);

  await closeBrowser();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
