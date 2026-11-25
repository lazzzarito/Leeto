import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeAudioState {
  status: string;
  index: number;
  count: number;
}

export interface NativeAudioBoundary {
  index: number;
  wordIndex: number;
}

interface LeetoAudioPlugin {
  requestPermissions(): Promise<Record<string, string>>;
  configure(options: {
    chunks: string[];
    clipIndices: number[];
    title: string;
    subtitle: string;
    index: number;
    rate: number;
    lang: string;
    bookId?: string;
  }): Promise<void>;
  play(options: { index: number }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  stop(): Promise<void>;
  setCover(options: { coverDataUrl?: string }): Promise<void>;
  addListener(event: 'stateChanged', callback: (event: NativeAudioState) => void): Promise<PluginListenerHandle>;
  addListener(event: 'boundary', callback: (event: NativeAudioBoundary) => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', callback: (event: { message: string }) => void): Promise<PluginListenerHandle>;
}

const LeetoAudio = registerPlugin<LeetoAudioPlugin>('LeetoAudio');

export function isNativeAudioAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export const nativeAudio = {
  requestPermissions: () => LeetoAudio.requestPermissions(),
  configure: (options: Parameters<LeetoAudioPlugin['configure']>[0]) =>
    LeetoAudio.configure(options),
  play: (index: number) => LeetoAudio.play({ index }),
  pause: () => LeetoAudio.pause(),
  resume: () => LeetoAudio.resume(),
  next: () => LeetoAudio.next(),
  previous: () => LeetoAudio.previous(),
  stop: () => LeetoAudio.stop(),
  setCover: (coverDataUrl?: string) => LeetoAudio.setCover({ coverDataUrl }),
  addListener: LeetoAudio.addListener.bind(LeetoAudio),
};
