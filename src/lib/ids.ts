const DEVICE_ID_KEY = 'leeto.deviceId';

function randomPart(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  }
  return Math.random().toString(36).slice(2, 22);
}

/** ID con prefijo legible, estable para claves de dominio (bloques, citas, assets). */
export function newId(prefix = 'id'): string {
  return `${prefix}_${randomPart()}`;
}

/** ID de dispositivo persistido en localStorage; sobrevive a recargas del mismo origen. */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = `dev_${randomPart()}`;
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    // Modo privado / almacenamiento bloqueado: ID efímero pero válido durante la sesión.
    return `dev_${randomPart()}`;
  }
}
