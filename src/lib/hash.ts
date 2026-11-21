function toSha256Hex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** SHA-256 del archivo fuente. Es la identidad de contenido de Leeto (D6). */
export async function hashFile(blob: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return `sha256:${toSha256Hex(digest)}`;
}

/** SHA-256 de texto UTF-8; útil para huellas de sobre de sincronización. */
export async function hashText(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toSha256Hex(digest);
}
