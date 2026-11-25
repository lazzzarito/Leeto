import { BookCheck, BookOpenText, Layers, Library, Quote, Settings2, Star, Users } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import ApkDownloadNotice from '@/components/download/ApkDownloadNotice';
import ImportQueue from '@/components/library/ImportQueue';
import NotificationHost from '@/components/notifications/NotificationHost';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import PlayerNotch from '@/components/player/PlayerNotch';
import { LibrarySkeleton, ReaderSkeleton } from '@/components/ui/Skeletons';
import { PlayerProvider } from '@/core/player/PlayerProvider';
import { countBooksByStatus } from '@/core/library/views';
import { useImport } from '@/components/import/ImportProvider';
import { useBookCount, useBooks, useFavoriteCount, useProgressByBook } from '@/hooks/useLibrary';
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
  const statusCounts = countBooksByStatus(useBooks(), useProgressByBook());
  const { notices } = useNotifications();
  const { jobs, importFiles } = useImport();
  const hasNotice = notices.length > 0;
  const hasImport = jobs.length > 0;
  const headerBusy = hasNotice || hasImport;
  const [chromeHidden, setChromeHidden] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(64);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);
  const pullStartY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reading) return;
    lastScrollY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      if (Math.abs(delta) > 8) {
        setChromeHidden(delta > 0 && y > 56);
        lastScrollY.current = y;
      }
      if (y <= 8) setChromeHidden(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reading]);

  useEffect(() => {
    if (reading) return;
    if (headerBusy) setChromeHidden(false);
  }, [reading, headerBusy]);

  useEffect(() => {
    if (reading) return;
    const element = headerRef.current;
    if (!element) return;
    const update = () => {
      const height = Math.round(element.getBoundingClientRect().height);
      if (height > 0) {
        setHeaderHeight(height);
        document.documentElement.style.setProperty('--header-h', `${height}px`);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--header-h');
    };
  }, [reading, hasNotice, hasImport]);

  useEffect(() => {
    if (!reading) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [reading]);

  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const triggerRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 700);
  };

  const PULL_THRESHOLD = 56;
  const getScrollTop = () => Math.max(0, document.scrollingElement?.scrollTop ?? window.scrollY ?? 0);
  const handlePullStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (reading || refreshing || getScrollTop() > 2) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, select, textarea, [role="dialog"], [data-no-pull-refresh="true"]')) return;
    const touch = event.touches[0];
    if (!touch) return;
    pullStartY.current = touch.clientY;
  };
  const handlePullMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = pullStartY.current;
    if (start == null || refreshing) return;
    if (getScrollTop() > 2) {
      pullStartY.current = null; pullRef.current = 0; setPullY(0); return;
    }
    const touch = event.touches[0]; if (!touch) return;
    const dy = touch.clientY - start;
    if (dy <= 8) { if (dy < 0) { pullStartY.current = null; pullRef.current = 0; setPullY(0); } return; }
    const resisted = Math.min(96, dy * 0.42);
    pullRef.current = resisted; setPullY(resisted);
  };
  const handlePullEnd = () => {
    if (pullRef.current >= PULL_THRESHOLD) triggerRefresh();
    pullStartY.current = null; pullRef.current = 0; setPullY(0);
  };

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
    next.set('tab', value);
    const search = next.toString();
    return `/${search ? `?${search}` : ''}`;
  };

  if (reading) {
    return (
      <PlayerProvider>
        <SyncProvider>
          <Suspense fallback={<ReaderSkeleton />}>
            <div key={location.pathname} className="leeto-page-enter h-dvh">
              <Outlet />
            </div>
          </Suspense>
        </SyncProvider>
      </PlayerProvider>
    );
  }

  return (
    <PlayerProvider>
      <SyncProvider>
        <div
          className="relative flex min-h-dvh text-foreground"
          data-chrome-hidden={chromeHidden ? 'true' : 'false'}
          style={{ ['--header-h' as string]: `${headerHeight}px` }}
          onTouchStartCapture={handlePullStart}
          onTouchMoveCapture={handlePullMove}
          onTouchEndCapture={handlePullEnd}
          onTouchCancelCapture={handlePullEnd}
        >
        <div className="library-doodle-bg pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[60] flex justify-center lg:left-64"
          style={{ transform: `translateY(${refreshing ? 16 : pullY * 0.45}px)`, opacity: refreshing ? 1 : Math.min(1, pullY / 48) }}
        >
          <div className="bg-card border-border text-muted-foreground flex size-8 items-center justify-center rounded-full border shadow-sm">
            <svg className={cn('size-4', refreshing && 'animate-spin')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </div>
        </div>
        <aside className="relative z-10 sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 bg-card/40 py-6 pr-6 pl-[calc(env(safe-area-inset-left,0px)+1rem)] lg:flex">
          <Link to="/" className="flex items-center gap-2 rounded-md px-2 focus-visible:ring-2">
            <span aria-hidden="true" className="theme-icon text-primary size-5 shrink-0 rounded-md" />
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
            <PlayerNotch className="mx-2 mb-2 w-[calc(100%-1rem)] max-w-none" />
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

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header
            ref={headerRef}
            className={cn(
              'pt-safe bg-background/35 sticky top-0 z-30 backdrop-blur-md transition-transform duration-300 supports-[backdrop-filter]:bg-background/20 lg:hidden',
              chromeHidden && !headerBusy && '-translate-y-full',
            )}
          >
            {headerBusy ? (
              <div className="border-border bg-background/95 max-h-[40dvh] overflow-y-auto border-b">
                {hasImport && (
                  <div className="px-4 py-2 sm:px-6">
                    <ImportQueue jobs={jobs} compact />
                  </div>
                )}
                {hasNotice && <NotificationHost mobile />}
              </div>
            ) : (
              <div className="relative flex h-16 items-center justify-between px-4 sm:px-6">
                <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:ring-2">
                  <span aria-hidden="true" className="theme-icon text-primary size-5 shrink-0 rounded-md" />
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold tracking-tight">Leeto</span>
                    <span className="text-muted-foreground text-[11px]">{APP_LABEL}</span>
                  </span>
                </Link>

                <PlayerNotch className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
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
            )}
          </header>

          <main className="w-full flex-1 px-4 pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:px-6 lg:pt-2 lg:pb-8">
            {!reading && hasImport && <div className="mb-3 hidden lg:block"><ImportQueue jobs={jobs} /></div>}
            {!reading && <div className="hidden lg:block"><NotificationHost mobile={false} /></div>}
            <Suspense fallback={<LibrarySkeleton />}>
              <div key={location.pathname} className="leeto-page-enter">
                <Outlet context={{ chromeHidden, importFiles, refreshing }} />
              </div>
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
    </PlayerProvider>
  );
}
