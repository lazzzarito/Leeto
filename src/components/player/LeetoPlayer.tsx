import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent, type WheelEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/core/db/settings';
import { getClipDuration } from '@/core/player/state';
import { useTts } from '@/core/tts/useTts';
import { usePlayer } from '@/hooks/usePlayer';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';
import type { LeetoBook } from '@/types';
import BlockView from './BlockView';
import PlayerControls from './PlayerControls';
import StoriesBar from './StoriesBar';
import TocDrawer from './TocDrawer';
import type { KineticTextHandle } from './KineticText';

interface TouchStart {
  x: number;
  y: number;
  time: number;
}

const CHROME_DELAY_MS = 2500;
const SWIPE_THRESHOLD_PX = 50;
const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 500;

export default function LeetoPlayer({ book }: { book: LeetoBook }) {
  const {
    state,
    clip,
    chapter,
    activeWordIndex,
    percentage,
    toggle,
    next,
    previous,
    pause,
    seekTo,
    alignPlayhead,
    saveQuote,
  } = usePlayer(book);
  const settings = useSettings();
  const reducedMotion = useReducedMotion(settings.reducedMotion);

  const kineticRef = useRef<KineticTextHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<TouchStart>();
  const lastTapRef = useRef(0);
  const lastWheelRef = useRef(0);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressFiredRef = useRef(false);

  const [tocOpen, setTocOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [chromeVisible, setChromeVisible] = useState(true);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(undefined), 2200);
  }, []);

  const handleTtsBoundary = useCallback(
    (elapsedMs: number) => alignPlayhead(elapsedMs),
    [alignPlayhead],
  );
  const handleTtsError = useCallback(
    (message: string) => showNotice(`Voz: ${message}`),
    [showNotice],
  );
  const tts = useTts({
    enabled: settings.ttsEnabled,
    clip,
    status: state.status,
    wpm: state.wpm,
    speed: state.speed,
    voiceURI: settings.ttsVoiceURI,
    onBoundary: handleTtsBoundary,
    onError: handleTtsError,
  });

  const handleQuote = useCallback(async () => {
    const quote = await saveQuote();
    showNotice(quote ? 'Cita guardada' : 'Este bloque no tiene texto para citar');
  }, [saveQuote, showNotice]);

  // El playhead se actualiza de forma imperativa: React no re-renderiza cada palabra.
  useEffect(() => {
    const handle = kineticRef.current;
    if (!handle) return;
    if (!settings.kineticTextEnabled || reducedMotion) {
      handle.setUniform();
    } else if (state.status === 'playing') {
      handle.setWordIndex(activeWordIndex);
    } else {
      handle.setMarker(activeWordIndex);
    }
  }, [activeWordIndex, reducedMotion, settings.kineticTextEnabled, state.status, clip?.key]);

  useEffect(() => {
    if (state.status !== 'playing') {
      setChromeVisible(true);
      return;
    }
    const timer = setTimeout(() => setChromeVisible(false), CHROME_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.status, chromeVisible]);

  const wakeChrome = useCallback(() => setChromeVisible(true), []);

  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      ) {
        return;
      }
      wakeChrome();
      switch (event.key) {
        case ' ':
          event.preventDefault();
          toggle();
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          next();
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          previous();
          break;
        case 't':
        case 'T':
          setTocOpen((value) => !value);
          break;
        case 'f':
        case 'F':
          void containerRef.current?.requestFullscreen?.().catch(() => showNotice('Pantalla completa no disponible'));
          break;
        case 'q':
        case 'Q':
          void handleQuote();
          break;
        case 'Escape':
          if (tocOpen) setTocOpen(false);
          else pause();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleQuote, next, pause, previous, showNotice, tocOpen, toggle, wakeChrome]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  }, []);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    longPressFiredRef.current = false;
    wakeChrome();
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      pause();
      wakeChrome();
      showNotice('Reproducción pausada');
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    cancelLongPress();
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = undefined;
    if (!start || !touch) return;
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > SWIPE_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) next();
      else previous();
      return;
    }
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) return;

    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      void handleQuote();
      lastTapRef.current = 0;
    } else {
      toggle();
      lastTapRef.current = now;
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 40) return;
    const now = Date.now();
    if (now - lastWheelRef.current < 400) return;
    lastWheelRef.current = now;
    if (event.deltaY > 0) next();
    else previous();
    wakeChrome();
  };

  const segments = useMemo(
    () =>
      book.chapters.map((entry) => {
        const positions = state.clips
          .map((item, index) => ({ index, item }))
          .filter(({ item }) => item.chapterIndex === entry.index);
        if (positions.length === 0) return 0;
        const first = positions[0]?.index ?? 0;
        const last = positions.at(-1)?.index ?? first;
        if (state.clipIndex < first) return 0;
        if (state.clipIndex > last) return 1;
        const duration = getClipDuration(state);
        const fraction = duration > 0 ? Math.min(1, state.elapsedMs / duration) : 0;
        return (state.clipIndex - first + fraction) / positions.length;
      }),
    [book.chapters, state],
  );

  const chromeClass = cn(
    'transition-opacity duration-200',
    chromeVisible || state.status !== 'playing' ? 'opacity-100' : 'opacity-0',
  );

  return (
    <div
      ref={containerRef}
      onPointerMove={wakeChrome}
      onTouchStart={handleTouchStart}
      onTouchMove={cancelLongPress}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className="bg-reader text-reader relative flex min-h-[70dvh] flex-col overflow-hidden rounded-xl border border-border"
    >
      <div className={cn('space-y-2 px-3 pt-3', chromeClass)}>
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Biblioteca
          </Link>
          <span className="text-muted-foreground truncate text-xs">{chapter?.title}</span>
        </div>
        <StoriesBar segments={segments} percentage={percentage} />
      </div>

      <div className="flex flex-1 snap-y snap-mandatory items-center justify-center overflow-hidden px-4 py-8">
        {clip ? (
          <div
            key={clip.key}
            className={cn('snap-start w-full', !reducedMotion && 'leeto-clip-enter')}
          >
            <BlockView
              block={clip.block}
              text={clip.text}
              kineticRef={kineticRef}
              fontSize={settings.fontSize}
              lineHeight={settings.lineHeight}
              dimIntensity={settings.focusDimIntensity}
              kenBurns={!reducedMotion}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Este libro no tiene bloques legibles.</p>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="bg-background/90 border-border absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border px-3 py-1 text-xs shadow"
        >
          {notice}
        </p>
      )}

      <div className={chromeClass}>
        <PlayerControls
          status={state.status}
          settings={settings}
          clips={state.clips}
          clipIndex={state.clipIndex}
          onToggle={toggle}
          onNext={next}
          onPrevious={previous}
          onSeek={(index) => seekTo(index)}
          onQuote={() => void handleQuote()}
          onToc={() => setTocOpen(true)}
        />
      </div>

      <TocDrawer
        open={tocOpen}
        onOpenChange={setTocOpen}
        chapters={book.chapters}
        clips={state.clips}
        activeClipIndex={state.clipIndex}
        onSeek={(index) => seekTo(index)}
      />

      {tts.lastError && (
        <p role="alert" className="sr-only">
          {tts.lastError}
        </p>
      )}
    </div>
  );
}
