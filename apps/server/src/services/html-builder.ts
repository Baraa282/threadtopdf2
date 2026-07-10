import type { PdfOptions, Thread } from '@thread-to-pdf/shared';
import { escapeHtml, formatTweetParagraphs, isPrimarilyRtl } from '../lib/sanitize.js';
import { isAllowedImageUrl } from '../lib/url-validator.js';

const FONT_FAMILIES: Record<NonNullable<PdfOptions['fontFamily']>, string> = {
  thmanyah: "'Thmanyah Serif', 'Noto Sans Arabic', serif",
  inter: "'Inter', 'Noto Sans Arabic', system-ui, sans-serif",
  geist: "'Geist', 'Inter', 'Noto Sans Arabic', system-ui, sans-serif",
  'ibm-plex': "'IBM Plex Sans', 'Noto Sans Arabic', system-ui, sans-serif",
  'noto-sans': "'Noto Sans', 'Noto Sans Arabic', system-ui, sans-serif",
};

const FONT_IMPORTS: Record<Exclude<NonNullable<PdfOptions['fontFamily']>, 'thmanyah'>, string> = {
  inter:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap',
  geist:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap',
  'ibm-plex':
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap',
  'noto-sans':
    'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap',
};

const THMANYAH_FONT_FACE = `
  @font-face {
    font-family: 'Thmanyah Serif';
    src: url('fonts/thmanyahseriftext-Regular.otf') format('opentype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
`;

function getImageGridClass(count: number): string {
  switch (count) {
    case 1:
      return 'grid-1';
    case 2:
      return 'grid-2';
    case 3:
      return 'grid-3';
    case 4:
      return 'grid-4';
    default:
      return 'grid-many';
  }
}

function renderImages(images: string[]): string {
  const validImages = images.filter(isAllowedImageUrl).slice(0, 4);
  if (validImages.length === 0) return '';

  const gridClass = getImageGridClass(validImages.length);
  const items = validImages
    .map(
      (src) =>
        `<figure class="image-item"><img src="${escapeHtml(src)}" alt="" /></figure>`,
    )
    .join('');

  return `<div class="image-grid ${gridClass}">${items}</div>`;
}

function renderTweetBlock(tweet: Thread['tweets'][0], index: number): string {
  const textHtml = formatTweetParagraphs(tweet.text);
  const imagesHtml = renderImages(tweet.images);

  if (!textHtml && !imagesHtml) return '';

  const dir = isPrimarilyRtl(tweet.text) ? 'rtl' : 'auto';

  return `
    <article class="tweet-block" dir="${dir}" aria-label="Tweet ${index + 1}">
      ${textHtml}
      ${imagesHtml}
    </article>
  `;
}

function renderCoverPage(title: string): string {
  const dir = isPrimarilyRtl(title) ? 'rtl' : 'auto';
  const textAlign = isPrimarilyRtl(title) ? 'right' : 'center';

  return `
    <section class="cover-page" dir="${dir}" style="text-align: ${textAlign}">
      <div class="cover-content">
        <h1 class="cover-title">${escapeHtml(title)}</h1>
        <div class="cover-divider"></div>
      </div>
    </section>
  `;
}

function detectDocumentDirection(thread: Thread): 'rtl' | 'ltr' {
  const allText = thread.tweets.map((t) => t.text).join(' ');
  return isPrimarilyRtl(allText) ? 'rtl' : 'ltr';
}

export function buildThreadHtml(thread: Thread, options: Required<PdfOptions>): string {
  const fontFamily = FONT_FAMILIES[options.fontFamily];
  const usesThmanyah = options.fontFamily === 'thmanyah';
  const fontImport = usesThmanyah ? null : FONT_IMPORTS[options.fontFamily as keyof typeof FONT_IMPORTS];
  const fontFaceCss = usesThmanyah ? THMANYAH_FONT_FACE : '';
  const fontSize = options.fontSize;
  const lineHeight = 1.8;
  const docDir = detectDocumentDirection(thread);
  const lang = docDir === 'rtl' ? 'ar' : 'en';

  const tweetBlocks = thread.tweets
    .map((tweet, index) => renderTweetBlock(tweet, index))
    .filter(Boolean)
    .join('\n');

  const coverHtml = options.coverPage ? renderCoverPage(thread.title) : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${docDir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(thread.title)}</title>
  ${
    fontImport
      ? `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${fontImport}" rel="stylesheet" />`
      : ''
  }
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    ${fontFaceCss}

    @page {
      size: A4;
      margin: 72px 64px;
    }

    html {
      font-size: ${fontSize}px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: ${fontFamily};
      font-size: 1rem;
      line-height: ${lineHeight};
      color: #1a1a1a;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
      text-align: start;
    }

    .document {
      max-width: 720px;
      margin: 0 auto;
    }

    /* Cover Page */
    .cover-page {
      page-break-after: always;
      break-after: page;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
    }

    .cover-content {
      max-width: 600px;
      width: 100%;
    }

    .cover-title {
      font-size: 2.4rem;
      font-weight: 700;
      line-height: 1.4;
      letter-spacing: 0;
      color: #111827;
      unicode-bidi: plaintext;
    }

    [dir="rtl"] .cover-title {
      letter-spacing: 0;
    }

    .cover-divider {
      width: 48px;
      height: 3px;
      background: #e5e7eb;
      margin: 32px auto 0;
      border-radius: 2px;
    }

    [dir="rtl"] .cover-divider {
      margin-inline: auto 0;
      margin-right: auto;
      margin-left: 0;
    }

    /* Tweet Blocks */
    .tweet-block {
      margin-bottom: 3rem;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: start;
    }

    .tweet-block p {
      margin-bottom: 1rem;
      color: #1f2937;
      word-wrap: break-word;
      overflow-wrap: break-word;
      unicode-bidi: plaintext;
      text-align: start;
    }

    .tweet-block p[dir="rtl"] {
      text-align: right;
    }

    .tweet-block p[dir="ltr"] {
      text-align: left;
    }

    .tweet-block p:last-of-type {
      margin-bottom: 0;
    }

    .tweet-block .link {
      color: #2563eb;
      text-decoration: underline;
      text-underline-offset: 2px;
      unicode-bidi: embed;
    }

    /* Image Grids */
    .image-grid {
      margin-top: 1.5rem;
      display: grid;
      gap: 12px;
      width: 100%;
    }

    .image-grid.grid-1 {
      grid-template-columns: 1fr;
    }

    .image-grid.grid-2 {
      grid-template-columns: 1fr 1fr;
    }

    .image-grid.grid-3 {
      grid-template-columns: 1fr 1fr;
    }

    .image-grid.grid-3 .image-item:first-child {
      grid-column: 1 / -1;
    }

    .image-grid.grid-4 {
      grid-template-columns: 1fr 1fr;
    }

    .image-grid.grid-many {
      grid-template-columns: 1fr 1fr;
    }

    .image-item {
      margin: 0;
      overflow: hidden;
      border-radius: 10px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }

    .image-item img {
      display: block;
      width: 100%;
      height: auto;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <main class="document">
    ${coverHtml}
    <div class="content">
      ${tweetBlocks}
    </div>
  </main>
</body>
</html>`;
}
