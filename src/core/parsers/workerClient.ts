import EpubWorker from './epub.worker?worker';
import type { ParseProgress, ParseRequest, ParseResult, WorkerResponse } from './types';

// PDF.js trae su propio worker: se ejecuta desde el hilo principal (D5) para no anidar workers.
const WORKER_CONSTRUCTORS = { epub: EpubWorker } as const;

export type ParserKind = keyof typeof WORKER_CONSTRUCTORS;

/** Envía un archivo a un worker de parseo y enruta progreso/resultado/error. */
export function runParserWorker(
  kind: ParserKind,
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParseResult> {
  return new Promise<ParseResult>((resolve, reject) => {
    const WorkerConstructor = WORKER_CONSTRUCTORS[kind];
    const worker = new WorkerConstructor();

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      worker.terminate();
    };

    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      switch (message.type) {
        case 'progress':
          onProgress(message.payload);
          break;
        case 'result':
          cleanup();
          resolve(message.payload);
          break;
        case 'error': {
          cleanup();
          const error = new Error(message.message) as Error & { code?: string };
          error.code = message.code;
          reject(error);
          break;
        }
      }
    };

    const handleError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || 'Error inesperado en el worker de parseo'));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage(
      { type: 'parse', payload: request },
      [request.bytes.buffer as ArrayBuffer],
    );
  });
}
