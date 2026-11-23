import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import type { ReadingProgress, SavedQuote, SyncEnvelope } from '@/types';
import { applyMergeResult, loadLocalEnvelope } from './apply';
import {
  BACKUP_FILENAME,
  LAST_APPLIED_KEY,
  PREV_BACKUP_FILENAME,
  rotateBackup,
  restoreBackup,
  serializeBackup,
  type BackupStore,
} from './backup';
import { createEmptyEnvelope, parseEnvelope, serializeEnvelope } from './envelope';
import {
  envelopeFingerprint,
  liveQuotes,
  mergeEnvelopes,
  prepareForWrite,
  stableStringify,
} from './merge';

function progress(bookId: string, deviceId: string, updatedAt: number): ReadingProgress {
  return {
    bookId,
    chapterIndex: 1,
    blockId: 'b_002',
    percentage: 42,
    updatedAt,
    deviceId,
  };
}

function quote(
  id: string,
  updatedAt: number,
  extra: Partial<SavedQuote> = {},
): SavedQuote {
  return {
    id,
    bookId: 'book_1',
    chapterIndex: 1,
    blockId: 'b_002',
    excerpt: 'Fragmento',
    createdAt: 1,
    updatedAt,
    ...extra,
  };
}

function envelope(
  deviceId: string,
  records: { progress?: ReadingProgress[]; quotes?: SavedQuote[] },
  updatedAt = 100,
): SyncEnvelope {
  const base = createEmptyEnvelope(deviceId, updatedAt);
  return {
    ...base,
    devices: { [deviceId]: updatedAt },
    progress: Object.fromEntries((records.progress ?? []).map((item) => [item.bookId, item])),
    quotes: Object.fromEntries((records.quotes ?? []).map((item) => [item.id, item])),
  };
}

