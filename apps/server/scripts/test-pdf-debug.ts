import { fetchThread } from '../src/services/thread-fetcher.js';
import { generatePdf, closeBrowser } from '../src/services/pdf-generator.js';
import { DEFAULT_PDF_OPTIONS } from '@thread-to-pdf/shared';
import fs from 'node:fs';

async function main() {
  await closeBrowser();
  const thread = await fetchThread('https://x.com/rhg7684/status/2036818421736731008');
  const pdf = await generatePdf(thread, DEFAULT_PDF_OPTIONS);
  fs.writeFileSync('/tmp/thread-debug.pdf', pdf);
  console.log('PDF bytes:', pdf.length);
  await closeBrowser();
}

main().catch(console.error);
