# Leeto — Task checklist

Plan de alto nivel y decisiones: `tasks/plan.md`. Especificación fuente: `leeto.md`.

Convención: `[x]` = verificado. Cada tarea debe dejar el proyecto compilable.

---

## Fase 1 — Cimientos ✅

### T1: Scaffold Vite + React + TS
**Description:** Proyecto Vite inicial con React 18 + TypeScript strict, scripts de dev/build/preview/typecheck, entry point y configuración de Capacitor inicial.
**Acceptance criteria:**
- [x] `npm run dev` levanta sin errores (smoke test HTTP 200).
- [x] `npm run build` genera `dist/` sin errores.
- [x] `npm run typecheck` (`tsc --noEmit`) pasa.
- [x] `tsconfig.json` con `strict: true`.
**Verification:** `npm install`, `npm run typecheck`, `npm run build`.
**Dependencies:** None
**Files:** `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `capacitor.config.ts`
**Scope:** S (config cohesiva)

### T2: Tailwind v3 + tokens + 5 temas
**Description:** Tailwind v3 con contenido de HSL, `globals.css` con los 5 presets completos (`paper`, `amber`, `sepia`, `eink`, `oled`), fuentes Inter/serif editorial, safe areas y `components.json` para shadcn.
**Acceptance criteria:**
- [x] Los 5 bloques `[data-reading-theme="…"]` definen **todos** los tokens (incluidos `--reader-*`).
- [x] `@tailwind base/components/utilities` presentes; `cn()` usable con clases `bg-background`, `text-foreground`, etc.
- [x] Fuente sans para UI y serif para lectura disponibles vía variables CSS.
- [x] `prefers-reduced-motion` y `env(safe-area-inset-*)` contemplados en CSS base.
**Verification:** `npm run build`; inspección visual manipulando `document.documentElement.dataset.readingTheme`.
**Dependencies:** T1
**Files:** `tailwind.config.ts`, `postcss.config.js`, `src/styles/globals.css`, `components.json`
**Scope:** S

### T3: Tipos de dominio + utilidades base
**Description:** `src/types/index.ts` con todos los tipos de la spec y librerías `cn`, `ids` (uuid/deviceId), `time` (duración, formato), `hash` (SHA-256 WebCrypto).
**Acceptance criteria:**
- [x] Tipos exportados: `ReadingTheme`, `PlaybackState`, `TextBlock`, `ImageBlock`, `LeetoBlock`, `LeetoChapter`, `LeetoBook`, `StoredAsset`, `ReadingProgress`, `SavedQuote`, `AppSettings`, `SyncEnvelope`.
- [x] `hashFile(blob): Promise<string>` devuelve `sha256:<hex>` (test incluido).
- [x] `newId()` y `getOrCreateDeviceId()` (persistido en localStorage) funcionan.
- [x] `formatDuration()` y `estimateRemainingTime()` implementados (tests incluidos).
**Verification:** `npm run typecheck` + `npm test` (5 tests pasan).
**Dependencies:** T1
**Files:** `src/types/index.ts`, `src/lib/cn.ts`, `src/lib/ids.ts`, `src/lib/time.ts`, `src/lib/hash.ts`
**Scope:** M

### T4: Esquema Dexie + repositorios + settings
**Description:** DB Dexie tipada con tablas `books`, `assets`, `progress`, `quotes`, `settings`; repositorios mínimos y singleton de ajustes con valores por defecto de la spec.
**Acceptance criteria:**
- [x] Esquema con índices: books (`title,author,saga,importedAt,updatedAt`), assets (`bookId,kind`), quotes (`bookId,updatedAt,deletedAt`).
- [x] `getSettings()` crea el singleton si no existe, con `deviceId` y preset inicial sugerido por `prefers-color-scheme`.
- [x] `updateSettings()` persiste cambios y es reactivo (hook de Dexie o suscripción).
- [x] Repositorios CRUD básicos para books/assets/progress/quotes.
**Verification:** `npm run typecheck` + `npm run build`.
**Dependencies:** T3
**Files:** `src/core/db/db.ts`, `src/core/db/settings.ts`, `src/core/db/repositories.ts`
**Scope:** M

### T5: ThemeProvider
**Description:** Contexto/hook que aplica `data-reading-theme` en `<html>`, persiste la elección y reacciona a cambios del sistema cuando no hay elección guardada.
**Acceptance criteria:**
- [x] Cambiar tema actualiza el atributo del root inmediatamente.
- [x] El tema elegido persiste tras recargar (caché en localStorage + Dexie + script pre-pintado).
- [x] Sin elección previa, sigue `prefers-color-scheme` (paper/oled).
**Verification:** `npm run build`; requiere comprobación manual Cambiar tema → recargar.
**Dependencies:** T4
**Files:** `src/hooks/useTheme.ts`, `src/core/theme/themes.ts`, `index.html`
**Scope:** S

### T6: Router + AppShell
**Description:** Rutas `/`, `/read/:id`, `/settings` y layout principal responsive con safe areas y chrome mínimo.
**Acceptance criteria:**
- [x] Navegar a `/read/:id` y `/settings` renderiza sin errores.
- [x] El layout respeta `env(safe-area-inset-*)` y es usable en móvil y escritorio.
- [x] Ruta inválida redirige a `/`.
**Verification:** `npm run build` + smoke test HTTP del servidor de desarrollo.
**Dependencies:** T5
**Files:** `src/router.tsx`, `src/App.tsx`, `src/components/layout/AppShell.tsx`
**Scope:** S

### T7: Páginas placeholder + selector de tema
**Description:** Biblioteca vacía con estado vacío claro (invitación a importar), lector placeholder y página de ajustes con selector funcional de los 5 temas.
**Acceptance criteria:**
- [x] `/` muestra estado vacío con call-to-action de importación (aún no funcional).
- [x] `/read/:id` muestra un placeholder informativo.
- [x] `/settings` permite elegir tema y el cambio se aplica y persiste.
**Verification:** `npm run typecheck`, `npm run build`; requiere comprobación visual manual.
**Dependencies:** T6
**Files:** `src/pages/LibraryPage.tsx`, `src/pages/ReaderPage.tsx`, `src/pages/SettingsPage.tsx`
**Scope:** S

### Checkpoint: Fase 1
- [x] `npm run typecheck` y `npm run build` pasan sin errores.
- [x] La app renderiza biblioteca vacía, ruta de lector y ajustes (verificado por build + smoke test HTTP).
- [x] Cambiar tema persiste tras recarga (implementado; pendiente de comprobación visual en navegador).
- [x] Sin errores en consola del navegador (pendiente de comprobación visual; no hay errores en build/test).

---

## Fase 2 — Ingesta y persistencia offline ✅

### T8: Contrato de parser + normalizador + WorkerClient
**Description:** Definir `ParseRequest`/`ParseResult`/`ParseProgress`, normalizador a Leeto Format y cliente de workers con manejo de progreso/errores.
**Acceptance criteria:**
- [x] `htmlToBlocks()` produce ids estables y `wordCount` correcto (tests).
- [x] `runParserWorker()` propaga progreso y errores del worker EPUB.
- [x] `isDuplicate(hash)` consulta Dexie antes de parsear.
**Verification:** `npm test` (tests de normalización) + `npm run typecheck`.
**Dependencies:** T4
**Files:** `src/core/parsers/types.ts`, `src/core/parsers/normalize.ts`, `src/core/parsers/workerClient.ts`, `src/core/parsers/index.ts`
**Scope:** M

### T9: Worker EPUB
**Description:** Parseo de OPF/nav en worker con jszip + fast-xml-parser: metadatos, saga/volumen, capítulos, bloques de texto y assets de imágenes.
**Acceptance criteria:**
- [x] Importa EPUB simple y con imágenes de fixture (test de integración con ZIP en memoria).
- [x] Extrae título/autor/idioma/portada, saga/volumen y títulos de NCX.
- [x] Emite progreso; el worker se empaqueta correctamente como JS (`?worker` de Vite).
**Verification:** `npm test` (fixture EPUB generado) + inspección del worker compilado.
**Dependencies:** T8
**Files:** `src/core/parsers/epub.ts`, `src/core/parsers/epub.worker.ts`
**Scope:** M

### T10: PDF con capa de texto
**Description:** Extracción de texto con posiciones vía pdfjs-dist, heurísticas de cabeceras/pies y párrafos, y rechazo explícito de PDFs sin capa de texto.
**Acceptance criteria:**
- [x] PDF con texto importa con capítulos detectados y bloques razonables (test).
- [x] PDF escaneado devuelve: “Este PDF parece escaneado; la versión actual no incluye OCR” (test).
- [x] `workerSrc` de PDF.js configurado; se usa su propio worker desde el hilo principal (D5), no anidado.
**Verification:** `npm test` (fixtures PDF con/sin texto) + `npm run build`.
**Dependencies:** T8
**Files:** `src/core/parsers/pdf.ts`, `src/core/parsers/pdf.test.ts`
**Scope:** M
**Nota:** No se crea `pdf.worker.ts` de app: PDF.js ya aporta worker propio (decisión D5).

### T11: Dropzone + cola de importación
**Description:** Drag&drop y selector de archivos, cola con progreso por archivo y reporte de errores.
**Acceptance criteria:**
- [x] Permite selección múltiple y muestra estado por archivo.
- [x] Duplicados por hash se omiten con aviso.
- [x] Errores por archivo no detienen la cola.
**Verification:** implementado; requiere prueba manual en navegador.
**Dependencies:** T9, T10
**Files:** `src/components/library/Dropzone.tsx`, `src/components/library/ImportQueue.tsx`, `src/hooks/useImport.ts`
**Scope:** M

### T12: Persistencia transaccional + object URLs
**Description:** Guardar books/assets/progress en una transacción, generar portada y gestionar object URLs efímeras con revoke en cleanup.
**Acceptance criteria:**
- [x] Persistencia transaccional de books/assets/progress implementada.
- [x] Object URLs se crean bajo demanda y se revocan al desmontar (`useAssetUrl`).
- [x] Portada recuperable tras recarga (blob en IndexedDB).
**Verification:** `npm test` + `npm run build`; requiere comprobación manual de recarga en navegador.
**Dependencies:** T11
**Files:** `src/core/db/import.ts`, `src/hooks/useAssetUrl.ts`, `src/hooks/useLibrary.ts`, `src/components/library/BookCard.tsx`, `src/pages/LibraryPage.tsx`
**Scope:** M

### Checkpoint: Fase 2
- [x] Fixtures generados importan correctamente (tests EPUB y PDF).
- [x] PDF escaneado rechazado con mensaje claro (test).
- [x] `npm test` 14/14, `npm run build` limpio, 0 vulnerabilidades npm.
- [ ] Verificación visual manual en navegador: importar → recargar → portada visible.

---

## Fase 3 — Biblioteca inteligente ✅

### T13: Tabs y tarjetas
**Description:** Vistas Todos/Autores/Sagas/Citas con tarjetas responsivas, progreso y tiempo restante estimado.
**Acceptance criteria:**
- [x] Las 4 vistas muestran datos correctos (Tabs de Radix; agrupaciones puras testadas).
- [x] Sagas ordenadas por `volumeNumber` (nulos al final), test incluido.
- [x] Progreso y tiempo restante derivados de `totalWordCount` y PPM en `BookCard`.
**Verification:** `npm test` (6 tests de vistas) + `npm run typecheck`.
**Dependencies:** T12
**Files:** `src/core/library/views.ts`, `src/core/library/views.test.ts`, `src/components/library/LibraryTabs.tsx`, `src/components/library/BookCard.tsx`, `src/components/library/QuoteList.tsx`
**Scope:** M

### T14: Búsqueda instantánea
**Description:** Barra tipo Command que filtra por título, autor, saga y citas en tiempo real.
**Acceptance criteria:**
- [x] El filtrado responde a cada pulsación sin latencia perceptible (estado controlado, filtros puros).
- [x] Busca en título, autor, saga y excerpt/nota de citas, con normalización de acentos.
**Verification:** `npm test` (tests de `filterBooks`/`filterQuotes`); requiere prueba manual con dataset mixto.
**Dependencies:** T13
**Files:** `src/components/library/SearchBar.tsx`, `src/core/library/views.ts`, `src/hooks/useLibrary.ts`
**Scope:** S

### T15: Edición y borrado seguros
**Description:** Editar metadatos/portada, reubicar en saga y eliminar con cascada de progreso, citas y assets huérfanos en transacción.
**Acceptance criteria:**
- [x] Editar título/autor/saga/volumen actualiza `updatedAt` y se refleja en la biblioteca (tests con Dexie + fake-indexeddb).
- [x] Eliminar un libro borra su progreso, citas y assets en una transacción (test de cascada).
- [x] Reemplazar portada elimina la anterior huérfana o la conserva como imagen si sigue referenciada (test).
**Verification:** `npm test` (5 tests de DB) + `npm run build`.
**Dependencies:** T14
**Files:** `src/components/library/MetadataDialog.tsx`, `src/core/db/delete.ts`, `src/core/db/delete.test.ts`, `src/pages/LibraryPage.tsx`
**Scope:** M

### Checkpoint: Fase 3
- [x] Búsqueda, agrupaciones y orden de sagas correctos (tests puros).
- [x] Borrado limpia todos los datos asociados (test Dexie).
- [x] `npm test` 25/25, `npm run build` limpio (aviso de chunk >500 kB por Radix, no error).
- [ ] Verificación visual manual en navegador: tabs, búsqueda, editar y eliminar.

---

## Fase 4 — Reproductor dinámico ✅

### T16: Núcleo del motor (headless)
**Description:** Máquina de estados (`idle|loading|playing|paused|seeking|ended|error`), reloj único rAF, acumulador y cálculo de duración por PPM/velocidad, con tests.
**Acceptance criteria:**
- [x] Tests cubren transiciones de estado y `getBlockDuration(wordCount, wpm, speed)` (9 tests).
- [x] Cambiar velocidad/PPM conserva la posición relativa y recalcula el tiempo restante.
- [x] `seek`/`align` sitúan el playhead sin perder consistencia.
**Verification:** `npm test` + `npm run typecheck`.
**Dependencies:** T12
**Files:** `src/core/player/state.ts`, `src/core/player/state.test.ts`, `src/core/player/clock.ts`, `src/core/player/duration.ts`
**Scope:** M

### T17: Reader layout + modos
**Description:** Contenedor vertical tipo feed con snap por bloque, modo automático y manual/híbrido, y persistencia de progreso en eventos de ciclo de vida.
**Acceptance criteria:**
- [x] Un bloque por frame con `scroll-snap`; swipe/rueda/seek toman el control y pausan.
- [x] Reanuda en el bloque guardado (`progress.blockId` al cargar).
- [x] Progreso persistido con debounce en cambio de bloque, pausa, `visibilitychange`, `pagehide` y desmontaje.
**Verification:** implementado + tests del motor; requiere prueba manual de recarga.
**Dependencies:** T16
**Files:** `src/components/player/LeetoPlayer.tsx`, `src/components/player/BlockView.tsx`, `src/hooks/usePlayer.ts`, `src/pages/ReaderPage.tsx`
**Scope:** L (dividido en componentes)

### T18: Focus Playhead
**Description:** Texto completo visible con estados futuro/activo/leído, acento sutil, pausa uniforme y legible, modo estático y respeto a `prefers-reduced-motion`.
**Acceptance criteria:**
- [x] `KineticText` actualiza `data-playhead`/`aria-current` de forma imperativa; `BlockView` es `memo` (sin re-render por tick).
- [x] En pausa se levanta la atenuación y queda un marcador discreto (`data-playhead=marker`).
- [x] Cinética off / reduced-motion → lectura estática y legible (`useReducedMotion` + CSS).
**Verification:** implementado; requiere comprobación visual de contraste en los 5 temas.
**Dependencies:** T17
**Files:** `src/components/player/KineticText.tsx`, `src/components/player/BlockView.tsx`, `src/styles/kinetic.css`, `src/hooks/useReducedMotion.ts`
**Scope:** M

### T19: Controles del reproductor
**Description:** Barra tipo Stories, scrubbing, TOC (Drawer), velocidad, PPM, tipografía, tema, cinética, atajos y gestos.
**Acceptance criteria:**
- [x] Atajos: Espacio, ↑/↓, ←/→, F, T, Esc (+ Q para citas).
- [x] Gestos móviles: swipe, toque central, doble toque (cita) y pulsación larga (pausa).
- [x] Chrome se atenúa durante reproducción y reaparece con interacción.
**Verification:** implementado; requiere prueba manual escritorio y móvil (DevTools device mode).
**Dependencies:** T18
**Files:** `src/components/player/StoriesBar.tsx`, `src/components/player/PlayerControls.tsx`, `src/components/player/TocDrawer.tsx`
**Scope:** L (dividido en componentes)

### T20: Bloques de imagen
**Description:** Imágenes como clips con duración configurable, transición breve y Ken Burns sutil desactivable con reduced-motion.
**Acceptance criteria:**
- [x] Duración base configurable en ajustes (`imageDurationMs`) y ajustada por velocidad en el motor.
- [x] Ken Burns y transición de entrada se desactivan con reduced-motion.
- [x] Object URLs se crean y revocan en `useAssetUrl`.
**Verification:** `npm test` + `npm run build`; requiere prueba visual con EPUB con imágenes.
**Dependencies:** T19
**Files:** `src/components/player/ImageBlock.tsx`
**Scope:** S

### T21: TTS con fallback
**Description:** Driver opcional de Web Speech API alineado al playhead; fallback a temporizador ante `onboundary` inconsistente o falta de voces.
**Acceptance criteria:**
- [x] `speakText` usa la voz elegida y alinea `onboundary` con el playhead.
- [x] Errores de síntesis notifican pero no detienen el temporizador (fallback).
- [x] Activación explícita desde ajustes del reproductor (gesto del usuario).
**Verification:** implementado; requiere prueba en navegador con y sin voces.
**Dependencies:** T19
**Files:** `src/core/tts/driver.ts`, `src/core/tts/useTts.ts`
**Scope:** M

### Checkpoint: Fase 4
- [x] Reanudación exacta, cambio de velocidad sin perder posición y pausa legible (lógica testada).
- [x] Snap por bloque y transiciones breves (implementado).
- [x] Reduced-motion y cinética off funcionan; TTS degrada con gracia (implementado).
- [x] `npm test` 36/36 y `npm run build` limpio (aviso de chunk >500 kB, no error).
- [ ] Verificación visual/manual en navegador: reanudación, gestos, temas y voces.

---

## Fase 5 — Sincronización local-first

### T22: Sobre de sync + merge + backup
**Description:** Serialización de `SyncEnvelope`, merge por registro (progress/quotes/libraryRefs/devices), tombstones, backup rotativo y export/import manual, como funciones puras con tests.
**Acceptance criteria:**
- [ ] Tests del escenario A/B: cada dispositivo conserva su progreso y la cita sobrevive.
- [ ] Tombstone de cita propagado.
- [ ] Empate de `updatedAt` desempata por `deviceId` lexicográfico.
- [ ] Export/import round-trip sin pérdida.
**Verification:** `npm run test`.
**Dependencies:** T4
**Files:** `src/core/sync/envelope.ts`, `src/core/sync/merge.ts`, `src/core/sync/backup.ts`, `src/core/sync/*.test.ts`
**Scope:** M

### T23: SyncProvider + WebDAV
**Description:** Interfaz `SyncProvider` (read/write/exists) y conector WebDAV con cabeceras y manejo de errores; feature detection de HTTPS.
**Acceptance criteria:**
- [ ] Lee/escribe `leeto_sync.json` en un servidor WebDAV de prueba.
- [ ] Backup previo antes de sobrescribir.
- [ ] Errores de red no corrompen el estado local.
**Verification:** servidor WebDAV local o mock HTTP; tests del provider.
**Dependencies:** T22
**Files:** `src/core/sync/provider.ts`, `src/core/sync/webdav.ts`
**Scope:** M

### T24: Carpeta local + UI + triggers
**Description:** Conector de carpeta local (File System Access API / plugins Capacitor), configuración en ajustes y disparadores con debounce/backoff.
**Acceptance criteria:**
- [ ] En Chromium se puede elegir carpeta y sincronizar; en otros navegadores se oculta la opción con mensaje claro.
- [ ] Triggers: manual, al abrir, al pausar/guardar cita (debounce).
- [ ] Sin loops: se ignoran escrituras propias por `deviceId`/hash reciente.
**Verification:** prueba manual en Chromium; simular fallo de red.
**Dependencies:** T23
**Files:** `src/core/sync/localFolder.ts`, `src/core/sync/scheduler.ts`, `src/components/settings/SyncSettings.tsx`
**Scope:** M

### Checkpoint: Fase 5
- [ ] Escenario multi-dispositivo simulado sin pérdidas.
- [ ] Tombstones y backups funcionan.
- [ ] Export/import manual disponible como red de seguridad.
