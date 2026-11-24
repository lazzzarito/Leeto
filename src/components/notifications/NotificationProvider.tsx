import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { newId } from '@/lib/ids';

export type NoticeKind = 'info' | 'success' | 'error';

export interface NoticeAction {
  label: string;
  href?: string;
  download?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  external?: boolean;
  closeOnClick?: boolean;
}

export interface Notice {
  id: string;
  kind: NoticeKind;
  title: string;
  subtitle?: string;
  actions?: NoticeAction[];
  dismissible?: boolean;
  durationMs?: number;
  onDismiss?: () => void;
}

interface NotificationsContextValue {
  notices: Notice[];
  push: (notice: Omit<Notice, 'id'>) => string;
  dismiss: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotices((previous) => previous.filter((notice) => notice.id !== id));
  }, []);

  const push = useCallback((notice: Omit<Notice, 'id'>) => {
    const id = newId('notice');
    setNotices((previous) => [...previous, { ...notice, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ notices, push, dismiss }), [notices, push, dismiss]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications debe usarse dentro de NotificationProvider');
  return value;
}
