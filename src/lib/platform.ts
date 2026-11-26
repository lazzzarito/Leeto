import { Capacitor } from '@capacitor/core';

/** La app corre dentro de la APK de Android (Capacitor/WebView). */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** Solo avisamos en el navegador de Android: dentro de la APK no tiene sentido. */
export function isAndroidWeb(): boolean {
  if (isNativeAndroid()) return false;
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}
