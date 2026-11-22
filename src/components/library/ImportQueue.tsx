import { cn } from '@/lib/cn';
import { describeJob, type ImportJob } from '@/hooks/useImport';

interface ImportQueueProps {
  jobs: ImportJob[];
}

export default function ImportQueue({ jobs }: ImportQueueProps) {
  if (jobs.length === 0) return null;

  return (
    <section aria-label="Estado de las importaciones" className="space-y-2">
      <h2 className="text-sm font-medium">Importaciones</h2>
      <ul className="space-y-2">
        {jobs.map((job) => (
          <li key={job.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{job.fileName}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{describeJob(job)}</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(job.progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progreso de ${job.fileName}`}
            >
              <div
                className={cn(
                  'bg-primary h-full rounded-full transition-[width] duration-200',
                  job.status === 'error' && 'bg-destructive',
                )}
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
