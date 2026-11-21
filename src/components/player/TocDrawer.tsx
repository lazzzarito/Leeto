import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { LeetoChapter } from '@/types';
import type { PlayerClip } from '@/core/player/state';
import { cn } from '@/lib/cn';

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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="bg-card text-card-foreground fixed inset-y-0 right-0 z-50 flex w-[min(90vw,22rem)] flex-col border-l border-border p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">Índice</Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">
                Salta a cualquier bloque.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar índice"
                className="text-muted-foreground hover:text-foreground rounded-md p-1"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <nav aria-label="Capítulos" className="mt-5 flex-1 space-y-5 overflow-y-auto">
            {chapters.map((chapter) => {
              const chapterClips = clips
                .map((clip, index) => ({ clip, index }))
                .filter(({ clip }) => clip.chapterIndex === chapter.index);
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
                            'hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-xs',
                            index === activeClipIndex ? 'bg-accent text-accent-foreground' : '',
                          )}
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
