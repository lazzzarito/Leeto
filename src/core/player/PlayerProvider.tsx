import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '@/core/db/db';
import { useSettings } from '@/core/db/settings';
import { useTts } from '@/core/tts/useTts';
import { usePlayer } from '@/hooks/usePlayer';
import type { LeetoBook } from '@/types';

type PlayerApi = ReturnType<typeof usePlayer> & {
  tts: ReturnType<typeof useTts>;
  book?: LeetoBook;
  bookId?: string;
};

const PlayerContext = createContext<PlayerApi | undefined>(undefined);

/** Mantiene el reproductor y la voz vivos mientras se navega por la app. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const bookId = /^\/read\/([^/]+)/.exec(pathname)?.[1];
  const book = useLiveQuery(
    () => (bookId ? db.books.get(bookId) : undefined),
    [bookId],
    undefined,
  );
  const settings = useSettings();
  const player = usePlayer(book);

  const onBoundary = useCallback(
    (elapsedMs: number) => player.alignPlayhead(elapsedMs),
    [player.alignPlayhead],
  );

  const tts = useTts({
    enabled: settings.ttsEnabled,
    clip: player.clip,
    clipIndex: player.state.clipIndex,
    status: player.state.status,
    wpm: player.state.wpm,
    speed: player.state.speed,
    voiceURI: settings.ttsVoiceURI,
    lang: book?.language || 'es-ES',
    onBoundary,
  });

  const value = useMemo<PlayerApi>(
    () => ({ ...player, tts, book, bookId }),
    [player, tts, book, bookId],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayerContext(): PlayerApi {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayerContext debe usarse dentro de PlayerProvider');
  return value;
}
