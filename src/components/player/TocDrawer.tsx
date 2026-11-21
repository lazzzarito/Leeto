import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import type { PlayerClip } from '@/core/player/state';
import { cn } from '@/lib/cn';
import type { LeetoChapter } from '@/types';

interface TocDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: LeetoChapter[];
  clips: PlayerClip[];
  activeClipIndex: number;
  onSeek: (clipIndex: number) => void;
}

function clipLabel(clip: PlayerClip): string {
  if (clip.block.type === 'image') return 'Imagen';
  return clip.block.content.length > 70
    ? `${clip.block.content.slice(0, 70)}…`
    : clip.block.content;
}

export default function TocDrawer({
  open,
  onOpenChange,
  chapters,
  clips,
  activeClipIndex,
  onSeek,
}: TocDrawerProps) {
  const activeBlockId = clips[activeClipIndex]?.block.id;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Índice"
      description="Salta a cualquier bloque."
    >
      <nav aria-label="Capítulos" className="space-y-5 pb-8">
        {chapters.map((chapter) => {
          const seenBlocks = new Set<string>();
          const chapterClips = clips
            .map((clip, index) => ({ clip, index }))
            .filter(({ clip }) => clip.chapterIndex === chapter.index)
            .filter(({ clip }) => {
              if (seenBlocks.has(clip.block.id)) return false;
              seenBlocks.add(clip.block.id);
              return true;
            });

          return (
            <section key={chapter.index} className="space-y-1.5">
              <h3 className="text-sm font-medium">{chapter.title}</h3>
              <ul className="space-y-0.5">
                {chapterClips.map(({ clip, index }) => (
                  <li key={clip.key}>
                    <button
                      type="button"
                      onClick={() => {
                        onSeek(index);
                        onOpenChange(false);
                      }}
                      className={cn(
                        'hover:bg-muted w-full rounded-md px-2 py-2 text-left text-sm',
                        clip.block.id === activeBlockId ? 'bg-accent text-accent-foreground' : '',
                      )}
                      aria-current={clip.block.id === activeBlockId ? 'true' : undefined}
                    >
                      {index + 1}. {clipLabel(clip)}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>
    </ResponsiveDialog>
  );
}
