import { BookPlus, Library, ShieldCheck } from 'lucide-react';

export default function LibraryPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
        <p className="text-muted-foreground text-sm">
          Tus libros viven en este dispositivo. Sin cuenta, sin servidores, sin publicidad.
        </p>
      </section>

      <section
        aria-label="Biblioteca vacía"
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center"
      >
        <div className="bg-muted mb-4 flex size-14 items-center justify-center rounded-full">
          <Library className="text-muted-foreground size-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-medium">Todavía no hay libros</h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Arrastra aquí un EPUB o un PDF con texto seleccionable para empezar.
        </p>
        <button
          type="button"
          disabled
          title="La importación se habilita en la fase 2"
          className="bg-primary text-primary-foreground mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium opacity-60"
        >
          <BookPlus className="size-4" aria-hidden="true" />
          Importar libros
        </button>
        <p className="text-muted-foreground mt-2 text-xs">Disponible en la siguiente fase.</p>
      </section>

      <section className="flex items-start gap-3 rounded-xl bg-muted/60 p-4">
        <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-medium">Privacidad por defecto</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            El progreso y las citas solo se guardan localmente, salvo que actives la
            sincronización con tu propia infraestructura.
          </p>
        </div>
      </section>
    </div>
  );
}
