import { ArrowLeft, Eye, EyeOff, Play, SkipBack, SkipForward } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
  type WheelEvent,
} from 'react';
import { updateSettings, useSettings } from '@/core/db/settings';
import { registerBackHandler } from '@/core/navigation/backHandler';
import { usePlayerContext } from '@/core/player/PlayerProvider';
import { getClipDuration } from '@/core/player/state';
import { useBackToLibrary } from '@/hooks/useBackToLibrary';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/cn';
import Marquee from '@/components/ui/Marquee';
import type { LeetoBook } from '@/types';
import BlockView from './BlockView';
import ReelActionRail from './ReelActionRail';
import ReelBackdrop from './ReelBackdrop';
import StoriesBar from './StoriesBar';
import type { KineticTextHandle } from './KineticText';

const PlayerSettingsDialog = lazy(() => import('./PlayerSettingsDialog'));
const TocDrawer = lazy(() => import('./TocDrawer'));

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
    saveQuote,
    tts,
    audioError,
  } = usePlayerContext();
  const settings = useSettings();
  const goBack = useBackToLibrary();
  const reducedMotion = useReducedMotion(settings.reducedMotion);

  const kineticRef = useRef<KineticTextHandle>(null!);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<TouchStart | undefined>(undefined);
  const lastTapRef = useRef(0);
  const lastGestureRef = useRef(0);
  const lastWheelRef = useRef(0);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressFiredRef = useRef(false);
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tapToggleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [cleanMode, setCleanMode] = useState(false);
  const [quoteCaptured, setQuoteCaptured] = useState(false);

  // El back del sistema cierra primero la capa visible; la navegación de la
  // ruta se registra en ReaderPage con menor prioridad.
  useEffect(
    () =>
      registerBackHandler(() => {
        if (settingsOpen) {
          setSettingsOpen(false);
          return true;
        }
        if (tocOpen) {
          setTocOpen(false);
          return true;
        }
        return false;
      }, 10),
    [settingsOpen, tocOpen],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(undefined), 2200);
  }, []);

  const flashQuote = useCallback(() => {
    if (reducedMotion) return;
    setQuoteCaptured(false);
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = setTimeout(() => {
      setQuoteCaptured(true);
      quoteTimerRef.current = setTimeout(() => setQuoteCaptured(false), 800);
    }, 0);
  }, [reducedMotion]);

  const handleQuote = useCallback(async () => {
    const quote = await saveQuote();
    if (quote) flashQuote();
    showNotice(quote ? 'Cita guardada' : 'Este bloque no tiene texto para citar');
  }, [flashQuote, saveQuote, showNotice]);



  const openToc = useCallback(() => setTocOpen(true), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const handleQuoteClick = useCallback(() => void handleQuote(), [handleQuote]);
  const handleTocSeek = useCallback((index: number) => seekTo(index), [seekTo]);
  const toggleTts = useCallback(() => {
    void updateSettings({ ttsEnabled: !settings.ttsEnabled });
  }, [settings.ttsEnabled]);

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
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
      if (tapToggleTimerRef.current) clearTimeout(tapToggleTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const interactive =
        target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) ||
          target.isContentEditable);
      // Escape debe funcionar aunque el foco esté en el botón que cerró un diálogo.
      if (interactive && event.key !== 'Escape') return;
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
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => showNotice('No se pudo salir de pantalla completa'));
          } else {
            void containerRef.current
              ?.requestFullscreen?.()
              .catch(() => showNotice('Pantalla completa no disponible'));
          }
          break;
        case 'q':
        case 'Q':
          void handleQuote();
          break;
        case 'Escape':
          if (state.status === 'playing') pause();
          else goBack();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goBack, handleQuote, next, pause, previous, settingsOpen, showNotice, state.status, tocOpen, toggle]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  }, []);

  const cancelTapToggle = useCallback(() => {
    if (tapToggleTimerRef.current) {
      clearTimeout(tapToggleTimerRef.current);
      tapToggleTimerRef.current = undefined;
    }
  }, []);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const target = event.target;
    const el = target instanceof Element ? target : (target as Node | null)?.parentElement;
    if (el?.closest('button, a, input, select, textarea, [role="dialog"], [data-player-action="true"]')) {
      touchStartRef.current = undefined;
      return;
    }
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
    const target = event.target;
    const el = target instanceof Element ? target : (target as Node | null)?.parentElement;
    if (el?.closest('button, a, input, select, textarea, [role="dialog"], [data-player-action="true"]')) {
      touchStartRef.current = undefined;
      lastGestureRef.current = Date.now();
      return;
    }
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = undefined;
    if (!start || !touch) return;
    // El click sintético que sigue a cualquier gesto no debe volver a alternar el estado.
    lastGestureRef.current = Date.now();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      cancelTapToggle();
      return;
    }

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > SWIPE_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
      cancelTapToggle();
      if (dy < 0) next();
      else previous();
      return;
    }
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      cancelTapToggle();
      return;
    }

    const now = Date.now();
    cancelTapToggle();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      // El doble toque captura la cita sin alternar antes la reproducción.
      lastTapRef.current = 0;
      void handleQuote();
    } else {
      lastTapRef.current = now;
      tapToggleTimerRef.current = setTimeout(() => {
        tapToggleTimerRef.current = undefined;
        toggle();
      }, DOUBLE_TAP_MS);
    }
  };

  // Un clic (ratón/trackpad) también reproduce: el gesto táctil ya se gestiona arriba.
  const handleSurfaceClick = (event: MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastGestureRef.current < 700) return;
    if (
      event.target instanceof Element &&
      event.target.closest('button, a, input, select, textarea, [role="dialog"], [data-player-action="true"]')
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

  // El modo limpio es manual (botón del header). El texto nunca se oculta solo.
  const optionalChromeClass = cn(
    'transition-opacity duration-200',
    cleanMode && 'pointer-events-none opacity-0',
  );
  const clipDuration = getClipDuration(state);
  const imageProgress =
    clip?.block.type === 'image' && clipDuration > 0
      ? Math.min(1, state.elapsedMs / clipDuration)
      : undefined;
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
      <span className="reel-top-scrim pointer-events-none absolute inset-x-0 top-0 z-20 h-32 opacity-40" aria-hidden="true" />
      <p aria-live="polite" className="sr-only">
        {chapter ? `Capítulo ${chapter.index + 1}: ${chapter.title}. ` : ''}
        {clip ? `Fragmento ${clip.segmentIndex + 1} de ${clip.segmentCount}.` : ''}
      </p>

      <div className="pt-safe relative z-30 px-4 pb-2">
        <StoriesBar percentage={percentage} />
      </div>

      <div
        className="relative z-30 bg-transparent px-4"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver a la biblioteca"
            className={cn(
              'text-reel hover:bg-white/10 flex size-9 shrink-0 items-center justify-center rounded-full',
              optionalChromeClass,
            )}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
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
        {imageProgress !== undefined && (
          <div
            className="mx-1 mb-1 h-[2px] overflow-hidden rounded-full bg-white/20"
            aria-hidden="true"
          >
            <div
              className="h-full bg-white/90 transition-[width] duration-75 ease-linear"
              style={{ width: `${imageProgress * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-md flex-1 md:max-w-3xl">
        {clip?.block.type === 'image' && (
          <div
            key={clip.key}
            className={cn(
              'absolute inset-x-0 top-[calc(env(safe-area-inset-top)+6rem)] z-10 flex justify-center px-4 [&_img]:max-h-[36dvh] md:[&_img]:max-h-[52dvh]',
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
              // El click sintético posterior al gesto que pausó no debe reanudar.
              if (Date.now() - lastGestureRef.current < 700) return;
              toggle();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              lastGestureRef.current = 0;
            }}
            onPointerUp={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onTouchEnd={(event) => event.stopPropagation()}
            aria-label="Reproducir"
            className="absolute inset-0 z-[10] flex items-center justify-center"
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
            <div className="flex min-h-[9rem] w-full max-w-md flex-col justify-center px-1 py-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] md:max-w-2xl">
              {clip.block.type === 'text' && (
                <BlockView
                  key={clip.key}
                  block={clip.block}
                  text={clip.text}
                  kineticRef={kineticRef}
                  fontSize={subtitleFontSize}
                  lineHeight={subtitleLineHeight}
                  dimIntensity={settings.focusDimIntensity}
                  kenBurns={!reducedMotion}
                  variant="subtitle"
                />
              )}
              <div
                className={cn(
                  'pointer-events-auto mt-3 hidden items-center justify-center gap-4 md:flex',
                  optionalChromeClass,
                )}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    previous();
                  }}
                  aria-label="Fragmento anterior"
                  className="text-reel flex size-9 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <SkipBack className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    next();
                  }}
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
            ttsEnabled={settings.ttsEnabled}
            playing={state.status === 'playing'}
            reducedMotion={reducedMotion}
            quoteCaptured={quoteCaptured}
            onQuote={handleQuoteClick}
            onToc={openToc}
            onSettings={openSettings}
            onToggleTts={toggleTts}
          />
        </div>
      </div>

      {clip && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.75rem)] z-20 flex justify-center px-4">
          <div className="w-full max-w-md text-center md:max-w-2xl">
            <Marquee
              text={book.title}
              animate={!reducedMotion}
              className="text-reel text-sm font-medium"
            />
            <p className="text-reel-muted mt-1.5 text-[11px]">
              Capítulo {clip.chapterIndex + 1} ·{' '}
              {clip.block.type === 'text'
                ? `fragmento ${clip.segmentIndex + 1} de ${clip.segmentCount}`
                : 'imagen'}
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

      {settingsOpen && (
        <Suspense fallback={null}>
          <PlayerSettingsDialog
            open
            onOpenChange={setSettingsOpen}
            book={book}
            voices={tts.voices}
          />
        </Suspense>
      )}

      {tocOpen && (
        <Suspense fallback={null}>
          <TocDrawer
            open
            onOpenChange={setTocOpen}
            chapters={book.chapters}
            toc={book.toc}
            clips={state.clips}
            activeClipIndex={state.clipIndex}
            percentage={percentage}
            onSeek={handleTocSeek}
          />
        </Suspense>
      )}

      {(tts.lastError ?? audioError) && (
        <p role="alert" className="sr-only">
          {tts.lastError ?? audioError}
        </p>
      )}
    </div>
  );
}
