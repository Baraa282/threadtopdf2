import { fetchThread } from '../src/services/thread-fetcher.js';
import { closeBrowser } from '../src/services/pdf-generator.js';

const url = process.argv[2] ?? 'https://x.com/rhg7684/status/2036818421736731008';

async function main() {
  const thread = await fetchThread(url);
  console.log('Title:', thread.title.slice(0, 80));
  console.log('Tweet count:', thread.tweets.length);
  for (const [i, t] of thread.tweets.entries()) {
    console.log(`--- Tweet ${i + 1} | id: ${t.id} | chars: ${t.text.length} | images: ${t.images.length}`);
    console.log(t.text.slice(0, 300));
    if (t.text.length > 300) console.log('...');
  }
  await closeBrowser();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
