import type { ApiError, GenerateRequest, PdfOptions } from '@thread-to-pdf/shared';

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 180_000;

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_URL: 'Please enter a valid public X (Twitter) thread URL.',
  THREAD_NOT_FOUND: 'This thread was not found. It may have been deleted.',
  PRIVATE_THREAD: 'This thread is private. Only public threads can be converted.',
  DELETED_THREAD: 'This thread appears to have been deleted.',
  RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
  NETWORK_TIMEOUT: 'The request timed out. Please try again on a stable connection.',
  UNSUPPORTED_CONTENT: 'This thread has no content that can be converted.',
  THREAD_TOO_LONG: 'This thread is too long. Please use a shorter thread.',
  INTERNAL_ERROR: 'Something went wrong. Please try again later.',
  CHROME_NOT_INSTALLED:
    'PDF generation is not ready yet. Wait a minute and try again.',
  API_UNAVAILABLE:
    'Cannot reach the PDF server. Deploy the backend and set VITE_API_URL in Netlify to your API URL.',
};

export function getErrorMessage(error: ApiError): string {
  return ERROR_MESSAGES[error.code] ?? error.message;
}

export interface GenerateResult {
  blob: Blob;
  filename: string;
  tweetCount?: number;
  contentChars?: number;
}

function extractFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return 'thread.pdf';
  const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
  return match?.[1] ?? 'thread.pdf';
}

export async function generatePdf(request: GenerateRequest): Promise<GenerateResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        code: 'NETWORK_TIMEOUT',
        message: ERROR_MESSAGES.NETWORK_TIMEOUT,
      } satisfies ApiError;
    }

    throw {
      code: 'API_UNAVAILABLE',
      message: ERROR_MESSAGES.API_UNAVAILABLE,
    } satisfies ApiError;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const error = (await response.json()) as ApiError;
      throw error;
    }

    if (response.status === 404) {
      throw {
        code: 'API_UNAVAILABLE',
        message: ERROR_MESSAGES.API_UNAVAILABLE,
      } satisfies ApiError;
    }

    throw {
      code: 'INTERNAL_ERROR',
      message: `Failed to generate PDF (server returned ${response.status}).`,
    } satisfies ApiError;
  }

  const blob = await response.blob();
  const filename = extractFilename(response.headers.get('Content-Disposition'));
  const tweetCount = parseInt(response.headers.get('X-Tweet-Count') ?? '', 10);
  const contentChars = parseInt(response.headers.get('X-Content-Chars') ?? '', 10);

  return {
    blob,
    filename,
    tweetCount: Number.isFinite(tweetCount) ? tweetCount : undefined,
    contentChars: Number.isFinite(contentChars) ? contentChars : undefined,
  };
}

export type { PdfOptions };
