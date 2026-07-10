export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Arabic / Hebrew and related RTL scripts */
const RTL_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;

const LATIN_RE = /[a-zA-Z]/;

export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  const rtlCount = (text.match(new RegExp(RTL_SCRIPT_RE.source, 'g')) ?? []).length;
  const latinCount = (text.match(new RegExp(LATIN_RE.source, 'g')) ?? []).length;
  return rtlCount > latinCount ? 'rtl' : 'ltr';
}

export function isPrimarilyRtl(text: string): boolean {
  return detectTextDirection(text) === 'rtl';
}

export function sanitizeTweetText(text: string): string {
  return text
    .replace(/https?:\/\/t\.co\/\w+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function linkifyText(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" class="link">$1</a>',
  );
}

export function formatTweetParagraphs(text: string): string {
  const sanitized = sanitizeTweetText(text);
  if (!sanitized) return '';

  const dir = detectTextDirection(sanitized);

  const paragraphs = sanitized.split(/\n{2,}/);
  if (paragraphs.length === 1 && !sanitized.includes('\n')) {
    return `<p dir="${dir}">${escapeHtml(sanitized)}</p>`;
  }

  return paragraphs
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => escapeHtml(line.trim()))
        .filter(Boolean)
        .join('<br>');
      if (!lines) return '';
      const paraDir = detectTextDirection(paragraph);
      return `<p dir="${paraDir}">${lines}</p>`;
    })
    .filter(Boolean)
    .join('');
}
