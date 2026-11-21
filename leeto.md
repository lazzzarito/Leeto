# Leeto — Especificación de Producto y Arquitectura Técnica

> **Estado:** borrador técnico mejorado (v2.1)  
> **Tipo:** lector dinámico local-first, multiplataforma y orientado a la privacidad  
> **Última revisión:** 2026-04-11  
> **Nota de revisión:** definido el modelo de cinética **Focus Playhead** (experiencia tipo Reel/TikTok, sin abusar de animaciones)

---

## 1. Visión y propuesta de valor

**Leeto** es una aplicación de lectura dinámica (*kinetic typography*) con formato vertical tipo feed (inspirado en Reels/TikTok) que funciona **100% en el cliente**: sin servidores propios, sin cuentas obligatorias, sin telemetría y sin publicidad.

La idea central es transformar libros en una experiencia de consumo por **bloques** (texto e imágenes) que pueden:

- **reproducirse automáticamente** al ritmo configurado por el usuario (PPM / velocidad), como un clip,
- **guiar el foco con cinética "Focus Playhead"**: texto completo visible, con el tramo activo destacado y el resto atenuado/asentado para sostener el ritmo sin perder contexto,
- **consumirse manualmente** con scroll/swipe y **snap por bloque**, como un feed,
- **leerse con voz local** (TTS del sistema/navegador) cuando el usuario lo active, sincronizado con el mismo playhead.

Para no perder la portabilidad entre dispositivos sin montar backend, Leeto ofrece **sincronización opcional** usando la propia infraestructura del usuario (WebDAV, carpeta local sincronizada o, más adelante, Google Drive/OneDrive). La app guarda metadatos de progreso y citas en archivos de sincronización y realiza un **merge por registro** (no un reemplazo global) para evitar pérdidas.

### Principios de producto

1. **Local-first:** la app es útil sin red; la nube es opcional.
2. **Privacidad por defecto:** los libros y el progreso permanecen en el dispositivo y, si se activa, en la nube del usuario.
3. **Propiedad del usuario:** formatos abiertos de sync, exportación y sin dependencia de servicios de Leeto.
4. **Fluidez:** parseo y operaciones pesadas fuera del hilo principal (Web Workers).
5. **Accesibilidad:** controles por teclado, gestos, tamaños tipográficos, contraste y respeto a `prefers-reduced-motion`.

---

## 2. Alcance v1 y fuera de alcance

### Incluido en v1

- Importación local de **EPUB** y **PDF con texto seleccionable**.
- Parseo a un formato interno normalizado (Leeto Format) y almacenamiento en IndexedDB.
- Biblioteca con vistas: Todos, Autores, Sagas/Series, Favoritos/Citas.
- Búsqueda instantánea y edición básica de metadatos.
- Reproductor vertical tipo feed (snap por bloque) con modo automático (PPM), modo manual, cinética **Focus Playhead** (configurable), barra de progreso tipo stories, scrubbing, temas de lectura, atajos y gestos.
- Persistencia de progreso y reanudación exacta por bloque.
- Guardado de citas/favoritos.
- Sincronización opcional v1: **WebDAV** y **carpeta local** (según capacidades de la plataforma), con merge por registro.
- Exportación/importación manual del estado de sync como respaldo.

### Fuera de alcance en v1 (planificado o descartado)

- **OCR para PDF escaneado/imágenes:** se rechaza en v1 con mensaje claro; posible exploración futura (`tesseract.js`, costoso en cliente).
- Backend propio, cuentas de Leeto, analytics remoto o anuncios.
- Colaboración multiusuario/compartición social.
- Edición del contenido del libro.
- DRM o desbloqueo de libros protegidos.
- Sincronización de blobs completos de libros como requisito inicial (se prioriza progreso/citas; sync de archivos de biblioteca es opcional y explícita).

### Suposiciones

- El usuario dispone de archivos EPUB/PDF que puede importar legalmente.
- En móvil nativo, Capacitor proveerá acceso a archivos/almacenamiento según permisos del sistema.
- En web/PWA, algunas capacidades (p. ej. carpeta local persistente) dependen del navegador (File System Access API, principalmente Chromium).

---

## 3. Decisiones de arquitectura

