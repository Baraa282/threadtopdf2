export interface Tweet {
  id: string;
  text: string;
  images: string[];
}

export interface Thread {
  id: string;
  title: string;
  tweets: Tweet[];
}

export interface GenerateRequest {
  url: string;
  options?: PdfOptions;
}

export interface PdfOptions {
  coverPage?: boolean;
  pageNumbers?: boolean;
  fontFamily?: 'thmanyah' | 'inter' | 'geist' | 'ibm-plex' | 'noto-sans';
  fontSize?: number;
  theme?: 'classic' | 'modern' | 'minimal';
}

export type ErrorCode =
  | 'INVALID_URL'
  | 'THREAD_NOT_FOUND'
  | 'PRIVATE_THREAD'
  | 'DELETED_THREAD'
  | 'RATE_LIMIT'
  | 'NETWORK_TIMEOUT'
  | 'UNSUPPORTED_CONTENT'
  | 'THREAD_TOO_LONG'
  | 'API_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ErrorCode;
  message: string;
}

export const DEFAULT_PDF_OPTIONS: Required<PdfOptions> = {
  coverPage: false,
  pageNumbers: true,
  fontFamily: 'thmanyah',
  fontSize: 17,
  theme: 'classic',
};

export const MAX_TWEETS = 200;
export const MAX_URL_LENGTH = 2048;
