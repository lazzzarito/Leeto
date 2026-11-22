// Modelo de dominio de Leeto (alineado con leeto.md v2.1, sección 6.1).

export type ReadingTheme = 'paper' | 'amber' | 'sepia' | 'eink' | 'oled';

export type PlaybackState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'ended'
  | 'error';

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
  wordCount: number;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  assetId: string;
  caption?: string;
  alt?: string;
}

export type LeetoBlock = TextBlock | ImageBlock;

export interface LeetoChapter {
  index: number; // 0-based
  title: string;
  blocks: LeetoBlock[];
  startPage?: number; // PDF: primera página (1-based) de la sección
}

/** Entrada del índice; apunta siempre a una sección real del libro. */
export interface TocEntry {
  id: string;
  title: string;
  chapterIndex: number;
  blockId?: string;
  children: TocEntry[];
}

export interface LeetoBook {
  id: string; // contentHash (sha256)
  contentHash: string;
  title: string;
  author: string;
  language?: string;
  coverAssetId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string; // application/epub+zip | application/pdf
  saga?: string;
  volumeNumber?: number;
  chapters: LeetoChapter[];
  toc?: TocEntry[];
  totalWordCount: number;
  importedAt: number;
  updatedAt: number;
}

export interface StoredAsset {
  id: string;
  bookId: string;
  kind: 'cover' | 'image' | 'other';
  mimeType: string;
  blob: Blob;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  blockId: string;
  segmentIndex?: number; // subtítulo dentro del bloque; ausente en progresos antiguos
  percentage: number; // 0..100
  updatedAt: number; // epoch ms UTC
  deviceId: string;
}

export interface SavedQuote {
  id: string; // uuid
  bookId: string;
  chapterIndex: number;
  blockId: string;
  excerpt: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // tombstone para sync
}

export interface AppSettings {
  id: 'singleton';
  deviceId: string;
  readingTheme: ReadingTheme;
  fontSize: number;
  lineHeight: number;
  wpm: number;
  playbackSpeed: number;
  kineticTextEnabled: boolean;
  focusDimIntensity: number; // 0..1
  imageDurationMs: number; // duración base de imágenes antes de aplicar velocidad
  ttsEnabled: boolean;
  ttsVoiceURI?: string;
  reducedMotion?: 'system' | 'on' | 'off';
  syncEnabled: boolean;
  syncProvider?: 'webdav' | 'local-folder' | 'gdrive' | 'onedrive';
  syncWebDavUrl?: string;
  syncWebDavUsername?: string;
}

export interface SyncEnvelope {
  schemaVersion: 1;
  updatedAt: number;
  originDeviceId: string;
  devices: Record<string, number>;
  progress: Record<string, ReadingProgress>;
  quotes: Record<string, SavedQuote>;
  libraryRefs?: Record<
    string,
    { id: string; fileName: string; fileSize: number; updatedAt: number }
  >;
}
