/** Datos de build inyectados por Vite desde package.json y VITE_BUILD_CHANNEL. */
declare const __APP_VERSION__: string;
declare const __APP_CHANNEL__: string;
declare const __APP_LABEL__: string;
declare const __APK_FILENAME__: string;
declare const __SITE_URL__: string;

export const APP_VERSION = __APP_VERSION__;
export const APP_CHANNEL = __APP_CHANNEL__;
export const APP_LABEL = __APP_LABEL__;
export const APK_FILENAME = __APK_FILENAME__;
export const SITE_URL = __SITE_URL__;
export const IS_BETA = APP_CHANNEL === 'beta';

/** Repositorio oficial: única fuente para enlaces de código, releases y legal. */
export const GITHUB_REPO_URL = 'https://github.com/lazzzarito/Leeto';

export const APK_RELEASE_TAG = `v${APP_VERSION}${IS_BETA ? '-beta' : ''}`;
export const APK_GITHUB_URL =
  `${GITHUB_REPO_URL}/releases/download/${APK_RELEASE_TAG}/${APK_FILENAME}`;
export const APK_URL = APK_GITHUB_URL;
export const APK_RELEASES_URL = `${GITHUB_REPO_URL}/releases/tag/${APK_RELEASE_TAG}`;
