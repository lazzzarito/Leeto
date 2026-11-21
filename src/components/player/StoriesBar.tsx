interface StoriesBarProps {
  segments: number[];
  percentage: number;
}

/** Barra segmentada tipo Stories: un segmento por capítulo. */
export default function StoriesBar({ segments, percentage }: StoriesBarProps) {
  return (
    <div
      role="progressbar"
      aria-label="Progreso de lectura"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex gap-1"
    >
      {segments.map((value, index) => (
        <div
          key={index}
          className="bg-muted h-1 flex-1 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-200"
            style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
          />
        </div>
      ))}
    </div>
  );
}
