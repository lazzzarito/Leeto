import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';

export interface KineticTextHandle {
  setWordIndex(index: number): void;
  setMarker(index: number): void;
  setUniform(): void;
}

interface KineticTextProps {
  content: string;
  fontSize: number;
  lineHeight: number;
  dimIntensity: number;
  variant?: 'body' | 'subtitle';
}

/**
 * Texto completo visible: el playhead se actualiza por DOM (data-playhead),
 * sin re-renderizar el bloque en cada tick.
 */
const KineticText = memo(
  forwardRef<KineticTextHandle, KineticTextProps>(function KineticText(
    { content, fontSize, lineHeight, dimIntensity, variant = 'body' },
    ref,
  ) {
    const words = useMemo(() => content.split(/\s+/).filter(Boolean), [content]);
    const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
    const previous = useRef(-1);

    const setWordState = useCallback((index: number, state: string) => {
      const element = wordRefs.current[index];
      if (!element || element.dataset.playhead === state) return;
      element.dataset.playhead = state;
      if (state === 'active' || state === 'marker') element.setAttribute('aria-current', 'true');
      else element.removeAttribute('aria-current');
    }, []);

    const setUniform = useCallback(() => {
      wordRefs.current.forEach((_, index) => setWordState(index, 'uniform'));
      previous.current = -1;
    }, [setWordState]);

    /** En pausa: contraste uniforme con un marcador discreto de la posición. */
    const setMarker = useCallback(
      (index: number) => {
        setUniform();
        setWordState(Math.min(words.length - 1, Math.max(0, index)), 'marker');
      },
      [setUniform, setWordState, words.length],
    );

    const setWordIndex = useCallback(
      (index: number) => {
        const current = Math.min(words.length - 1, Math.max(0, index));
        const prior = previous.current;
        if (prior === current) return;

        if (prior < 0) {
          words.forEach((_, position) => {
            setWordState(position, position < current ? 'read' : position === current ? 'active' : 'future');
          });
        } else if (current > prior) {
          for (let position = prior; position < current; position += 1) {
            setWordState(position, 'read');
          }
          setWordState(current, 'active');
        } else {
          for (let position = current + 1; position <= prior; position += 1) {
            setWordState(position, 'future');
          }
          setWordState(current, 'active');
        }
        previous.current = current;
      },
      [setWordState, words.length],
    );

    useImperativeHandle(
      ref,
      () => ({ setWordIndex, setMarker, setUniform }),
      [setWordIndex, setMarker, setUniform],
    );

    const style = {
      fontSize,
      lineHeight,
      '--kinetic-future-opacity': Math.max(0.15, Math.min(1, 1 - dimIntensity)),
    } as CSSProperties;

    return (
      <p
        className={cn(
          'font-reading',
          variant === 'subtitle'
            ? 'text-reel max-w-none text-balance text-center'
            : 'mx-auto max-w-[68ch] text-left',
        )}
        style={style}
      >
        {words.map((word, index) => (
          <span
            key={index}
            ref={(element) => {
              wordRefs.current[index] = element;
            }}
            data-playhead="uniform"
            className="kinetic-word"
          >
            {word}
            {index < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
    );
  }),
);

export default KineticText;
