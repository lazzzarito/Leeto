import { ArrowLeft, Eye, EyeOff, Play, SkipBack, SkipForward } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
  type WheelEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updateSettings, useSettings } from '@/core/db/settings';
import { getClipDuration } from '@/core/player/state';
import { useTts } from '@/core/tts/useTts';
import { usePlayer } from '@/hooks/usePlayer';
import { useQuotes } from '@/hooks/useLibrary';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';
import { shareText } from '@/lib/share';
import Marquee from '@/components/ui/Marquee';
import type { LeetoBook } from '@/types';
import BlockView from './BlockView';
import PlayerSettingsDialog from './PlayerSettingsDialog';
import ReelActionRail from './ReelActionRail';
import ReelBackdrop from './ReelBackdrop';
import StoriesBar from './StoriesBar';
import TocDrawer from './TocDrawer';
import type { KineticTextHandle } from './KineticText';

interface TouchStart {
  x: number;
  y: number;
  time: number;
}

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
  const quotes = useQuotes();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion(settings.reducedMotion);

  const kineticRef = useRef<KineticTextHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<TouchStart>();
  const lastTapRef = useRef(0);
  const lastGestureRef = useRef(0);
  const lastWheelRef = useRef(0);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressFiredRef = useRef(false);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [cleanMode, setCleanMode] = useState(false);
  const [heartPop, setHeartPop] = useState(false);

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

  const pulseHeart = useCallback(() => {
    if (reducedMotion) return;
    setHeartPop(false);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    heartTimerRef.current = setTimeout(() => {
      setHeartPop(true);
      heartTimerRef.current = setTimeout(() => setHeartPop(false), 700);
    }, 0);
  }, [reducedMotion]);

  const handleQuote = useCallback(async () => {
    const quote = await saveQuote();
    if (quote) pulseHeart();
    showNotice(quote ? 'Cita guardada' : 'Este bloque no tiene texto para citar');
  }, [pulseHeart, saveQuote, showNotice]);

  const handleShare = useCallback(async () => {
    if (!clip) return;
    const caption = clip.block.type === 'image' ? (clip.block.caption ?? '') : '';
    const text = `${book.title} — ${book.author}\n\n“${clip.text || caption}”`;
    const result = await shareText(text, book.title);
    if (result === 'cancelled') return;
    showNotice(
      result === 'copied'
        ? 'Fragmento copiado'
        : result === 'shared'
          ? 'Fragmento compartido'
          : 'No se pudo compartir',
    );
  }, [book.author, book.title, clip, showNotice]);

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

  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }
      if (tocOpen || settingsOpen) return;
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
          void containerRef.current
            ?.requestFullscreen?.()
            .catch(() => showNotice('Pantalla completa no disponible'));
          break;
        case 'q':
        case 'Q':
          void handleQuote();
          break;
        case 'Escape':
          if (state.status === 'playing') pause();
          else navigate('/');
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleQuote, navigate, next, pause, previous, settingsOpen, showNotice, state.status, tocOpen, toggle]);

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
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      pause();
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
      lastGestureRef.current = now;
    }
  };

  // Un clic (ratón/trackpad) también reproduce: el gesto táctil ya se gestiona arriba.
  const handleSurfaceClick = (event: MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastGestureRef.current < 700) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('button, a, input, select, textarea, [role="dialog"]')
    ) {
      return;
    }
    toggle();
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 40) return;
    const now = Date.now();
    if (now - lastWheelRef.current < 400) return;
    lastWheelRef.current = now;
    if (event.deltaY > 0) next();
    else previous();
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

  // El modo limpio es manual (botón del header). El texto nunca se oculta solo.
  const optionalChromeClass = cn(
    'transition-opacity duration-200',
    cleanMode && 'pointer-events-none opacity-0',
  );
  const quoteCount = quotes.filter((quote) => quote.bookId === book.id).length;
  const subtitleFontSize = Math.min(26, Math.max(18, settings.fontSize + 2));
  const subtitleLineHeight = Math.min(1.6, settings.lineHeight);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={cancelLongPress}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onClick={handleSurfaceClick}
      className="reel-surface bg-reader text-reader fixed inset-0 z-40 flex h-[100dvh] w-full cursor-pointer flex-col overflow-hidden"
    >
      {clip?.block.type === 'text' && (
        <ReelBackdrop coverAssetId={book.coverAssetId} animate={!reducedMotion} />
      )}
      <span className="reel-top-scrim pointer-events-none absolute inset-x-0 top-0 z-20 h-32" aria-hidden="true" />
      <p aria-live="polite" className="sr-only">
        {chapter ? `Capítulo ${chapter.index + 1}: ${chapter.title}. ` : ''}
        {clip ? `Fragmento ${clip.segmentIndex + 1} de ${clip.segmentCount}.` : ''}
      </p>

      <div
        className="pt-safe relative z-30 px-4"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 items-center gap-2">
          <Link
            to="/"
            aria-label="Volver a la biblioteca"
            className={cn(
              'text-reel hover:bg-white/10 flex size-9 shrink-0 items-center justify-center rounded-full',
              optionalChromeClass,
            )}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <div className={cn('min-w-0 flex-1', optionalChromeClass)}>
            <Marquee
              text={chapter?.title ?? ''}
              animate={!reducedMotion}
              className="text-reel text-sm font-medium"
            />
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCleanMode((value) => !value);
            }}
            aria-label={cleanMode ? 'Mostrar controles de lectura' : 'Ocultar controles de lectura'}
            aria-pressed={cleanMode}
            className="text-reel hover:bg-white/10 flex size-9 shrink-0 items-center justify-center rounded-full"
          >
            {cleanMode ? (
              <Eye className="size-5" aria-hidden="true" />
            ) : (
              <EyeOff className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="relative z-30 px-4 pb-2">
        <StoriesBar segments={segments} percentage={percentage} />
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-md flex-1">
        {clip?.block.type === 'image' && (
          <div
            key={clip.key}
            className={cn(
              'absolute inset-x-0 top-[calc(env(safe-area-inset-top)+6rem)] z-10 flex justify-center px-4 [&_img]:max-h-[36dvh]',
              !reducedMotion && 'leeto-clip-enter',
            )}
          >
            <div className="w-full max-w-lg">
              <BlockView
                block={clip.block}
                text={clip.text}
                kineticRef={kineticRef}
                fontSize={subtitleFontSize}
                lineHeight={subtitleLineHeight}
                dimIntensity={settings.focusDimIntensity}
                kenBurns={!reducedMotion}
              />
            </div>
          </div>
        )}

        {(state.status === 'paused' || state.status === 'ended') && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onTouchEnd={(event) => event.stopPropagation()}
            aria-label="Reproducir"
            className="absolute inset-0 z-10 flex items-center justify-center"
          >
            <span className="bg-black/35 border-white/25 flex size-16 items-center justify-center rounded-full border backdrop-blur-sm">
              <Play className="text-reel size-8 fill-current" aria-hidden="true" />
            </span>
          </button>
        )}

        {clip && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8rem)] z-[15] flex items-center justify-center px-4',
              clip.block.type === 'image' ? 'top-[52dvh]' : 'top-24',
            )}
          >
            <div className="w-full max-w-md px-1 py-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
              {clip.block.type === 'text' ? (
                <BlockView
                  block={clip.block}
                  text={clip.text}
                  kineticRef={kineticRef}
                  fontSize={subtitleFontSize}
                  lineHeight={subtitleLineHeight}
                  dimIntensity={settings.focusDimIntensity}
                  kenBurns={!reducedMotion}
                  variant="subtitle"
                />
              ) : (
                <p className="text-reel text-center text-sm">{clip.block.caption ?? 'Imagen'}</p>
              )}
              <div
                className={cn(
                  'pointer-events-auto mt-3 hidden items-center justify-center gap-4 md:flex',
                  optionalChromeClass,
                )}
              >
                <button
                  type="button"
                  onClick={previous}
                  aria-label="Fragmento anterior"
                  className="text-reel flex size-9 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <SkipBack className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Fragmento siguiente"
                  className="text-reel flex size-9 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <SkipForward className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={optionalChromeClass}>
          <ReelActionRail
            title={book.title}
            quoteCount={quoteCount}
            ttsEnabled={settings.ttsEnabled}
            playing={state.status === 'playing'}
            reducedMotion={reducedMotion}
            heartPop={heartPop}
            onQuote={() => void handleQuote()}
            onToc={() => setTocOpen(true)}
            onShare={() => void handleShare()}
            onSettings={() => setSettingsOpen(true)}
            onToggleTts={() => void updateSettings({ ttsEnabled: !settings.ttsEnabled })}
          />
        </div>
      </div>

      {clip && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 flex justify-center px-4">
          <div className="w-full max-w-md text-center">
            <Marquee
              text={book.title}
              animate={!reducedMotion}
              className="text-reel text-sm font-medium"
            />
            <p className="text-reel-muted mt-0.5 text-[11px]">
              Cap. {(clip.chapterIndex + 1).toString().padStart(2, '0')} ·{' '}
              {clip.block.type === 'text'
                ? `${clip.segmentIndex + 1}/${clip.segmentCount}`
                : 'Imagen'}
            </p>
          </div>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="text-reel bg-black/60 absolute bottom-[calc(env(safe-area-inset-bottom)+11rem)] left-1/2 z-30 -translate-x-1/2 rounded-full px-3 py-1 text-xs backdrop-blur"
        >
          {notice}
        </p>
      )}

      <PlayerSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
      />

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
