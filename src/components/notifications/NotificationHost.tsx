import { X } from 'lucide-react';
import { useEffect, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { useNotifications, type Notice } from './NotificationProvider';

function NoticeActions({
  notice,
  onDismiss,
  durationMs,
}: {
  notice: Notice;
  onDismiss: () => void;
  durationMs?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {notice.actions?.map((action) => {
        const className = cn(
          'inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors',
          action.variant === 'secondary'
            ? 'border-border hover:bg-muted border'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        );
        const handleClick = () => {
          action.onClick?.();
          if (action.closeOnClick !== false) onDismiss();
        };
        if (action.href) {
          return (
            <a
              key={action.label}
              href={action.href}
              download={action.download}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noreferrer' : undefined}
              onClick={handleClick}
              className={className}
            >
              {action.label}
            </a>
          );
        }
        return (
          <button key={action.label} type="button" onClick={handleClick} className={className}>
            {action.label}
          </button>
        );
      })}
      {notice.dismissible !== false && <CloseButton onDismiss={onDismiss} durationMs={durationMs} />}
    </div>
  );
}

function CloseButton({ onDismiss, durationMs }: { onDismiss: () => void; durationMs?: number }) {
  const size = 32;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Cerrar notificación"
      className="text-muted-foreground hover:bg-muted hover:text-foreground relative inline-flex size-8 items-center justify-center rounded-full"
    >
      {durationMs ? (
        <svg className="absolute inset-0 -rotate-90" width={size} height={size} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            className="toast-countdown"
            style={{
              '--toast-circumference': String(c),
              animationDuration: `${durationMs}ms`,
            } as CSSProperties}
          />
        </svg>
      ) : (
        <span className="border-border absolute inset-0 rounded-full border" aria-hidden="true" />
      )}
      <X className="size-4" aria-hidden="true" />
    </button>
  );
}

function NoticeCard({ notice, onDismiss, mobile }: { notice: Notice; onDismiss: () => void; mobile: boolean }) {
  useEffect(() => {
    if (!notice.durationMs) return;
    const timer = window.setTimeout(onDismiss, notice.durationMs);
    return () => window.clearTimeout(timer);
  }, [notice.durationMs, notice.id, onDismiss]);

  const handleDismiss = () => {
    notice.onDismiss?.();
    onDismiss();
  };

  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'bg-card/95 border-border flex w-full items-center justify-between gap-3 px-4 py-2.5 backdrop-blur sm:px-6',
        !mobile && 'min-h-0 rounded-xl border shadow-lg',
        mobile && 'min-h-14 border-t',
        notice.kind === 'error' && 'border-destructive/40',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{notice.title}</p>
        {notice.subtitle && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">{notice.subtitle}</p>
        )}
      </div>
      <NoticeActions notice={notice} onDismiss={handleDismiss} durationMs={notice.durationMs} />
    </div>
  );
}

export default function NotificationHost({ mobile }: { mobile: boolean }) {
  const { notices, dismiss } = useNotifications();
  const active = notices[notices.length - 1];
  if (!active) return null;

  if (mobile) {
    return <NoticeCard notice={active} onDismiss={() => dismiss(active.id)} mobile />;
  }

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[70] flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2">
      <div className="pointer-events-auto">
        <NoticeCard notice={active} onDismiss={() => dismiss(active.id)} mobile={false} />
      </div>
    </div>
  );
}
