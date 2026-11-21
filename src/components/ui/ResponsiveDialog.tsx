import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal compartido: hoja inferior en móvil (90dvh) y panel lateral
 * de 50% de ancho en tablet horizontal y escritorio.
 */
export default function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: ResponsiveDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'bg-background fixed inset-x-0 bottom-0 z-50 flex h-[90dvh] w-full flex-col overflow-hidden',
            'rounded-t-2xl border border-border shadow-2xl outline-none',
            'md:inset-x-auto md:inset-y-0 md:right-0 md:h-dvh md:w-1/2 md:rounded-none md:border-r-0 md:border-y-0',
          )}
        >
          <header className="pt-safe border-b border-border/70 bg-background/95 shrink-0 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
                <Dialog.Description className="text-muted-foreground truncate text-xs">
                  {description}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Cerrar"
                  className="hover:bg-muted flex size-10 shrink-0 items-center justify-center rounded-full transition-colors"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </header>

          <div className="scroll-touch min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 sm:px-6">
            {children}
          </div>

          {footer && (
            <footer className="pb-safe bg-background border-t border-border/70 shrink-0 px-4 py-3 sm:px-6">
              {footer}
            </footer>
          )}
          {!footer && <div className="pb-safe bg-background shrink-0" aria-hidden="true" />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
