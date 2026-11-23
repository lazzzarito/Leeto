import { UploadCloud } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { BOOK_ACCEPT, BOOK_FORMAT_LABEL } from '@/core/parsers/formats';
import { cn } from '@/lib/cn';

interface DropzoneProps {
  onFiles: (files: File[]) => void;
}

export default function Dropzone({ onFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'rounded-xl border-2 border-dashed p-5 text-center transition-colors',
        dragging ? 'border-primary bg-accent' : 'border-border bg-card',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={BOOK_ACCEPT}
        multiple
        hidden
        className="sr-only"
        aria-label={`Seleccionar archivos: ${BOOK_FORMAT_LABEL}`}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = '';
        }}
      />
      <UploadCloud className="text-muted-foreground mx-auto size-6" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium">Arrastra tus libros aquí</p>
      <p className="text-muted-foreground mt-1 text-xs">{BOOK_FORMAT_LABEL}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        Los PDF necesitan texto seleccionable; los CBZ se leen por páginas.
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="border-border hover:bg-muted mt-3 rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors"
      >
        Seleccionar archivos
      </button>
    </div>
  );
}