| # | Decisión | Elección | Rationale / implicaciones |
|---|---|---|---|
| D1 | Framework | **Vite + React + TypeScript + react-router-dom** | Ajuste natural para SPA/PWA y Capacitor; evita complejidad SSR. Rutas cliente (`/`, `/read/:id`). |
| D2 | Multiplataforma | **Capacitor** (Android/iOS) + **PWA** (web/escritorio) | Un solo codebase UI; plugins nativos para filesystem/TTS cuando haga falta. |
| D3 | UI | **Tailwind CSS (v3) + componentes estilo shadcn/ui + lucide-react** | Consistencia visual, tokens CSS por tema, accesibilidad base en componentes. |
| D4 | Almacenamiento local | **IndexedDB vía Dexie.js** | Persistencia estructurada de libros, assets (blobs), progreso y citas offline. |
| D5 | Parseo | **Web Workers** dedicados | No bloquear UI. EPUB: `jszip` + parseo XML (p. ej. `fast-xml-parser`) + WebCrypto; PDF: `pdfjs-dist` con su worker configurado explícitamente. |
| D6 | Identidad de libro | **`contentHash` (SHA-256 del archivo fuente)** como identidad de contenido | Deduplicación y clave de sync estable; metadatos editables se guardan aparte. Reimportar una edición distinta crea otro registro. |
| D7 | Assets binarios | **Blobs persistidos en tabla `assets`**; object URLs efímeras en render | `blob:` URLs no sobreviven recargas; se revocan al desmontar. |
| D8 | Temas | **Presets de lectura autocontenidos** (`paper`, `amber`, `sepia`, `eink`, `oled`) | Cada preset define todos los tokens; evita herencias rotas entre modo y acento. Se respeta `prefers-color-scheme` solo para elegir preset inicial si el usuario no ha elegido. |
| D9 | Motor de reproducción | **Máquina de estados + reloj `requestAnimationFrame`** | Un único reloj; TTS y temporizador no compiten. Velocidad como multiplicador. Fallback a temporizador si TTS falla. |
| D10 | Sync v1 | **WebDAV + carpeta local** primero; **Google Drive/OneDrive** después | Menor fricción que OAuth en v1. Merge por registro con `updatedAt` y `deviceId`. |
| D11 | Seguridad de sync | **Sin servidor propio**; cifrado E2E con frase de paso como **opción** (no promesa implícita por defecto) | Honestidad de amenaza: por defecto los archivos viven en la nube del usuario; cifrado opcional AES-GCM con derivación de clave y advertencia de recuperación. |
| D12 | PDF escaneado | **No soportado en v1** | Evitar promesa de OCR pesado/impreciso; detectar y comunicar claramente. |

---

## 4. Diseño visual y sistema de tematización

### 4.1 Dirección visual

Interfaz minimalista inspirada en **shadcn/ui**: bordes sutiles, tipografía nítida, alto contraste, superficies limpias y jerarquía clara.

- **UI:** sans-serif geométrica (`Inter` o `Geist`).
- **Lectura:** serif editorial de alta legibilidad (`Merriweather`, `Lora` o `Newsreader`).
- **Iconografía:** `lucide-react`.
- **Movimiento:** `framer-motion` con moderación y propósito funcional: snap/transiciones breves entre bloques (≈180–260 ms), Ken Burns muy sutil en imágenes y avance fluido del playhead. **Sin animaciones decorativas** (sin rebotes, escalados o colores arbitrarios por palabra). Respetar `prefers-reduced-motion: reduce`: desactivar transiciones continuas/Ken Burns y sustituir la cinética por un marcador estático de posición (o lectura estática), manteniendo la legibilidad.

### 4.2 Temas de lectura (presets completos)

Cada tema define **todos** los tokens necesarios (no heredar parcialmente de otro modo).

| ID | Nombre | Intención | Base |
|---|---|---|---|
| `paper` | Papel | Lectura diurna neutra | Claro |
| `amber` | Editorial Amber | Lectura cálida/editorial | Claro |
| `sepia` | Sepia Clásico | Lectura prolongada, tono libro antiguo | Claro cálido |
| `eink` | Tinta E-Ink | Alto contraste, bajo ruido visual | Claro/gris |
| `oled` | Noche OLED | Lectura nocturna, negro absoluto | Oscuro |

- **Preferencia del sistema:** solo sugiere preset inicial (`paper` o `oled`) si no hay elección guardada.
- **Persistencia:** tema seleccionado en configuración local (Dexie o almacenamiento de settings) y aplicado vía `data-reading-theme` en el root.

