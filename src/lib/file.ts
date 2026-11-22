/** Utilidades de archivo para la biblioteca (formato y tamaño legibles). */

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

export function formatFileType(mimeType: string): string {
  if (mimeType.includes('epub')) return 'EPUB';
  if (mimeType.includes('pdf')) return 'PDF';
  return mimeType.split('/').pop()?.toUpperCase() || 'LIBRO';
}
