import { BookCheck, BookOpenText, Layers, Library, Quote, Settings2, Star, Users } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import ApkDownloadNotice from '@/components/download/ApkDownloadNotice';
import { LibrarySkeleton, ReaderSkeleton } from '@/components/ui/Skeletons';
import { countBooksByStatus } from '@/core/library/views';
import { useBookCount, useFavoriteCount, useProgressByBook } from '@/hooks/useLibrary';
import { SyncProvider } from '@/hooks/useSyncContext';
import { APP_LABEL } from '@/lib/buildInfo';
import { cn } from '@/lib/cn';

const SettingsDialog = lazy(() => import('@/components/settings/SettingsDialog'));

const NAV_ITEMS = [
  { value: 'reading', label: 'Leyendo', Icon: BookOpenText },
  { value: 'finished', label: 'Leídos', Icon: BookCheck },
  { value: 'favorites', label: 'Favoritos', Icon: Star },
  { value: 'all', label: 'Todos', Icon: Library },
  { value: 'authors', label: 'Autores', Icon: Users },
  { value: 'sagas', label: 'Sagas', Icon: Layers },
  { value: 'quotes', label: 'Citas', Icon: Quote },
] as const;

export default function AppShell() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsOpen = searchParams.get('settings') === '1';
  const reading = location.pathname.startsWith('/read/');
  const activeTab = searchParams.get('tab') ?? 'all';
  const bookCount = useBookCount();
  const favoriteCount = useFavoriteCount();
  const statusCounts = countBooksByStatus(useProgressByBook());
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (reading) return;
    const update = () => setCompact(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [reading]);

  useEffect(() => {
    if (reading) return;
    document.documentElement.style.setProperty('--header-h', compact ? '3.5rem' : '4rem');
    return () => {
      document.documentElement.style.removeProperty('--header-h');
    };
  }, [compact, reading]);

  useEffect(() => {
    if (!reading) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [reading]);

  const setSettingsOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('settings', '1');
    else next.delete('settings');
    setSearchParams(next, { replace: !open });
  };

  const navCount = (value: (typeof NAV_ITEMS)[number]['value']): number | undefined => {
    if (value === 'reading') return statusCounts.reading;
    if (value === 'finished') return statusCounts.finished;
    if (value === 'favorites') return favoriteCount;
    if (value === 'all') return bookCount;
    return undefined;
  };

  const tabHref = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('settings');
    if (value === 'all') next.delete('tab');
    else next.set('tab', value);
    const search = next.toString();
    return `/${search ? `?${search}` : ''}`;
  };

  if (reading) {
    return (
      <SyncProvider>
        <Suspense fallback={<ReaderSkeleton />}>
          <Outlet />
        </Suspense>
      </SyncProvider>
    );
  }

  return (
    <SyncProvider>
      <div className="relative flex min-h-dvh text-foreground">
        <div className="library-doodle-bg pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 bg-card/40 py-6 pr-6 pl-[calc(env(safe-area-inset-left,0px)+1rem)] lg:flex">
          <Link to="/" className="flex items-center gap-2 rounded-md px-2 focus-visible:ring-2">
            <img
              src="/icons/icon-192.webp"
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              className="size-5 rounded-md object-contain"
            />
            <span className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">Leeto</span>
              <span className="text-muted-foreground text-[11px]">{APP_LABEL}</span>
            </span>
          </Link>

          <nav aria-label="Biblioteca" className="mt-8 space-y-1">
            <p className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
              Biblioteca
            </p>
            {NAV_ITEMS.map(({ value, label, Icon }) => {
              const count = navCount(value);
              return (
                <Link
                  key={value}
                  to={tabHref(value)}
                  aria-current={activeTab === value ? 'page' : undefined}
                  className={cn(
                    'text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors',
                    activeTab === value && 'bg-primary/10 text-foreground font-medium',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                  {count !== undefined && (
                    <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-[11px] tabular-nums">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1">
            <div id="library-sidebar-search" />
            <div id="library-sidebar-actions" />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors"
            >
              <Settings2 className="size-4" aria-hidden="true" />
              Ajustes
            </button>
            <p className="text-muted-foreground px-2 pt-3 text-[11px] leading-relaxed">
              Tus libros viven en este dispositivo.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="pt-safe bg-background/80 sticky top-0 z-30 backdrop-blur lg:hidden">
            <div
              className={cn(
                'flex items-center justify-between px-4 transition-[height] duration-300 sm:px-6',
                compact ? 'h-14' : 'h-16',
              )}
            >
              <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:ring-2">
                <img
                  src="/icons/icon-192.webp"
                  alt=""
                  aria-hidden="true"
                  width={20}
                  height={20}
                  className="size-5 rounded-md object-contain"
                />
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold tracking-tight">Leeto</span>
                  <span
                    className={cn(
                      'text-muted-foreground text-[11px] transition-opacity duration-300',
                      compact && 'opacity-0 sm:opacity-100',
                    )}
                  >
                    {APP_LABEL}
                  </span>
                </span>
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

          <main className="w-full flex-1 px-4 pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)] sm:px-6 lg:pt-2">
            <Suspense fallback={<LibrarySkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <ApkDownloadNotice />

        {settingsOpen && (
          <Suspense fallback={null}>
            <SettingsDialog open onOpenChange={setSettingsOpen} />
          </Suspense>
        )}
      </div>
    </SyncProvider>
  );
}
