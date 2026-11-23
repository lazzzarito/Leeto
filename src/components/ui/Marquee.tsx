import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface MarqueeProps {
  text: string;
  animate?: boolean;
  className?: string;
}

/** Muestra el texto completo cuando cabe y lo desplaza solo cuando se desborda. */
export default function Marquee({ text, animate = true, className }: MarqueeProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const check = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  const scrolling = overflowing && animate;

  return (
    <span
      ref={containerRef}
      title={text}
      className={cn('block overflow-hidden whitespace-nowrap text-ellipsis', className)}
    >
      {scrolling ? (
        <span className="inline-flex leeto-marquee">
          <span className="shrink-0 pr-8">{text}</span>
          <span aria-hidden="true" className="shrink-0 pr-8">
            {text}
          </span>
        </span>
      ) : (
        text
      )}
    </span>
  );
}
