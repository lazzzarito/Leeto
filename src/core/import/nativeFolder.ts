import { Capacitor, registerPlugin } from '@capacitor/core';
import { BOOK_EXTENSIONS } from '@/core/parsers/formats';

interface NativeFolderFile {
  name: string;
  path: string;
  mimeType?: string;
  dataBase64: string;
}

interface LeetoFolderPlugin {
  pickFolder(options: { extensions: string[] }): Promise<{ cancelled: boolean; files?: NativeFolderFile[] }>;
}

const plugin = registerPlugin<LeetoFolderPlugin>('LeetoFolder');

export function isNativeFolderPickerSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toFile(entry: NativeFolderFile): File {
  const bytes = decodeBase64(entry.dataBase64);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const file = new File([copy.buffer], entry.name, {
    type: entry.mimeType || undefined,
    lastModified: Date.now(),
  });
  Object.defineProperty(file, 'webkitRelativePath', {
    value: entry.path || entry.name,
    configurable: true,
  });
  return file;
}

/** Abre el selector SAF de Android y devuelve los libros compatibles como File. */
export async function pickNativeBookFolder(): Promise<File[] | undefined> {
  if (!isNativeFolderPickerSupported()) return undefined;
  const result = await plugin.pickFolder({ extensions: BOOK_EXTENSIONS });
  if (result.cancelled || !result.files) return undefined;
  return result.files.map(toFile);
}