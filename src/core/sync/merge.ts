import type { ReadingProgress, SavedQuote, SyncEnvelope } from '@/types';

type LibraryRef = NonNullable<SyncEnvelope['libraryRefs']>[string];

export interface MergeResult {
  envelope: SyncEnvelope;
  progress: ReadingProgress[];
  quotes: SavedQuote[];
  libraryRefs: Record<string, LibraryRef>;
  /** true si el merge cambió algún registro respecto al sobre local. */
  changed: boolean;
}

/** Serialización estable para comparaciones deterministas. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

/** Huella completa del sobre (incluye devices), útil para detectar cambios efectivos. */
export function envelopeFingerprint(envelope: SyncEnvelope): string {
  return stableStringify({
    devices: envelope.devices ?? {},
    progress: envelope.progress ?? {},
    quotes: envelope.quotes ?? {},
    libraryRefs: envelope.libraryRefs ?? {},
  });
}

/** Huella de los registros; el sello de escritura (devices/updatedAt) no cuenta como cambio. */
export function recordsFingerprint(envelope: SyncEnvelope): string {
  return stableStringify({
    progress: envelope.progress ?? {},
    quotes: envelope.quotes ?? {},
    libraryRefs: envelope.libraryRefs ?? {},
  });
}

function compareProgress(a: ReadingProgress, b: ReadingProgress): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  // Desempate determinista especificado en §7.2.
  return a.deviceId.localeCompare(b.deviceId);
}

function compareQuotes(a: SavedQuote, b: SavedQuote): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  // En empate gana el tombstone; después, comparación estable del contenido.
  const aDeleted = a.deletedAt ?? 0;
  const bDeleted = b.deletedAt ?? 0;
  if (aDeleted !== bDeleted) return aDeleted - bDeleted;
  return stableStringify(a).localeCompare(stableStringify(b));
}

function compareRefs(a: LibraryRef, b: LibraryRef): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  return a.fileName.localeCompare(b.fileName);
}

/** Merge por registro: nunca reemplaza el sobre global. Conmutativo en su contenido. */
export function mergeEnvelopes(local: SyncEnvelope, remote: SyncEnvelope): MergeResult {
  const devices: Record<string, number> = { ...(local.devices ?? {}) };
  for (const [deviceId, lastSeenAt] of Object.entries(remote.devices ?? {})) {
    devices[deviceId] = Math.max(devices[deviceId] ?? 0, lastSeenAt);
  }

  const progressMap = new Map<string, ReadingProgress>();
  for (const item of Object.values(local.progress ?? {})) progressMap.set(item.bookId, item);
  for (const item of Object.values(remote.progress ?? {})) {
    const current = progressMap.get(item.bookId);
    if (!current || compareProgress(item, current) > 0) progressMap.set(item.bookId, item);
  }

  const quotesMap = new Map<string, SavedQuote>();
  for (const item of Object.values(local.quotes ?? {})) quotesMap.set(item.id, item);
  for (const item of Object.values(remote.quotes ?? {})) {
    const current = quotesMap.get(item.id);
    if (!current || compareQuotes(item, current) > 0) quotesMap.set(item.id, item);
  }

  const refsMap = new Map<string, LibraryRef>();
  for (const item of Object.values(local.libraryRefs ?? {})) refsMap.set(item.id, item);
  for (const item of Object.values(remote.libraryRefs ?? {})) {
    const current = refsMap.get(item.id);
    if (!current || compareRefs(item, current) > 0) refsMap.set(item.id, item);
  }

  const progress = [...progressMap.values()];
  const quotes = [...quotesMap.values()];
  const libraryRefs = Object.fromEntries(refsMap);
  const envelope: SyncEnvelope = {
    schemaVersion: 1,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    originDeviceId: local.originDeviceId,
    devices,
    progress: Object.fromEntries(progress.map((item) => [item.bookId, item])),
    quotes: Object.fromEntries(quotes.map((item) => [item.id, item])),
    libraryRefs,
  };

  return {
    envelope,
    progress,
    quotes,
    libraryRefs,
    changed: envelopeFingerprint(local) !== envelopeFingerprint(envelope),
  };
}

/** Marca el sobre como emitido por este dispositivo antes de escribirlo. */
export function prepareForWrite(
  envelope: SyncEnvelope,
  deviceId: string,
  now = Date.now(),
): SyncEnvelope {
  return {
    ...envelope,
    updatedAt: Math.max(envelope.updatedAt, now),
    originDeviceId: deviceId,
    devices: { ...(envelope.devices ?? {}), [deviceId]: Math.max(envelope.devices?.[deviceId] ?? 0, now) },
  };
}

/** Solo citas vigentes (para inspección/tests); los tombstones se conservan en el sobre. */
export function liveQuotes(envelope: SyncEnvelope): SavedQuote[] {
  return Object.values(envelope.quotes ?? {}).filter((quote) => !quote.deletedAt);
}
