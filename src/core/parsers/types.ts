import type { LeetoChapter } from '@/types';

/** Bytes respaldados por ArrayBuffer (no SharedArrayBuffer): compatibles con Blob y WebCrypto. */
export type ByteArray = Uint8Array<ArrayBuffer>;

export type ParseStage = 'parsing' | 'extracting-assets' | 'normalizing' | 'done';

export interface ParseProgress {
  stage: ParseStage;
  percent: number; // 0..100
  message?: string;
}

export interface RawAsset {
  id: string;
  kind: 'cover' | 'image' | 'other';
  mimeType: string;
  bytes: ByteArray;
  width?: number;
  height?: number;
}

export interface ParseRequest {
  contentHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  bytes: ByteArray;
}

export interface ParseResult {
  contentHash: string;
  title: string;
  author: string;
  language?: string;
  saga?: string;
  volumeNumber?: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  coverAssetId?: string;
  chapters: LeetoChapter[];
  assets: RawAsset[];
  totalWordCount: number;
}

export type ParseErrorCode = 'SCANNED_PDF' | 'INVALID_FORMAT' | 'ENCRYPTED' | 'UNKNOWN';

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly code: ParseErrorCode = 'UNKNOWN',
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export type WorkerRequest = { type: 'parse'; payload: ParseRequest };
export type WorkerResponse =
  | { type: 'progress'; payload: ParseProgress }
  | { type: 'result'; payload: ParseResult }
  | { type: 'error'; message: string; code: ParseErrorCode };

export function isParseError(value: unknown): value is ParseError {
  return value instanceof ParseError;
}
