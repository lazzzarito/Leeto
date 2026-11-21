export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unsupported';

/** Comparte un fragmento con Web Share y deja copiar como respaldo. */
export async function shareText(text: string, title: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return 'cancelled';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'unsupported';
    }
  }

  return 'unsupported';
}
