import type { LeetoChapter, TocEntry } from '@/types';
import type { PlayerClip } from './state';

type TocSource = {
  chapters: LeetoChapter[];
  toc?: TocEntry[];
};

/**
 * Índice canónico del libro. Si el parser no entregó uno (libros antiguos o
 * documentos sin navMap), se deriva de los capítulos, que son la misma fuente
 * de verdad que usa el reproductor.
 */
export function ensureToc(source: TocSource): TocEntry[] {
  const isValidChapter = (index: number): boolean =>
    Number.isInteger(index) && index >= 0 && index < source.chapters.length;

  const sanitize = (entries: TocEntry[] | undefined): TocEntry[] => {
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry, index) => {
      if (!entry || typeof entry !== 'object') return [];
      const children = sanitize(entry.children);
      if (!isValidChapter(entry.chapterIndex)) return children;

      const blockIds = new Set(source.chapters[entry.chapterIndex]?.blocks.map((b) => b.id));
      return [
        {
          id: entry.id || `toc_${index}`,
          title: entry.title || `Capítulo ${entry.chapterIndex + 1}`,
          chapterIndex: entry.chapterIndex,
          ...(entry.blockId && blockIds.has(entry.blockId) ? { blockId: entry.blockId } : {}),
          children,
        },
      ];
    });
  };

  const explicit = sanitize(source.toc);
  if (explicit.length > 0) return explicit;

  return source.chapters.map((chapter, index) => ({
    id: `toc_chapter_${index}`,
    title: chapter.title,
    chapterIndex: index,
    ...(chapter.blocks[0] ? { blockId: chapter.blocks[0].id } : {}),
    children: [],
  }));
}

/** Clip donde empieza una entrada, con degradación segura al inicio del capítulo. */
export function findClipIndexForTocEntry(entry: TocEntry, clips: PlayerClip[]): number {
  const exact = clips.findIndex(
    (clip) =>
      clip.chapterIndex === entry.chapterIndex &&
      (!entry.blockId || clip.block.id === entry.blockId),
  );
  if (exact >= 0) return exact;

  const firstInChapter = clips.findIndex((clip) => clip.chapterIndex === entry.chapterIndex);
  return Math.max(0, firstInChapter);
}

/** Ruta desde la raíz hasta la entrada más específica que contiene el clip activo. */
export function findActiveTocPath(entries: TocEntry[], clip?: PlayerClip): TocEntry[] {
  if (!clip) return [];

  const walk = (nodes: TocEntry[], trail: TocEntry[]): TocEntry[] | undefined => {
    let chapterCandidate: TocEntry[] | undefined;
    for (const entry of nodes) {
      const nextTrail = [...trail, entry];
      if (entry.blockId === clip.block.id && entry.chapterIndex === clip.chapterIndex) {
        return nextTrail;
      }
      const nested = walk(entry.children, nextTrail);
      if (nested) return nested;
      if (entry.chapterIndex === clip.chapterIndex && !chapterCandidate) {
        chapterCandidate = nextTrail;
      }
    }
    return chapterCandidate;
  };

  return walk(entries, []) ?? [];
}

export function flattenToc(entries: TocEntry[]): TocEntry[] {
  return entries.flatMap((entry) => [entry, ...flattenToc(entry.children)]);
}