### 4.3 Tokens CSS (referencia)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root,
  [data-reading-theme="paper"] {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 38 92% 50%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 38 92% 50%;
    --radius: 0.75rem;
    --reader-bg: 0 0% 100%;
    --reader-fg: 240 10% 10%;
    --reader-highlight: 38 92% 50%;
  }

  [data-reading-theme="amber"] {
    --background: 42 33% 97%;
    --foreground: 30 15% 12%;
    --card: 42 30% 99%;
    --card-foreground: 30 15% 12%;
    --popover: 42 30% 99%;
    --popover-foreground: 30 15% 12%;
    --primary: 32 95% 44%; /* #D97706 aprox */
    --primary-foreground: 0 0% 98%;
    --secondary: 38 30% 92%;
    --secondary-foreground: 30 15% 15%;
    --muted: 38 25% 92%;
    --muted-foreground: 30 10% 40%;
    --accent: 38 40% 90%;
    --accent-foreground: 30 15% 15%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 35 20% 84%;
    --input: 35 20% 84%;
    --ring: 32 95% 44%;
    --radius: 0.75rem;
    --reader-bg: 42 33% 97%;
    --reader-fg: 30 18% 14%;
    --reader-highlight: 32 95% 44%;
  }

  [data-reading-theme="sepia"] {
    --background: 37 38% 92%;
    --foreground: 25 20% 20%;
    --card: 37 35% 89%;
    --card-foreground: 25 20% 20%;
    --popover: 37 35% 89%;
    --popover-foreground: 25 20% 20%;
    --primary: 24 70% 40%;
    --primary-foreground: 40 30% 96%;
    --secondary: 35 25% 84%;
    --secondary-foreground: 25 20% 20%;
    --muted: 35 22% 85%;
    --muted-foreground: 25 15% 38%;
    --accent: 35 28% 82%;
    --accent-foreground: 25 20% 20%;
    --destructive: 0 70% 45%;
    --destructive-foreground: 0 0% 98%;
    --border: 30 20% 80%;
    --input: 30 20% 80%;
    --ring: 24 70% 40%;
    --radius: 0.75rem;
    --reader-bg: 37 38% 92%;
    --reader-fg: 25 22% 18%;
    --reader-highlight: 24 70% 40%;
  }

  [data-reading-theme="eink"] {
    --background: 0 0% 94%;
    --foreground: 0 0% 10%;
    --card: 0 0% 97%;
    --card-foreground: 0 0% 10%;
    --popover: 0 0% 97%;
    --popover-foreground: 0 0% 10%;
    --primary: 0 0% 18%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 88%;
    --secondary-foreground: 0 0% 12%;
    --muted: 0 0% 88%;
    --muted-foreground: 0 0% 32%;
    --accent: 0 0% 86%;
    --accent-foreground: 0 0% 12%;
    --destructive: 0 65% 40%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 75%;
    --input: 0 0% 75%;
    --ring: 0 0% 18%;
    --radius: 0.75rem;
    --reader-bg: 0 0% 94%;
    --reader-fg: 0 0% 8%;
    --reader-highlight: 0 0% 20%;
  }

  [data-reading-theme="oled"] {
    --background: 0 0% 0%;
    --foreground: 0 0% 96%;
    --card: 0 0% 4%;
    --card-foreground: 0 0% 96%;
    --popover: 0 0% 4%;
    --popover-foreground: 0 0% 96%;
    --primary: 37 91% 55%;
    --primary-foreground: 0 0% 6%;
    --secondary: 0 0% 10%;
    --secondary-foreground: 0 0% 96%;
    --muted: 0 0% 10%;
    --muted-foreground: 0 0% 64%;
    --accent: 0 0% 12%;
    --accent-foreground: 0 0% 96%;
    --destructive: 0 72% 50%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14%;
    --input: 0 0% 14%;
    --ring: 37 91% 55%;
    --radius: 0.75rem;
    --reader-bg: 0 0% 0%;
    --reader-fg: 0 0% 94%;
    --reader-highlight: 37 91% 55%;
  }
}
```

> Nota: los valores son de referencia; ajustar en implementación para contraste WCAG AA en texto de lectura.

### 4.4 Adaptabilidad y responsive

- **Móvil (PWA / Capacitor):** reproductor a pantalla completa, orientación vertical prioritaria, gestos (swipe vertical, toque central pausa/reanuda, doble toque guarda cita, pulsación larga para opciones).
- **Escritorio / tablet:** reproductor en contenedor central con ancho máximo legible; paneles laterales retráctiles (TOC, ajustes, citas) sin romper la inmersión.
- **Atajos de teclado (escritorio):**
  - `Espacio`: pausa/reanuda
  - `↑` / `↓`: bloque anterior/siguiente
  - `←` / `→`: capítulo anterior/siguiente (o salto configurable)
  - `F`: favorito/cita del bloque actual
  - `T`: abrir selector de tema
  - `Esc`: cerrar paneles/salir de overlays
- **Safe areas:** respetar `env(safe-area-inset-*)` en móvil.

---

## 5. Arquitectura funcional

### 5.1 Módulo A — Ingesta y normalización (client-side)

**Objetivo:** convertir `.epub` / `.pdf` en un modelo interno uniforme y persistible.

**Flujo general**
1. Usuario arrastra/selecciona archivo(s) (`Dropzone`).
2. Se calcula `contentHash` (SHA-256, WebCrypto) y se comprueba duplicado en DB.
3. Se delega el parseo a un **Web Worker** específico por formato.
4. El worker emite progreso (`parsing`, `extracting-assets`, `normalizing`) para UI.
5. Resultado: metadatos + capítulos + bloques + assets binarios.
6. Se persisten `books`, `chapters/blocks` (embebidos o normalizados según diseño Dexie) y `assets` en una transacción.
7. Se genera portada (asset) y se actualiza la biblioteca.

**EPUB**
- Lectura del contenedor ZIP en worker (`jszip`).
- Parseo de OPF/NCX/nav con parser XML sin DOM.
- Extracción de metadatos: título, autor, idioma, portada, identificadores; **series/saga y volumen** desde `belongs-to-collection` / `calibre:series` / `group-position` cuando existan (leyendo OPF crudo si la librería no los expone).
- Normalización de contenido HTML/XHTML a bloques de texto limpios (preservar énfasis básico si se desea en futuro; v1: texto plano legible + saltos razonables).
- Extracción de imágenes referenciadas como assets binarios con mime type.

**PDF (solo texto seleccionable en v1)**
- Uso de `pdfjs-dist` con `workerSrc` configurado explícitamente (worker propio de PDF.js, no anidado dentro de otro worker de app salvo diseño probado).
- Extracción de texto por página con posiciones para heurísticas: eliminar cabeceras/pies repetidos, unir cortes de línea y detectar párrafos.
- Extracción de imágenes incrustadas cuando sea viable y útil.
- **Detección de PDF escaneado/sin capa de texto:** si la densidad de texto extraíble es insuficiente, abortar importación con mensaje: “Este PDF parece escaneado; la versión actual no incluye OCR”.

**Formato interno (Leeto Format, lógico)**
- No depende de `blob:` URLs persistidas.
- Bloques de imagen referencian `assetId`.
- Duraciones **derivadas en runtime** a partir de `wordCount`, PPM y velocidad (con duración fija configurable para imágenes).

```json
{
  "id": "sha256:...",
  "title": "Título",
  "author": "Autor",
  "language": "es",
  "saga": "Nombre de saga",
  "volumeNumber": 1,
  "coverAssetId": "asset_cover_...",
  "chapters": [
    {
      "index": 0,
      "title": "Capítulo I",
      "blocks": [
        { "id": "b_001", "type": "text", "content": "Párrafo...", "wordCount": 30 },
        { "id": "b_002", "type": "image", "assetId": "asset_img_...", "caption": "Ilustración" }
      ]
    }
  ]
}
```

### 5.2 Módulo B — Biblioteca inteligente

**Vistas (Tabs)**
- **Todos:** grid/lista responsiva, portada, título, autor, barra/progreso %, tiempo restante estimado.
- **Autores:** agrupación por autor con recuento.
- **Sagas/Series:** agrupación por saga, orden por `volumeNumber` (nulos al final), detección automática + edición manual.
- **Favoritos/Citas:** listado de citas guardadas con acceso al contexto (libro/capítulo/bloque).

**Búsqueda y filtrado**
- Barra tipo `Command` para filtrar en tiempo real por título, autor, saga y contenido de citas (según índice disponible).

**Gestión**
- `DropdownMenu` por libro: editar metadatos (título, autor, saga, volumen, portada), reubicar en saga, eliminar.
- Eliminación: borra libro, progreso asociado, citas asociadas y assets huérfanos en transacción.
- Importación múltiple con cola y reporte de errores por archivo.

### 5.3 Módulo C — Reproductor dinámico (`LeetoPlayer`)

**Principio de experiencia:** cada bloque se consume como un **clip** en un feed vertical (lenguaje de Reel/TikTok), con ritmo guiado en el tiempo y controles mínimos. La cinética es funcional (comunica progreso/foco), no decorativa.

**Modos**
- **Automático (timer-driven):** avanza por bloques según duración calculada `f(wordCount, wpm, speed)`; imágenes usan duración base configurable (p. ej. 4–8 s) ajustable por velocidad.
- **Manual (scroll/swipe):** navegación por gesto/scroll con **snap por bloque** (`scroll-snap`), de modo que cada interacción aterrice en un bloque completo.
- **Híbrido:** cualquier interacción manual (swipe, scroll, seek) pausa o toma el control; el usuario puede reanudar y el playhead continúa desde la posición/bloque activo.

**Modelo de cinética de lectura: "Focus Playhead" (decisión de UX)**

*Nivel feed/bloque (el bloque como unidad):*
- **Un bloque, un frame:** en modo automático el bloque activo ocupa el área de lectura (centrado, ancho legible) sin desplazamiento continuo de página mientras se reproduce.
- **Transiciones entre bloques:** avance con transición corta y decisiva (≈180–260 ms, easing suave), preferentemente *slide* vertical hacia arriba o *cut/fade* breve. Evitar transiciones lentas tipo libro.
- **Entrada de bloque:** el bloque entra como unidad (fade/translate sutil del conjunto) y queda en estado listo; **no** se anima la aparición palabra por palabra al entrar.
- **Imágenes:** se presentan como clips a pantalla completa, con duración propia y **Ken Burns muy sutil** opcional (zoom/paneo lento), desactivable con reducción de movimiento.

*Nivel intra-bloque (texto):*
- **Texto completo visible** durante toda la reproducción del bloque, con tres estados de legibilidad que evolucionan en el tiempo:
  - **Próximo (futuro):** visible pero atenuado (baja opacidad/contraste) para dar contexto sin competir por la atención.
  - **Activo (playhead):** máxima legibilidad y énfasis **sutil** en la palabra actual o micro-ventana (1–3 palabras): contraste pleno y acento del tema (p. ej. color/peso/subrayado o fondo suave), sin rebotes ni efectos llamativos.
  - **Leído (pasado):** regresa a contraste de lectura cómodo y estable, fácilmente releíble.
- **Avance del playhead:** temporización a nivel de palabra (proporcional a `wordCount`, PPM y velocidad) con actualización de estado fluida (transiciones breves ≈80–120 ms en color/opacidad) para evitar parpadeo. El objetivo es un cabezal de lectura rítmico y continuo.
- **Pausa:** congelación inmediata del playhead. Al pausar, el bloque pasa a **contraste uniforme y legible** (se levanta la atenuación del futuro) conservando un marcador discreto de la posición, para facilitar comprensión y relectura; al reanudar se restablece el foco progresivo.
- **Bloques largos:** párrafos muy extensos pueden segmentarse internamente en sub-bloques de reproducción para mantener ritmo, legibilidad y rendimiento, sin alterar el contenido original.

*Disciplina visual (sin abusar):* un único eje de motion con significado (progreso/tiempo); sin escalados, rebotes, rotaciones ni colores arbitrarios por palabra. La cinética de texto es **activable** y debe existir un modo de **lectura estática**.

**Motor de reproducción (estado único)**
- Máquina de estados: `idle | loading | playing | paused | seeking | ended | error`.
- Reloj principal con `requestAnimationFrame` y acumulador de tiempo; **una sola fuente de verdad** para bloque activo, posición del playhead y offset.
- **TTS opcional:** driver alternativo que intenta alinear el playhead con eventos de síntesis; ante fallos/imprecisiones (`onboundary` inconsistente, límites de plataforma) se usa **fallback a temporizador** manteniendo el mismo estado visual y de progreso.
- Scrub/seek y cambios de velocidad/PPM recalculan la posición/duración restante desde el playhead actual sin reiniciar el bloque.
- Persistir progreso en `pause`, `visibilitychange`, `pagehide`, cambio de bloque y cierre controlado (con debounce).

**UI del reproductor**
- Barra superior segmentada tipo Stories (por capítulo o por tramo configurable) y progreso fino del bloque.
- Área central de lectura/imagen con tipografía de lectura; controles y chrome se atenúan/ocultan durante la reproducción y reaparecen con interacción.
- `Slider` de scrubbing por capítulo/libro (según granularidad definida).
- Controles: play/pausa, velocidad (`0.5x`–`2.5x`), PPM, tamaño de letra, interlineado, tema, TOC (`Drawer`), cinética on/off (e intensidad), TTS on/off y voz (si disponible).
- Imagen: ajuste contain/cover según contexto, con Ken Burns sutil opcional (desactivable con reducción de movimiento).

**Rendimiento y accesibilidad de la cinética**
- Respetar `prefers-reduced-motion: reduce`: desactivar transiciones continuas, Ken Burns y movimiento del playhead; usar cortes/fades mínimos y/o **marcador estático** de posición (o lectura estática).
- Garantizar contraste suficiente de los estados próximo/activo/leído en todos los temas (no depender solo del color).
- Implementación eficiente: representar texto como spans por palabra/micro-frase y actualizar solo el estado del índice activo/vecinos (clases/atributos) con transiciones CSS; evitar re-render del bloque completo en cada tick. Objetivo: fluidez en móvil de gama media.

**Citas y favoritos**
- Doble toque (móvil) o acción dedicada/atajo crea `SavedQuote` con referencia exacta (`bookId`, `chapterIndex`, `blockId`, excerpt).

### 5.4 Módulo D — Sincronización local-first (opcional)

**Objetivo:** mantener progreso y citas coherentes entre dispositivos del usuario sin servidor de Leeto.

**Conectores (prioridad)**
1. **WebDAV** (compatible con Nextcloud, servidores propios, etc.).
2. **Carpeta local / carpeta sincronizada** (Syncthing, Drive Desktop, etc.) según plataforma:
   - Web/PWA: File System Access API donde esté disponible.
   - Nativo (Capacitor): plugins de filesystem/document picker con permisos del SO.
3. **Google Drive** (posterior): OAuth PKCE, tokens seguros, alcance mínimo.
4. **OneDrive** (posterior): similar a Drive.

**Estructura remota (carpeta `LeetoSync/`)**
- `leeto_sync.json`: metadatos de sync (progreso, citas, referencias de biblioteca, dispositivos).
- `leeto_sync.lock` (opcional, best-effort) para reducir escrituras concurrentes.
- `books/` (opcional, fase posterior): copias de archivos fuente para replicar biblioteca (opt-in explícito por tamaño/privacidad).

**Estrategia de merge (por registro, no global)**
- `progress[bookId]`: gana el registro con mayor `updatedAt`; empate → desempate determinista por `deviceId`.
- `quotes[id]`: unión por `id`; gana el registro con mayor `updatedAt` (incluye **tombstones** con `deletedAt` para propagar borrados).
- `libraryRefs`: unión por `id/contentHash` con metadatos de última actualización.
- `devices[deviceId] = lastSeenAt` para diagnóstico.
- Escrituras **atómicas** cuando el proveedor lo permita (escribir temporal + renombrar); si no, escritura con versión y relectura de verificación.
- Protección contra bucles: ignorar eventos originados por el propio `deviceId`/hash de escritura reciente.

**Activadores de sync**
- Manual (botón “Sincronizar ahora”).
- Al abrir la app (si hay red/acceso).
- Al pausar/cerrar lector o guardar cita (con debounce y backoff en error).

**Conflictos y recuperación**
- Nunca sobrescribir todo el archivo por ser “más nuevo” a nivel global.
- Mantener copia local de último estado aplicado y backup rotativo (`leeto_sync.backup.json`) antes de aplicar merge remoto.
- Exportación/importación manual del JSON para recuperación.

### 5.5 Ajustes, accesibilidad y preferencias

- Tema de lectura, tamaño de fuente, familia serif/sans para lectura, interlineado, márgenes.
- Velocidad/PPM por defecto y por libro (opcional).
- Cinética de lectura: activar/desactivar **Focus Playhead** (modo estático), intensidad de atenuación del texto futuro y opciones de énfasis, siempre con alternativa legible en pausa.
- TTS: voz, idioma, velocidad, activación explícita.
- Reducción de movimiento: seguir sistema y permitir override (al activarse, desactiva animaciones continuas/Ken Burns y usa marcador estático o lectura estática).
- Gestión de almacenamiento: ver tamaño usado, borrar cachés/assets huérfanos, eliminar libros.

---

## 6. Modelo de datos y persistencia (IndexedDB / Dexie)

### 6.1 Tipos TypeScript de referencia

```typescript
// src/types/index.ts

