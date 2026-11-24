import { MAX_SYNC_TEXT_LENGTH } from './envelope';

function tooLarge(): Error {
  return new Error('El archivo de sincronización es demasiado grande');
}

/** Lee una respuesta con límite de bytes para no bufferear archivos remotos hostiles. */
export async function readResponseTextLimited(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_SYNC_TEXT_LENGTH) throw tooLarge();

  if (!response.body) {
    const text = await response.text();
    if (text.length > MAX_SYNC_TEXT_LENGTH) throw tooLarge();
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_SYNC_TEXT_LENGTH) throw tooLarge();
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  }
  if (text.length > MAX_SYNC_TEXT_LENGTH) throw tooLarge();
  return text;
}

/** Comprueba el tamaño antes de leer un archivo seleccionado por el usuario. */
export async function readFileTextLimited(file: File): Promise<string> {
  if (file.size > MAX_SYNC_TEXT_LENGTH) throw tooLarge();
  const text = await file.text();
  if (text.length > MAX_SYNC_TEXT_LENGTH) throw tooLarge();
  return text;
}
