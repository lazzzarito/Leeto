import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `full` para ajustes/índice; `content` para formularios cortos. */
  height?: 'full' | 'content';
  /** `sheet` es el panel lateral en escritorio; `centered` es un modal compacto. */
  variant?: 'sheet' | 'centered';
}

/**
 * Modal compartido: hoja inferior en móvil y panel lateral en pantallas anchas.
 * La altura puede fijarse al viewport o ajustarse al contenido con tope seguro.
 */
export default function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  height = 'full',
  variant = 'sheet',
}: ResponsiveDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[leeto-fade-in_200ms_ease-out] data-[state=closed]:animate-[leeto-fade-out_150ms_ease-in]" />
        <Dialog.Content
          className={cn(
            'bg-background fixed inset-x-0 bottom-0 z-50 flex w-full flex-col overflow-hidden',
            'rounded-t-2xl border border-border shadow-2xl outline-none',
            'data-[state=open]:animate-[leeto-sheet-up_260ms_cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-[leeto-sheet-down_200ms_ease-in]',
            variant === 'sheet'
              ? 'md:inset-x-auto md:inset-y-0 md:right-0 md:w-1/2 md:data-[state=open]:animate-[leeto-sheet-right-in_260ms_cubic-bezier(0.32,0.72,0,1)] md:data-[state=closed]:animate-[leeto-sheet-right-out_200ms_ease-in]'
              : 'md:inset-x-0 md:inset-y-0 md:left-1/2 md:top-1/2 md:right-auto md:bottom-auto md:w-[calc(100%-2rem)] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:data-[state=open]:animate-[leeto-scale-in_200ms_ease-out] md:data-[state=closed]:animate-[leeto-scale-out_150ms_ease-in]',
            height === 'full'
              ? 'h-[90dvh] md:h-dvh md:rounded-none md:border-r-0 md:border-y-0'
              : 'max-h-[90dvh] md:my-auto md:h-auto md:max-h-dvh md:rounded-xl',
          )}
        >
          <header className="pt-safe border-b border-border/70 bg-background/95 shrink-0 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="text-muted-foreground truncate text-xs">
                    {description}
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
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
            <footer className="bg-background border-t border-border/70 shrink-0 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:px-6">
              {footer}
            </footer>
          )}
          {!footer && (
            <div
              className="bg-background shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
              aria-hidden="true"
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