export type ReadingTheme = 'paper' | 'amber' | 'sepia' | 'eink' | 'oled';
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'seeking' | 'ended' | 'error';

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
  wordCount: number;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  assetId: string;
  caption?: string;
  alt?: string;
}

export type LeetoBlock = TextBlock | ImageBlock;

export interface LeetoChapter {
  index: number; // 0-based
  title: string;
  blocks: LeetoBlock[];
}

export interface LeetoBook {
  id: string; // contentHash (sha256 hex o prefijado)
  contentHash: string;
  title: string;
  author: string;
  language?: string;
  coverAssetId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string; // application/epub+zip, application/pdf
  saga?: string;
  volumeNumber?: number;
  chapters: LeetoChapter[];
  totalWordCount: number;
  importedAt: number; // epoch ms
  updatedAt: number;  // epoch ms (metadatos)
}

export interface StoredAsset {
  id: string;
  bookId: string;
  kind: 'cover' | 'image' | 'other';
  mimeType: string;
  blob: Blob;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  blockId: string;
  percentage: number; // 0..100
  updatedAt: number;  // epoch ms UTC
  deviceId: string;
}

export interface SavedQuote {
  id: string; // uuid
  bookId: string;
  chapterIndex: number;
  blockId: string;
  excerpt: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // tombstone para sync
}

