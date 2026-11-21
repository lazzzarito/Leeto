import { useCallback, useState } from 'react';
import { isDuplicate, persistParseResult } from '@/core/db/import';
import { parseFile, type ParseProgress } from '@/core/parsers';
import type { ParseStage } from '@/core/parsers/types';
import { hashFile } from '@/lib/hash';
import { newId } from '@/lib/ids';

export type ImportStatus =
  | 'queued'
  | 'hashing'
  | 'parsing'
  | 'saving'
  | 'imported'
  | 'duplicate'
  | 'error';

export interface ImportJob {
  id: string;
  fileName: string;
  status: ImportStatus;
  progress: number;
  stage?: ParseStage;
  error?: string;
}

const STAGE_LABELS: Record<ParseStage, string> = {
  parsing: 'Analizando',
  'extracting-assets': 'Extrayendo imágenes',
  normalizing: 'Normalizando',
  done: 'Listo',
};

export function describeJob(job: ImportJob): string {
  if (job.error) return job.error;
  switch (job.status) {
    case 'queued':
      return 'En cola';
    case 'hashing':
      return 'Calculando huella';
    case 'parsing':
      return job.stage ? STAGE_LABELS[job.stage] : 'Analizando';
    case 'saving':
      return 'Guardando';
    case 'imported':
      return 'Importado';
    case 'duplicate':
      return 'Ya estaba en la biblioteca';
    case 'error':
      return 'Error';
  }
}

export function useImport() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);

  const patchJob = useCallback((id: string, patch: Partial<ImportJob>) => {
    setJobs((previous) => previous.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }, []);

  const importFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const id = newId('job');
        setJobs((previous) => [
          ...previous,
          { id, fileName: file.name, status: 'queued', progress: 0 },
        ]);

        try {
          patchJob(id, { status: 'hashing', progress: 2 });
          const contentHash = await hashFile(file);
          if (await isDuplicate(contentHash)) {
            patchJob(id, { status: 'duplicate', progress: 100 });
            continue;
          }

          patchJob(id, { status: 'parsing', progress: 5 });
          const onProgress = (progress: ParseProgress) =>
            patchJob(id, {
              status: 'parsing',
              progress: progress.percent,
              stage: progress.stage,
            });
          const result = await parseFile(file, onProgress, contentHash);

          patchJob(id, { status: 'saving', progress: 97 });
          await persistParseResult(result);
          patchJob(id, { status: 'imported', progress: 100, stage: 'done' });
        } catch (error) {
          patchJob(id, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      }
    },
    [patchJob],
  );

  const clearFinished = useCallback(() => {
    setJobs((previous) =>
      previous.filter((job) => !['imported', 'duplicate', 'error'].includes(job.status)),
    );
  }, []);

  return { jobs, importFiles, clearFinished };
}
