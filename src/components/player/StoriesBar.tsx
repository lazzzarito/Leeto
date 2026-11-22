interface StoriesBarProps {
  percentage: number;
}

/** Línea continua con el progreso global del libro. */
export default function StoriesBar({ percentage }: StoriesBarProps) {
  return (
    <div
      role="progressbar"
      aria-label="Progreso de lectura"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-muted h-[3px] w-full overflow-hidden rounded-full"
    >
      <div
        className="bg-primary h-full rounded-full transition-[width] duration-200 ease-linear"
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}
