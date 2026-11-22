# Plan de implementación: Leeto

## Overview

Construir Leeto, un lector dinámico local-first (EPUB/PDF →feed vertical con "Focus Playhead") 100% cliente, a partir de la especificación `leeto.md` v2.1. El plan respeta las 5 fases del documento, pero las descompone en tareas pequeñas (S/M, ≤5 archivos) con criterios de aceptación y verificación explícitos, siguiendo un orden de dependencias de abajo hacia arriba y con checkpoints entre fases.

El seguimiento de tareas vive en `tasks/todo.md`.

## Decisiones de arquitectura (confirmadas por la spec)

- **Stack base:** Vite + React 18 + TypeScript (strict) + react-router-dom. SPA/PWA, build estático.
- **Gestor de paquetes:** npm (es el único disponible en el entorno: Node 26.7 / npm 12).
- **UI:** Tailwind CSS v3 + estilo shadcn/ui sobre primitivas Radix (`dialog`, `dropdown-menu`, `tabs`, instaladas en Fase 3) + lucide-react. Tokens HSL por tema.
- **Persistencia:** Dexie (IndexedDB), esquematipado; singleton de `settings` con `deviceId`.
- **Identidad:** `contentHash` SHA-256 (WebCrypto) como clave de libro.
- **Parseo:** Web Worker de app para EPUB (jszip + fast-xml-parser, empaquetado con `?worker`). PDF usa pdfjs-dist desde el hilo principal con **su propio worker** (D5: evitar workers anidados); se carga con `import()` diferido para no engordar el bundle inicial.
- **Temas:** 5 presets autocontenidos aplicados vía `data-reading-theme` en `<html>`.
- **Motor:** máquina de estados + único reloj `requestAnimationFrame`; TTS como driver opcional con fallback a temporizador.
- **Sync v1:** WebDAV + carpeta local, merge por registro con `updatedAt`/`deviceId` y tombstones. Sin backend propio.
- **Diferido:** OCR de PDF escaneado (rechazo explícito), Drive/OneDrive (5b), cifrado E2E (diseño previsto, no prometido), Capacitor nativo (config inicial en F1, plataformas cuando se necesiten).

## Lista de tareas

### Fase 1 — Cimientos
- T1: Scaffold Vite + React + TS (config de build, entry point).
- T2: Tailwind v3 + tokens + 5 temas de lectura + globals.css + components.json.
- T3: Tipos de dominio + utilidades base (cn, ids, tiempo, hash) + deviceId.
- T4: Esquema Dexie + repositorios + settings singleton.
- T5: ThemeProvider (persistencia + apply en root + prefers-color-scheme).
- T6: Router + AppShell (layout responsive, safe areas).
- T7: Páginas placeholder (Library/Reader/Settings) + selector de tema en Settings.

**Checkpoint F1:** dev/build/tsc limpios; biblioteca vacía y rutas renderizan; el tema persiste tras recarga.

### Fase 2 — Ingesta y persistencia offline
- T8: Contrato de parser + WorkerClient + normalizador (Leeto Format) + detección de duplicados por hash.
- T9: Worker EPUB (metadatos, series/volumen, capítulos, bloques, imágenes).
- T10: Worker PDF (texto con posiciones, heurísticas, rechazo de escaneado).
- T11: Dropzone/selector + cola de importación con progreso y reporte de errores.
- T12: Persistencia transaccional books/assets/progress + object URLs con revoke.

**Checkpoint F2:** fixtures EPUB simple/con imágenes y PDF con texto importan; tras recarga portadas siguen visibles; PDF escaneado muestra error claro; UI no bloquea.

### Fase 3 — Biblioteca inteligente
- T13: Tabs Todos/Autores/Sagas/Citas + tarjetas con progreso y tiempo estimado.
- T14: Búsqueda instantánea (Command) por título/autor/saga/citas.
- T15: Edición de metadatos + portada + eliminación en cascada y limpieza de huérfanos.

**Checkpoint F3:** búsqueda y agrupaciones correctas; sagas ordenadas por volumen; borrado limpia progreso/citas/assets.

### Fase 4 — Reproductor dinámico
- T16: Núcleo headless: estado, reloj rAF, cálculo de duración (PPM/velocidad) + tests.
- T17: Reader layout + bloques + modos automático/manual con snap + persistencia de progreso.
- T18: Focus Playhead (spans por palabra, 3 estados, pausa legible, reduced-motion, modo estático).
- T19: Stories bar + scrubbing + TOC + controles + atajos/gestos.
- T20: Bloques de imagen como clips + Ken Burns sutil (reduced-motion aware).
- T21: TTS opcional con alineación y fallback a temporizador.

**Checkpoint F4:** reanudación exacta; velocidad/PPM sin perder posición; pausa legible; snap por bloque; reduced-motion y cinética off; TTS con fallback.

### Fase 5 — Sincronización local-first
- T22: SyncEnvelope + merge por registro + tombstones + backup/export/import (funciones puras + tests).
- T23: Abstracción `SyncProvider` + conector WebDAV.
- T24: Conector carpeta local (File System Access API / Capacitor) + UI de ajustes + triggers con debounce.

**Checkpoint F5:** escenario A/B conserva progreso y citas; tombstone propaga; fallo de red no corrompe estado local.

### Fase 6 — Índice fiel, biblioteca e importación ampliada (en curso)
- T26: Modelo `TocEntry` jerárquico + `ensureToc`/resolución a clips (puro, con tests).
- T27: EPUB: NCX/nav anidados con anclas mapeadas a bloques (tests de fixture).
- T28: PDF: `getOutline()` + páginas de inicio de sección → TOC jerárquico (tests).
- T29: Índice jerárquico colapsable + ruta activa (breadcrumb) en el reproductor.
- T30: Biblioteca siempre visible: búsqueda/tabs en URL, dropzone solo en vacío, menú “Añadir”.
- T31: Carpetas y raíces guardadas: escaneo de EPUB/PDF e importación selectiva.

**Checkpoint F6:** `npm run typecheck`, `npm test`, `npm run build` en verde; TOC y biblioteca verificados.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| EPUB con markup heterogéneo | Medio | Normalizador tolerante + fallback a texto plano por capítulo + fixtures reales. |
| PDF complejo/columnas | Medio | Heurísticas conservadoras, rechazo cuando la densidad de texto sea baja. |
| Cuota IndexedDB/blobs grandes | Medio | Estimar antes de guardar, avisos, limpieza de assets huérfanos. |
| Variabilidad de `speechSynthesis` | Medio | TTS opcional; el reloj por temporizador es la fuente de verdad. |
| Capacidades por plataforma | Medio | Feature detection + abstracción por provider + export/import manual. |
| Desfase de relojes entre dispositivos | Bajo | `updatedAt` UTC + desempate lexicográfico por `deviceId` + merge por entidad. |
| Jank de cinética-word-by-word | Medio | Spans con actualización de clases/atributos del índice activo y vecinos; transiciones CSS; segmentar bloques largos. |

## Preguntas abiertas

- Ninguna que bloquee Fase 1. El alcance de ejecución de esta sesión se confirma al entregar el checkpoint de la Fase 1.
