import { BookOpen, Settings2 } from 'lucide-react';
import { Link, Outlet, useSearchParams } from 'react-router-dom';
import SettingsDialog from '@/components/settings/SettingsDialog';
import { SyncProvider } from '@/hooks/useSyncContext';

export default function AppShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsOpen = searchParams.get('settings') === '1';

  const setSettingsOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('settings', '1');
    else next.delete('settings');
    setSearchParams(next, { replace: !open });
  };

  return (
    <SyncProvider>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <header className="pt-safe border-b border-border/70 bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:ring-2">
              <BookOpen className="size-5 text-primary" aria-hidden="true" />
              <span className="font-semibold tracking-tight">Leeto</span>
            </Link>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <Settings2 className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Ajustes</span>
              <span className="sr-only sm:hidden">Ajustes</span>
            </button>
          </div>
        </header>

        <main className="pb-safe mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>

        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </SyncProvider>
  );
}
