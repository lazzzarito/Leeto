import { parseEpub } from './epub';
import { ParseError, type WorkerRequest, type WorkerResponse } from './types';

const workerScope = self as unknown as {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void;
};

workerScope.addEventListener('message', async (event) => {
  const message = event.data;
  if (message.type !== 'parse') return;

  try {
    const result = await parseEpub(message.payload, (progress) =>
      workerScope.postMessage({ type: 'progress', payload: progress }),
    );
    const transfer = result.assets.map((asset) => asset.bytes.buffer as ArrayBuffer);
    workerScope.postMessage({ type: 'result', payload: result }, transfer);
  } catch (error) {
    const parseError =
      error instanceof ParseError
        ? error
        : new ParseError(error instanceof Error ? error.message : 'Error al parsear el EPUB');
    workerScope.postMessage({
      type: 'error',
      message: parseError.message,
      code: parseError.code,
    });
  }
});
