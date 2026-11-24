import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function SearchBar({ value, onChange, className }: SearchBarProps) {
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar"
        aria-label="Buscar en la biblioteca"
        className={cn(
          'bg-card border-border placeholder:text-muted-foreground h-10 w-full rounded-lg border pl-9 text-sm shadow-sm outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:appearance-none',
          value ? 'pr-10' : 'pr-3',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-md"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
