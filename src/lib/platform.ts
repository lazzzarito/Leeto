import { Capacitor } from '@capacitor/core';

/** Solo avisamos en el navegador de Android: dentro de la APK no tiene sentido. */
export function isAndroidWeb(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}
