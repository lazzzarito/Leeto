import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import type { PlayerClip } from '@/core/player/state';
import {
  ensureToc,
  findActiveTocPath,
  findClipIndexForTocEntry,
} from '@/core/player/toc';
import { cn } from '@/lib/cn';
import type { LeetoChapter, TocEntry } from '@/types';

interface TocDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: LeetoChapter[];
  toc?: TocEntry[];
  clips: PlayerClip[];
  activeClipIndex: number;
  onSeek: (clipIndex: number) => void;
}

export default function TocDrawer({
  open,
  onOpenChange,
  chapters,
  toc,
  clips,
  activeClipIndex,
  onSeek,
}: TocDrawerProps) {
  const entries = useMemo(() => ensureToc({ chapters, toc }), [chapters, toc]);
  const activePath = useMemo(
    () => findActiveTocPath(entries, clips[activeClipIndex]),
    [entries, clips, activeClipIndex],
  );
  const activeIds = useMemo(() => new Set(activePath.map((entry) => entry.id)), [activePath]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeIds));
  const pathKey = activePath.map((entry) => entry.id).join('|');

  useEffect(() => {
    setExpanded((previous) => {
      const next = new Set(previous);
      for (const entry of activePath) next.add(entry.id);
      return next;
    });
    // pathKey evita reabrir el árbol en cada tick del reproductor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey]);

  const toggle = (id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (entry: TocEntry): React.ReactNode => {
    const hasChildren = entry.children.length > 0;
    const isOpen = hasChildren && (expanded.has(entry.id) || activeIds.has(entry.id));
    const isActive = activeIds.has(entry.id);

    return (
      <li key={entry.id}>
        <div className="flex items-center gap-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(entry.id)}
              aria-label={isOpen ? `Contraer ${entry.title}` : `Expandir ${entry.title}`}
              aria-expanded={isOpen}
              className="text-muted-foreground hover:bg-muted flex size-7 shrink-0 items-center justify-center rounded-md"
            >
              {isOpen ? (
                <ChevronDown className="size-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-4" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="size-7 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => {
              onSeek(findClipIndexForTocEntry(entry, clips));
              onOpenChange(false);
            }}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'hover:bg-muted min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm',
              isActive && 'bg-accent text-accent-foreground font-medium',
            )}
          >
            {entry.title}
          </button>
        </div>
        {hasChildren && isOpen && (
          <ul className="ml-3 border-border space-y-0.5 border-l pl-1">
            {entry.children.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Índice"
      description="Salta a cualquier sección del libro."
    >
      <nav aria-label="Índice del libro" className="space-y-3 pb-8">
        {activePath.length > 0 && (
          <p className="text-muted-foreground truncate text-xs">
            {activePath.map((entry) => entry.title).join(' › ')}
          </p>
        )}
        <ul className="space-y-0.5">{entries.map(renderNode)}</ul>
      </nav>
    </ResponsiveDialog>
  );
}
