// Modelo de dominio de Leeto (alineado con leeto.md v2.1, sección 6.1).

export type ReadingTheme = 'paper' | 'sepia' | 'graphite' | 'oled';

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
  heading?: boolean;
  page?: number; // PDF: página de origen (1-based), usada por el índice.
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
  favorite?: boolean;
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

export type ReadingStatus = 'unread' | 'reading' | 'finished';

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  blockId: string;
  segmentIndex?: number; // subtítulo dentro del bloque; ausente en progresos antiguos
  percentage: number; // 0..100
  updatedAt: number; // epoch ms UTC
  deviceId: string;
  deletedAt?: number; // tombstone para sync; el libro se borró o se marcó como no leído
  status?: ReadingStatus; // estado explícito; el porcentaje es solo una estimación
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

/** Raíz de escaneo recordada; el handle solo existe en navegadores con File System Access. */
export interface ScanRoot {
  id: string;
  name: string;
  addedAt: number;
  handle?: FileSystemDirectoryHandle;
}

export interface AppSettings {
  id: 'singleton';
  deviceId: string;
  readingTheme: ReadingTheme;
  /** `system` sigue prefers-color-scheme; `manual` usa readingTheme. */
  themeMode?: 'system' | 'manual';
  onboardingCompleted?: boolean;
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
  scanRoots?: ScanRoot[];
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
