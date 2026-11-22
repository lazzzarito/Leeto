import { describe, expect, it } from 'vitest';
import { formatFileSize, formatFileType } from './file';

describe('formatFileSize', () => {
  it('usa la unidad adecuada', () => {
    expect(formatFileSize(0)).toBe('0 KB');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
  });

  it('muestra los MB con coma decimal', () => {
    expect(formatFileSize(2_516_582)).toBe('2,4 MB');
  });
});

describe('formatFileType', () => {
  it('reduce el MIME a la etiqueta del formato', () => {
    expect(formatFileType('application/epub+zip')).toBe('EPUB');
    expect(formatFileType('application/pdf')).toBe('PDF');
    expect(formatFileType('text/plain')).toBe('TXT');
    expect(formatFileType('text/markdown')).toBe('MD');
    expect(formatFileType('text/html')).toBe('HTML');
  });
});
