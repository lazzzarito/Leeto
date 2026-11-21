/** Unidades de lectura estables: no dependen del viewport, solo del texto. */
export const SEGMENT_MIN_WORDS = 8;
export const SEGMENT_TARGET_WORDS = 16;
export const SEGMENT_MAX_WORDS = 24;

const ABBREVIATIONS = new Set([
  'aprox',
  'cap',
  'dr',
  'dra',
  'ej',
  'etc',
  'jr',
  'mr',
  'mrs',
  'ms',
  'pag',
  'pág',
  'prof',
  'sr',
  'sra',
  'srta',
  'st',
  'vs',
]);

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  const raw = text.match(/[^.!?…]+(?:[.!?…]+(?=\s|$)|$)/g) ?? [text];
  const sentences: string[] = [];

  for (const part of raw) {
    const sentence = part.trim();
    if (!sentence) continue;

    const previous = sentences.at(-1);
    const abbreviation = /(?:^|\s)([\p{L}]+)\.$/u.exec(previous ?? '');
    if (previous && abbreviation && ABBREVIATIONS.has(abbreviation[1]!.toLowerCase())) {
      sentences[sentences.length - 1] = `${previous} ${sentence}`;
    } else {
      sentences.push(sentence);
    }
  }

  return sentences;
}

function splitClauses(sentence: string): string[] {
  if (countWords(sentence) <= SEGMENT_MAX_WORDS) return [sentence];

  const parts = sentence.split(/([,;:—–]\s+)/);
  const clauses: string[] = [];
  let pending = '';

  for (let index = 0; index < parts.length; index += 2) {
    const chunk = parts[index]?.trim();
    if (!chunk) continue;
    if (pending) clauses.push(pending);
    pending = `${chunk}${parts[index + 1]?.trim() ?? ''}`;
  }
  if (pending) clauses.push(pending);

  return clauses;
}

function splitByWordLimit(text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length <= SEGMENT_MAX_WORDS) return [text];

  const chunks: string[] = [];
  for (let index = 0; index < tokens.length; index += SEGMENT_TARGET_WORDS) {
    const chunk = tokens.slice(index, index + SEGMENT_TARGET_WORDS).join(' ');
    const previous = chunks.at(-1);
    if (previous && countWords(previous) + countWords(chunk) <= SEGMENT_MAX_WORDS) {
      chunks[chunks.length - 1] = `${previous} ${chunk}`;
    } else {
      chunks.push(chunk);
    }
  }
  return chunks;
}

function mergeShortPieces(pieces: string[]): string[] {
  const segments: string[] = [];

  for (const piece of pieces) {
    const previous = segments.at(-1);
    const tooShort = countWords(piece) < SEGMENT_MIN_WORDS;
    const canMerge =
      previous &&
      (countWords(previous) < SEGMENT_MIN_WORDS || tooShort) &&
      countWords(previous) + countWords(piece) <= SEGMENT_MAX_WORDS;

    if (canMerge) segments[segments.length - 1] = `${previous} ${piece}`;
    else segments.push(piece);
  }

  if (segments.length > 1) {
    const last = segments.at(-1)!;
    if (countWords(last) < SEGMENT_MIN_WORDS) {
      const previous = segments.at(-2)!;
      if (countWords(previous) + countWords(last) <= SEGMENT_MAX_WORDS) {
        segments.splice(-2, 2, `${previous} ${last}`);
      }
    }
  }

  return segments;
}

/**
 * Convierte un bloque de texto en subtítulos de 8–24 palabras.
 * La segmentación es pura y determinista para que progreso, citas e índice
 * sigan apuntando al mismo sitio tras recargas, rotación o cambios de tema.
 */
export function splitIntoSegments(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const pieces = splitSentences(normalized)
    .flatMap(splitClauses)
    .flatMap(splitByWordLimit);

  return mergeShortPieces(pieces).filter((segment) => segment.length > 0);
}