export interface AppSettings {
  id: 'singleton';
  deviceId: string;
  readingTheme: ReadingTheme;
  fontSize: number;
  lineHeight: number;
  wpm: number;
  playbackSpeed: number;
  kineticTextEnabled: boolean; // Focus Playhead on/off (modo estático si false)
  focusDimIntensity: number; // 0..1, atenuación del texto futuro
  ttsEnabled: boolean;
  ttsVoiceURI?: string;
  reducedMotion?: 'system' | 'on' | 'off';
  syncEnabled: boolean;
  syncProvider?: 'webdav' | 'local-folder' | 'gdrive' | 'onedrive';
}

export interface SyncEnvelope {
  schemaVersion: 1;
  updatedAt: number;
  originDeviceId: string;
  devices: Record<string, number>; // deviceId -> lastSeenAt
  progress: Record<string, ReadingProgress>; // key: bookId
  quotes: Record<string, SavedQuote>; // key: quoteId
  libraryRefs?: Record<string, { id: string; fileName: string; fileSize: number; updatedAt: number }>;
}
```

### 6.2 Tablas Dexie (propuesta)

- `books` — clave primaria `id` (contentHash), índices por `title`, `author`, `saga`, `importedAt`, `updatedAt`.
- `assets` — `id`, índice por `bookId`, `kind`.
- `progress` — clave primaria `bookId` (un progreso activo por libro y dispositivo local; el merge remoto alimenta este estado).
- `quotes` — `id`, índices por `bookId`, `updatedAt`, `deletedAt`.
- `settings` — registro singleton.
- (Opcional) `importJobs` / `syncState` para colas y diagnósticos.

### 6.3 Consideraciones de almacenamiento

- Guardar blobs de assets y, si se decide, el archivo fuente original solo cuando aporte valor (re-export/re-sync). Evaluar cuota de almacenamiento del navegador.
- Proveer utilidades para recalcular espacio usado y limpiar huérfanos.
- Revocar `URL.createObjectURL` en cleanup de componentes.

---

## 7. Formato de sincronización y resolución de conflictos

### 7.1 Archivo `leeto_sync.json` (ejemplo)

```json
{
  "schemaVersion": 1,
  "updatedAt": 1762819200000,
  "originDeviceId": "dev_A",
  "devices": {
    "dev_A": 1762819200000,
    "dev_B": 1762815600000
  },
  "progress": {
    "sha256:abc...": {
      "bookId": "sha256:abc...",
      "chapterIndex": 3,
      "blockId": "b_042",
      "percentage": 37.5,
      "updatedAt": 1762819200000,
      "deviceId": "dev_A"
    }
  },
  "quotes": {
    "q_123": {
      "id": "q_123",
      "bookId": "sha256:abc...",
      "chapterIndex": 3,
      "blockId": "b_040",
      "excerpt": "Texto de la cita...",
      "createdAt": 1762810000000,
      "updatedAt": 1762810000000
    }
  },
  "libraryRefs": {
    "sha256:abc...": {
      "id": "sha256:abc...",
      "fileName": "libro.epub",
      "fileSize": 1048576,
      "updatedAt": 1762800000000
    }
  }
}
```

### 7.2 Reglas de merge

1. Cargar remoto y local.
2. `devices`: `max` por `deviceId`.
3. `progress`: por `bookId`, elegir registro con `updatedAt` mayor; si empate, mayor `deviceId` (orden lexicográfico) para determinismo.
4. `quotes`: por `id`, elegir registro con `updatedAt` mayor; respetar `deletedAt` como estado vigente si es el más reciente.
5. `libraryRefs`: unión por id con `updatedAt` mayor.
6. Persistir resultado localmente y escribir remoto si hay cambios efectivos (hash/`updatedAt` distinto).
7. Guardar `backup` previo antes de sobrescribir remoto.

### 7.3 Limitaciones conocidas

- Sin reloj de servidor: se depende de relojes de dispositivo; `updatedAt` en UTC y desempate determinista mitigan, pero no eliminan, desviaciones extremas.
- Concurrencia real simultánea: mitigada con merge por registro + backups; no se garantiza locking fuerte en todos los proveedores.
- Sync de archivos grandes (`books/`) es costoso y opcional; v1 prioriza metadatos ligeros.

---

## 8. Seguridad y privacidad

- **Sin backend propio:** Leeto no recibe libros, progreso ni citas en servidores del proyecto.
- **Almacenamiento local:** datos en IndexedDB, aislados por origen del navegador/app; sujetos a políticas de almacenamiento del SO/navegador.
- **Sync:** los archivos se almacenan en la cuenta/carpeta elegida por el usuario (WebDAV, carpeta local sincronizada, Drive, etc.).
- **Cifrado en tránsito:** dependiente del proveedor (HTTPS en WebDAV/Drive/OneDrive).
- **Cifrado E2E opcional (diseño previsto):** cifrar `leeto_sync.json` con AES-GCM y clave derivada de frase de paso (PBKDF2/Argon2id según disponibilidad). Implicaciones:
  - si el usuario pierde la frase, los datos cifrados no son recuperables;
  - los nombres/rutas de archivos fuera del JSON pueden seguir siendo visibles según proveedor;
  - requiere UX clara de activación, verificación y cambio de frase.
- **Permisos mínimos:** solicitar solo los alcances/rutas necesarios para la carpeta de sync.
- **Datos sensibles en logs:** evitar registrar contenido de libros, citas o tokens.

> **Nota:** hasta implementar cifrado E2E, la especificación no debe afirmar que el contenido sincronizado esté "cifrado" por Leeto; debe afirmar que reside en la infraestructura elegida por el usuario.

---

## 9. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| App | Vite + React 18+ + TypeScript | SPA, build estático, HMR |
| Rutas | `react-router-dom` | `/`, `/read/:id`, rutas de ajustes |
| UI | Tailwind CSS v3, shadcn/ui, Radix UI (vía shadcn), `lucide-react` | Componentes accesibles y tematizables |
| Animación | `framer-motion` | Transiciones y efectos opcionales; respetar reduced motion |
| Estado/UI async | React state + hooks; considerar Zustand/TanStack Query solo si simplifica | Evitar sobreingeniería en v1 |
| Persistencia | `dexie`, `dexie-react-hooks` (opcional) | IndexedDB tipado y reactivo |
| EPUB | `jszip` + parser XML (`fast-xml-parser` o equivalente) | En Web Worker; sin dependencia dura de DOM |
| PDF | `pdfjs-dist` | Worker de PDF.js configurado; extracción de texto/posiciones |
| Hashing | WebCrypto (`SubtleCrypto.digest`) | SHA-256 en worker |
| TTS | Web Speech API (`speechSynthesis`) / plugin Capacitor TTS según plataforma | Driver opcional con fallback a temporizador |
| Sync | `fetch` WebDAV, File System Access API, plugins Capacitor; SDKs OAuth en fases posteriores | Abstracción por proveedor (`SyncProvider`) |
| Nativo | Capacitor | Android/iOS, plugins filesystem/share/tts según necesidad |
| Calidad | ESLint, Prettier, TypeScript strict, Vitest + Testing Library, Playwright (e2e selectivo) | Validación por fase |

---

## 10. Estructura del proyecto

```text
leeto/
├─ capacitor.config.ts
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tailwind.config.ts
├─ postcss.config.js
├─ tsconfig.json
├─ components.json              # configuración shadcn/ui
├─ public/
│  └─ icons/                    # PWA / app icons
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ router.tsx                # definición de rutas
   ├─ pages/
   │  ├─ LibraryPage.tsx
   │  ├─ ReaderPage.tsx
   │  └─ SettingsPage.tsx
   ├─ components/
   │  ├─ ui/                    # componentes base shadcn
   │  ├─ library/               # grid, cards, tabs, dropzone, dialogs
   │  └─ player/                # LeetoPlayer, controls, stories bar, toc
   ├─ core/
   │  ├─ db/                    # Dexie schema, migraciones, repositorios
   │  ├─ parsers/               # workers y adaptadores EPUB/PDF -> Leeto
   │  │  ├─ epub.worker.ts
   │  │  ├─ pdf.worker.ts
   │  │  └─ normalize.ts
   │  ├─ player/                # máquina de estados, reloj, cálculo de duración
   │  ├─ tts/                   # abstracción TTS y sincronización
   │  └─ sync/                  # providers, merge, serialización, scheduler
   ├─ hooks/                    # hooks de UI/datos (useLibrary, usePlayer...)
   ├─ lib/                      # utilidades (hash, time, cn, ids)
   ├─ styles/
   │  └─ globals.css
   └─ types/
      └─ index.ts
