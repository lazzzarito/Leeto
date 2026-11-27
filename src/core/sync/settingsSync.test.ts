import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '@/core/db/settings';
import type { AppSettings, SyncEnvelope, SyncSettingsValues } from '@/types';
import { buildEnvelope, parseEnvelope, serializeEnvelope } from './envelope';
import { mergeSyncedSettings, pickSyncedSettings } from './settingsSync';

const handle = { name: 'Libros' } as unknown as FileSystemDirectoryHandle;

function localSettings(): AppSettings {
  return normalizeSettings({
    ...DEFAULT_SETTINGS,
    deviceId: 'device-a',
    syncEnabled: true,
    syncProvider: 'local-folder',
    scanRoots: [{ id: 'root-1', name: 'Libros', addedAt: 100, handle }],
  });
}

describe('settingsSync', () => {
  it('serializa preferencias sin identidad, credenciales ni handles', () => {
    const values = pickSyncedSettings(localSettings());

    expect(values).not.toHaveProperty('deviceId');
    expect(values).not.toHaveProperty('syncEnabled');
    expect(values).not.toHaveProperty('syncProvider');
    expect(values.scanRoots?.[0]).not.toHaveProperty('handle');
    expect(values.scanRoots?.[0]?.name).toBe('Libros');
  });

  it('aplica preferencias remotas conservando el dispositivo y el acceso local', () => {
    const local = localSettings();
    const incoming = {
      ...pickSyncedSettings(local),
      fontSize: 26,
      readingTheme: 'sepia' as const,
      scanRoots: [
        { id: 'root-1', name: 'Libros (remoto)', addedAt: 100, bookCount: 5 },
        { id: 'root-2', name: 'Cómic', addedAt: 200, bookCount: 2 },
      ],
    };

    const merged = mergeSyncedSettings(local, incoming);

    expect(merged.fontSize).toBe(26);
    expect(merged.readingTheme).toBe('sepia');
    expect(merged).not.toHaveProperty('deviceId');
    expect(merged.scanRoots?.[0]?.handle).toBe(handle);
    expect(merged.scanRoots?.[0]?.name).toBe('Libros (remoto)');
    expect(merged.scanRoots?.[1]?.name).toBe('Cómic');
  });

  it('rechaza sobres con identidad, credenciales o handles en los ajustes', () => {
    const envelope = buildEnvelope({
      deviceId: 'device-a',
      progress: [],
      quotes: [],
      books: [],
      settings: localSettings(),
      updatedAt: 1,
    });
    expect(() => parseEnvelope(serializeEnvelope(envelope))).not.toThrow();

    const withDeviceId: SyncEnvelope = {
      ...envelope,
      settings: {
        ...envelope.settings!,
        values: {
          ...envelope.settings!.values,
          deviceId: 'device-b',
        } as unknown as SyncSettingsValues,
      },
    };
    expect(() => parseEnvelope(serializeEnvelope(withDeviceId))).toThrow('inválido');

    const withHandle: SyncEnvelope = {
      ...envelope,
      settings: {
        ...envelope.settings!,
        values: {
          ...envelope.settings!.values,
          scanRoots: [{ id: 'root-1', name: 'Libros', addedAt: 1, handle: {} }] as never,
        },
      },
    };
    expect(() => parseEnvelope(serializeEnvelope(withHandle))).toThrow('inválido');
  });
});
