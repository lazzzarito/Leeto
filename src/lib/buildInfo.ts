/** Datos de build inyectados por Vite desde package.json y VITE_BUILD_CHANNEL. */
declare const __APP_VERSION__: string;
declare const __APP_CHANNEL__: string;
declare const __APP_LABEL__: string;
declare const __APK_FILENAME__: string;

export const APP_VERSION = __APP_VERSION__;
export const APP_CHANNEL = __APP_CHANNEL__;
export const APP_LABEL = __APP_LABEL__;
export const APK_FILENAME = __APK_FILENAME__;
export const APK_URL = `/downloads/${APK_FILENAME}`;
export const IS_BETA = APP_CHANNEL === 'beta';
