import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import type { ImportToast } from '@/hooks/useImport';
import { cn } from '@/lib/cn';

interface ImportToastsProps {
  toasts: ImportToast[];
  onDismiss: (id: string) => void;
}

const ICONS = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
} as const;

function ToastItem({ toast, onDismiss }: { toast: ImportToast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 4500);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const Icon = ICONS[toast.kind];

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'bg-background/95 border-border flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur sm:w-80',
        toast.kind === 'error' ? 'border-destructive/50' : 'border-primary/30',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-5 shrink-0',
          toast.kind === 'error' ? 'text-destructive' : 'text-primary',
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.detail && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs" title={toast.detail}>
            {toast.detail}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 rounded p-1"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ImportToasts({ toasts, onDismiss }: ImportToastsProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end md:bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full sm:w-80">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
