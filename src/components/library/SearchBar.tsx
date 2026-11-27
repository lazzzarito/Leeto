import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** En la barra inferior, empieza como botón del mismo tamaño que las demás acciones. */
  compact?: boolean;
}

const ACTION_CLASS =
  'border-border bg-card text-foreground hover:bg-muted inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-lg';

export default function SearchBar({ value, onChange, className, compact = false }: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const collapsed = compact && !expanded && !value;

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Buscar en la biblioteca"
        className={cn(ACTION_CLASS, className)}
      >
        <Search className="size-4" aria-hidden="true" />
        Buscar
      </button>
    );
  }

  return (
    <div
      className={cn(
        'relative min-w-0',
        compact ? 'w-full flex-1' : 'flex-1',
        className,
      )}
    >
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (compact && !value) setExpanded(false);
        }}
        placeholder="Buscar"
        aria-label="Buscar en la biblioteca"
        className={cn(
          'bg-card border-border placeholder:text-muted-foreground h-10 w-full rounded-lg border pl-9 text-sm shadow-lg outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:appearance-none',
          value ? 'pr-10' : 'pr-3',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          aria-label="Limpiar búsqueda"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-md"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
