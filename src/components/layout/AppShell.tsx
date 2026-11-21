import { BookOpen, Settings2 } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/cn';

export default function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="pt-safe border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:ring-2">
            <BookOpen className="size-5 text-primary" aria-hidden="true" />
            <span className="font-semibold tracking-tight">Leeto</span>
          </Link>

          <nav aria-label="Navegación principal">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Settings2 className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Ajustes</span>
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="pb-safe mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
