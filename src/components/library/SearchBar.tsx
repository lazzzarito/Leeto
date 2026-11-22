import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar por título, autor, saga o cita…"
        aria-label="Buscar en la biblioteca"
        className={cn(
          'bg-card/85 border-border placeholder:text-muted-foreground h-10 w-full rounded-lg border pl-9 text-sm outline-none focus-visible:ring-2 [&::-webkit-search-cancel-button]:appearance-none',
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
