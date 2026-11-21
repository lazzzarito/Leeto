import { quotesRepo } from '@/core/db/repositories';
import { newId } from '@/lib/ids';
import type { LeetoBook, SavedQuote } from '@/types';
import type { PlayerClip } from './state';

const MAX_EXCERPT = 500;

/** Construye una cita con referencia exacta al bloque reproducido. */
export function buildQuoteForClip(book: LeetoBook, clip: PlayerClip, now = Date.now()): SavedQuote {
  const source =
    clip.block.type === 'text' ? clip.block.content : (clip.block.caption ?? clip.block.alt ?? '');
  return {
    id: newId('quote'),
    bookId: book.id,
    chapterIndex: clip.chapterIndex,
    blockId: clip.block.id,
    excerpt: source.trim().slice(0, MAX_EXCERPT),
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveQuoteForClip(book: LeetoBook, clip: PlayerClip): Promise<SavedQuote> {
  const quote = buildQuoteForClip(book, clip);
  await quotesRepo.put(quote);
  return quote;
}

/** Marca la cita como eliminada sin borrar el registro: el tombstone se propaga por sync. */
export async function softDeleteQuote(id: string, now = Date.now()): Promise<void> {
  const quote = await quotesRepo.get(id);
  if (!quote || quote.deletedAt) return;
  await quotesRepo.put({ ...quote, deletedAt: now, updatedAt: now });
}