class MemoryStore implements BackupStore {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('sobre de sincronización', () => {
  it('round-trip export/import sin pérdida', () => {
    const original = envelope('dev_A', {
      progress: [progress('book_1', 'dev_A', 100)],
      quotes: [quote('q_1', 90)],
    });
    const restored = parseEnvelope(serializeEnvelope(original));
    expect(restored).toEqual(original);
  });

  it('rechaza JSON inválido y versiones no soportadas', () => {
    expect(() => parseEnvelope('{')).toThrow(/JSON válido/);
    expect(() => parseEnvelope('{"schemaVersion":2}')).toThrow(/inválido|no soportada/);
  });

  it('rechaza registros sin clave primaria o con fechas inválidas', () => {
    const broken = envelope('dev_A', { progress: [progress('book_1', 'dev_A', 100)] }, 100);
    broken.progress.book_1 = { ...progress('book_1', 'dev_A', 100), bookId: '' };
    expect(() => parseEnvelope(serializeEnvelope(broken))).toThrow(/inválido/);

    const badDate = envelope('dev_A', { quotes: [quote('q_1', 100)] }, 100);
    badDate.quotes.q_1 = { ...quote('q_1', 100), updatedAt: Number.NaN };
    expect(() => parseEnvelope(serializeEnvelope(badDate))).toThrow(/inválido/);

    const badRef = envelope('dev_A', {}, 100);
    badRef.libraryRefs = { book_1: { id: 'book_1', fileName: null as never, fileSize: 1, updatedAt: 100 } };
    expect(() => parseEnvelope(serializeEnvelope(badRef))).toThrow(/inválido/);
  });

  it('rechaza relojes de dispositivo no numéricos', () => {
    const broken = envelope('dev_A', {}, 100);
    broken.devices.dev_B = null as never;
    expect(() => parseEnvelope(serializeEnvelope(broken))).toThrow(/inválido/);
  });
});

describe('merge por registro', () => {
  it('A y B conservan su progreso y la cita sobrevive (escenario multi-dispositivo)', () => {
    const a = envelope('dev_A', { progress: [progress('book_1', 'dev_A', 100)] }, 100);
    const b = envelope(
      'dev_B',
      { progress: [progress('book_2', 'dev_B', 110)], quotes: [quote('q_1', 110)] },
      110,
    );

    const merged = mergeEnvelopes(a, b);
    expect(Object.keys(merged.envelope.progress).sort()).toEqual(['book_1', 'book_2']);
    expect(merged.envelope.progress.book_1).toEqual(progress('book_1', 'dev_A', 100));
    expect(merged.envelope.progress.book_2).toEqual(progress('book_2', 'dev_B', 110));
    expect(liveQuotes(merged.envelope)).toHaveLength(1);
    expect(merged.envelope.devices).toEqual({ dev_A: 100, dev_B: 110 });
    expect(merged.changed).toBe(true);
    // El contenido es conmutativo, sin importar el orden de llegada.
    expect(envelopeFingerprint(mergeEnvelopes(b, a).envelope)).toBe(
      envelopeFingerprint(merged.envelope),
    );
  });

  it('propaga un tombstone de cita', () => {
    const local = envelope('dev_A', { quotes: [quote('q_1', 100)] }, 100);
    const remote = envelope(
      'dev_B',
      { quotes: [quote('q_1', 200, { deletedAt: 200 })] },
      200,
    );

    const merged = mergeEnvelopes(local, remote);
    expect(merged.envelope.quotes.q_1?.deletedAt).toBe(200);
    expect(liveQuotes(merged.envelope)).toHaveLength(0);
  });

  it('desempata por deviceId lexicográfico cuando updatedAt coincide', () => {
    const low = envelope('dev_A', { progress: [progress('book_1', 'dev_A', 100)] }, 100);
    const high = envelope('dev_Z', { progress: [progress('book_1', 'dev_Z', 100)] }, 100);

    expect(mergeEnvelopes(low, high).envelope.progress.book_1.deviceId).toBe('dev_Z');
    expect(mergeEnvelopes(high, low).envelope.progress.book_1.deviceId).toBe('dev_Z');
  });

  it('no marca cambios si el remoto es idéntico', () => {
    const same = envelope('dev_A', { progress: [progress('book_1', 'dev_A', 100)] }, 100);
    expect(mergeEnvelopes(same, same).changed).toBe(false);
  });

  it('ordena las claves por code point, sin depender del idioma del dispositivo', () => {
    expect(stableStringify({ a: 1, Z: 2, Á: 3 })).toBe('{"Z":2,"a":1,"Á":3}');
  });

  it('prepara la escritura con el dispositivo actual sin retroceder timestamps', () => {
    const merged = envelope('dev_A', {}, 100);
    const written = prepareForWrite(merged, 'dev_B', 50);
    expect(written.originDeviceId).toBe('dev_B');
    expect(written.updatedAt).toBe(100);
    expect(written.devices.dev_A).toBe(100);
    expect(written.devices.dev_B).toBe(50);
  });
});

describe('backup rotativo', () => {
  it('conserva el backup anterior y restaura el más reciente', async () => {
    const store = new MemoryStore();
    await rotateBackup(store, envelope('dev_A', {}, 100), 100);
    await rotateBackup(store, envelope('dev_A', {}, 200), 200);

    expect(await restoreBackup(store)).toMatchObject({ savedAt: 200 });
    expect(parseBackupText(store.getItem(PREV_BACKUP_FILENAME)!).savedAt).toBe(100);
    expect(store.getItem(LAST_APPLIED_KEY)).toContain('"savedAt": 200');
  });

  it('cae al backup anterior si el principal está corrupto', async () => {
    const store = new MemoryStore();
    await rotateBackup(store, envelope('dev_A', {}, 100), 100);
    await rotateBackup(store, envelope('dev_A', {}, 200), 200);
    store.setItem(BACKUP_FILENAME, '{roto');
    expect(await restoreBackup(store)).toMatchObject({ savedAt: 100 });
  });

  it('serializa backups con el sobre anidado', () => {
    const text = serializeBackup(envelope('dev_A', {}, 10), 20);
    expect(JSON.parse(text)).toMatchObject({ savedAt: 20, envelope: { schemaVersion: 1 } });
  });
});

function parseBackupText(text: string): { savedAt: number } {
  return JSON.parse(text) as { savedAt: number };
}

describe('aplicación local del merge', () => {
  beforeEach(async () => {
    await db.progress.clear();
    await db.quotes.clear();
  });

  it('persiste progreso y tombstones en una transacción', async () => {
    const remote = envelope(
      'dev_B',
      {
        progress: [progress('book_2', 'dev_B', 110)],
        quotes: [quote('q_1', 200, { deletedAt: 200 }), quote('q_2', 120)],
      },
      200,
    );
    const result = mergeEnvelopes(await loadLocalEnvelope('dev_A', 100), remote);
    await applyMergeResult(result);

    expect(await db.progress.get('book_2')).toMatchObject({ percentage: 42 });
    expect(await db.quotes.get('q_1')).toMatchObject({ deletedAt: 200 });
    expect(await db.quotes.get('q_2')).toMatchObject({ excerpt: 'Fragmento' });
  });

  it('descarta registros malformados antes de escribir en IndexedDB', async () => {
    const remote = {
      ...envelope('dev_B', {}, 200),
      progress: { roto: { bookId: '', updatedAt: 200 } },
      quotes: { rota: {} },
    } as unknown as SyncEnvelope;
    const result = mergeEnvelopes(await loadLocalEnvelope('dev_A', 100), remote);

    await expect(applyMergeResult(result)).resolves.toBeUndefined();
    expect(await db.progress.count()).toBe(0);
    expect(await db.quotes.count()).toBe(0);
  });
});
