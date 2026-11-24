import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { describeImportBatch, type ImportBatchSummary } from '@/core/import/batch';
import { isDuplicate, persistParseResult } from '@/core/db/import';
import { parseFile, type ParseProgress } from '@/core/parsers';
import type { ParseStage } from '@/core/parsers/types';
import { hashFile } from '@/lib/hash';
import { newId } from '@/lib/ids';
import { useNotifications } from '@/components/notifications/NotificationProvider';

export type ImportStatus = 'queued' | 'hashing' | 'parsing' | 'saving' | 'imported' | 'duplicate' | 'error';

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
    case 'queued': return 'En cola';
    case 'hashing': return 'Calculando huella';
    case 'parsing': return job.stage ? STAGE_LABELS[job.stage] : 'Analizando';
    case 'saving': return 'Guardando';
    case 'imported': return 'Importado';
    case 'duplicate': return 'Ya estaba en la biblioteca';
    case 'error': return 'Error';
  }
}

interface ImportContextValue {
  jobs: ImportJob[];
  importFiles: (files: File[]) => Promise<void>;
}

const ImportContext = createContext<ImportContextValue | undefined>(undefined);

export function ImportProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const { push } = useNotifications();

  const patchJob = useCallback((id: string, patch: Partial<ImportJob>) => {
    setJobs((previous) => previous.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }, []);

  const completeJob = useCallback((id: string, patch: Partial<ImportJob>) => {
    patchJob(id, patch);
    setJobs((previous) => previous.filter((job) => job.id !== id));
  }, [patchJob]);

  const finishJob = useCallback((id: string, patch: Partial<ImportJob>, toast: { kind: 'success' | 'info' | 'error'; title: string; detail?: string }) => {
    completeJob(id, patch);
    push({ kind: toast.kind, title: toast.title, subtitle: toast.detail, durationMs: 4500, dismissible: true });
  }, [completeJob, push]);

  const importFiles = useCallback(async (files: File[]) => {
    const batched = files.length > 1;
    const summary: ImportBatchSummary = { total: files.length, imported: 0, duplicates: 0, failedFiles: [] };

    for (const file of files) {
      const id = newId('job');
      setJobs((previous) => [...previous, { id, fileName: file.name, status: 'queued', progress: 0 }]);
      try {
        patchJob(id, { status: 'hashing', progress: 2 });
        const contentHash = await hashFile(file);
        if (await isDuplicate(contentHash)) {
          if (batched) { summary.duplicates += 1; completeJob(id, { status: 'duplicate', progress: 100 }); }
          else finishJob(id, { status: 'duplicate', progress: 100 }, { kind: 'info', title: 'Ya estaba en la biblioteca', detail: file.name });
          continue;
        }
        patchJob(id, { status: 'parsing', progress: 5 });
        const onProgress = (progress: ParseProgress) => patchJob(id, { status: 'parsing', progress: progress.percent, stage: progress.stage });
        const result = await parseFile(file, onProgress, contentHash);
        patchJob(id, { status: 'saving', progress: 97 });
        await persistParseResult(result);
        if (batched) { summary.imported += 1; completeJob(id, { status: 'imported', progress: 100, stage: 'done' }); }
        else finishJob(id, { status: 'imported', progress: 100, stage: 'done' }, { kind: 'success', title: 'Libro importado', detail: result.title || file.name });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        if (batched) { summary.failedFiles.push({ name: file.name, error: message }); completeJob(id, { status: 'error', error: message }); }
        else finishJob(id, { status: 'error', error: message }, { kind: 'error', title: 'No se pudo importar', detail: message });
      }
    }

    if (batched) {
      const batch = describeImportBatch(summary);
      push({ kind: batch.kind, title: batch.title, subtitle: batch.detail, durationMs: 4500, dismissible: true });
    }
  }, [completeJob, finishJob, patchJob, push]);

  const value = useMemo(() => ({ jobs, importFiles }), [jobs, importFiles]);
  return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>;
}

export function useImport() {
  const value = useContext(ImportContext);
  if (!value) throw new Error('useImport debe usarse dentro de ImportProvider');
  return value;
}