```

---

## 11. Plan de implementación por fases

### Fase 1 — Cimientos (proyecto, UI base, temas, modelo)

**Entregables**
- Proyecto Vite+React+TS configurado con Tailwind v3, shadcn/ui, router, Capacitor (config inicial) y estructura de carpetas.
- Sistema de temas con presets completos y persistencia.
- Tipos base, esquema Dexie inicial y `deviceId` local.

**Criterios de aceptación**
- `dev` y `build` funcionan sin errores.
- La app renderiza biblioteca vacía y ruta de lector (placeholder).
- Cambiar tema persiste tras recarga.
- Estructura tipada alineada con esta especificación.

### Fase 2 — Ingesta y persistencia offline

**Entregables**
- Importación drag & drop y selector de archivos.
- Worker EPUB (2a) con extracción de metadatos, capítulos, imágenes y assets.
- Worker/integración PDF texto (2b) con heurísticas básicas y rechazo de PDF escaneado.
- Persistencia en Dexie (`books`, `assets`, `progress` inicial) y deduplicación por hash.

**Criterios de aceptación**
- Fixtures: EPUB simple, EPUB con imágenes y PDF con texto importan correctamente.
- Tras recargar, portadas e imágenes siguen visibles (blobs persistidos, object URLs recreados).
- PDF sin capa de texto muestra error claro y no corrompe estado.
- Importaciones no bloquean la UI de forma perceptible.

### Fase 3 — Biblioteca inteligente

**Entregables**
- Tabs Todos/Autores/Sagas/Citas, búsqueda tipo Command, tarjetas con progreso y tiempo restante estimado.
- Edición de metadatos y portada, eliminación segura, agrupación y orden de sagas.

**Criterios de aceptación**
- Búsqueda filtra por título/autor/saga en tiempo real.
- Agrupaciones correctas con dataset mixto; sagas ordenadas por volumen.
- Eliminar un libro limpia progreso, citas y assets asociados.

### Fase 4 — Reproductor dinámico

**Entregables (incremental)**
- 4a: reproductor de texto con reloj único, modo automático por PPM y modo manual (snap por bloque), pausa/reanudación, persistencia de progreso y cinética **Focus Playhead** básica (futuro atenuado, activo enfatizado, pasado asentado).
- 4b: barra tipo Stories, scrubbing, TOC, controles de velocidad/tipografía/tema/cinética, atajos y gestos, con transiciones breves entre bloques.
- 4c: bloques de imagen como clips (duración, transición y Ken Burns sutil opcional).
- 4d: TTS opcional alineado al playhead con fallback a temporizador y manejo de permisos/gesto de usuario en móvil.

**Criterios de aceptación**
- Reanuda en el bloque exacto tras recarga/cierre.
- Cambiar velocidad/PPM actualiza duraciones sin perder posición del playhead.
- En pausa, el texto del bloque queda en contraste uniforme y legible con marcador de posición; al reanudar continúa el foco progresivo.
- Las transiciones entre bloques son breves (snap/slide o cut/fade) y la navegación manual mantiene snap por bloque.
- Con `prefers-reduced-motion` no hay animaciones continuas ni Ken Burns; la cinética se sustituye por marcador estático o lectura estática.
- Con cinética desactivada, la lectura es estática sin pérdida de funcionalidad.
- En plataformas donde TTS falle, la reproducción automática sigue funcionando por temporizador.

### Fase 5 — Sincronización local-first

**Entregables**
- Abstracción `SyncProvider` y configuración de sync.
- Conector WebDAV y conector carpeta local (según plataforma), con `leeto_sync.json`, merge por registro, backups y export/import manual.
- (Posterior 5b) conectores Google Drive y OneDrive.

**Criterios de aceptación**
- Escenario multi-dispositivo simulado: A avanza libro 1, B avanza libro 2 y crea cita → tras sync ambos conservan su progreso y la cita no se pierde.
- Borrado de cita (tombstone) se propaga correctamente.
- Fallo de red/proveedor no corrompe estado local; se puede restaurar desde backup/export.

---

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Parseo EPUB heterogéneo (markup inconsistente) | Capítulos/bloques mal formados | Normalizador tolerante, fixtures reales, fallback a texto plano por capítulo |
| PDF complejo (columnas, tablas, headers) | Texto desordenado | Heurísticas conservadoras, ajuste manual futuro, rechazo cuando la calidad sea baja |
| Cuotas de IndexedDB y blobs grandes | Fallos de importación/almacenamiento | Estimar tamaño antes de guardar, avisos, limpieza de assets huérfanos |
| Variabilidad de TTS (`speechSynthesis`) | Desincronización | TTS como driver opcional; reloj temporizador como fuente fiable |
| Diferencias de capacidades por plataforma (FS access, background) | Sync inconsistente | Abstracción por provider, feature detection, export/import manual como red de seguridad |
| Relojes desfasados entre dispositivos | Merge incorrecto en casos límite | `updatedAt` UTC + desempate determinista + merge por entidad (no global) |
| Pérdida de frase de cifrado E2E (si se activa) | Datos irrecuperables | UX de advertencia, verificación de frase, opción de exportar sin cifrar localmente bajo elección del usuario |
| Rendimiento de la cinética palabra a palabra en bloques largos | Caídas de FPS / jank en móviles modestos | Spans por palabra/micro-frase con actualizaciones mínimas (clases/atributos), transiciones CSS, reloj por ticks de índice (no re-render completo) y segmentación de bloques extensos |

---

## 13. Glosario

- **Bloque:** unidad mínima de reproducción (párrafo/texto o imagen).
- **PPM:** palabras por minuto, base para calcular duración de bloques de texto.
- **Local-first:** el estado primario vive en el dispositivo; la sincronización es opcional.
- **Tombstone:** marca de borrado con timestamp para propagar eliminaciones en sincronización.
- **Object URL:** URL temporal (`blob:`) creada en memoria para renderizar un `Blob` persistido; debe revocarse.
- **Sync provider:** adaptador que lee/escribe el sobre de sincronización en un destino (WebDAV, carpeta local, etc.).
- **Playhead (Focus Playhead):** cabezal temporal que marca la posición de lectura activa dentro de un bloque y guía el énfasis progresivo del texto.
- **Snap por bloque:** comportamiento de navegación que ancla la vista a un bloque completo, reforzando la sensación de feed/clip.