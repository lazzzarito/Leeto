# Especificación de Producto y Arquitectura Técnica: **Leeto (Local-First Cross-Platform Reader)**

## 1. Visión General del Proyecto
**Leeto** es una aplicación web y multiplataforma de lectura dinámica y automatizada (*kinetic typography* / formato vertical estilo Reels/TikTok) orientada a la privacidad absoluta. Funciona de manera **100% offline (Client-Side Only)**, sin servidores propios, sin bases de datos remotas y sin publicidad. 

Para resolver el problema de la portabilidad entre dispositivos (móvil, tablet, PC), Leeto implementa un sistema de **sincronización opcional de carpetas en la nube** (Google Drive, OneDrive, WebDAV o carpetas locales) utilizando almacenamiento local cifrado y archivos de metadatos de progreso autogestionados.

---

## 2. Rol del Agente de IA
Actúa como un **Arquitecto de Software Full-Stack Senior y Especialista en Arquitecturas Local-First y Multiplataforma**. Diseña y codifica el sistema completo, robusto, escalable y con tipado estricto para que todo el procesamiento ocurra en el navegador o cliente local.

---

## 3. Diseño Visual y Sistema de Tematización (`shadcn/ui` + Tailwind CSS)
La interfaz debe ser adaptable, impecable en pantallas táctiles y escritorios amplios, inspirada en **shadcn/ui**: minimalista, limpia, con bordes sutiles (`1px`), tipografía nítida y alto contraste.

* **Paleta Base y Temas Dinámicos:**
  * Modo **Claro** (Blanco puro / Papel limpio) y Modo **Oscuro** (Negro OLED absoluto `#000000` y Zinc profundo para lectura nocturna sin fatiga).
  * Color de énfasis inicial: **Ámbar editorial / Terracota cálido** (`#D97706`) que evoque el papel antiguo, la tinta o los marcadores de libros clásicos.
  * Selector de Temas de Lectura: *Editorial Amber (Monocromo + Ámbar Libro)*, *Sepia Clásico*, *Tinta E-Ink (Grises de alto contraste)* y *Noche OLED*.
* **Tipografía:** Fuente *Sans-Serif* geométrica para los controles de la UI (`Inter` o `Geist`) combinada con una fuente *Serif* editorial de alta legibilidad para el contenido de los libros (`Merriweather`, `Lora` o `Newsreader`).
* **Adaptabilidad Multi-Dispositivos (Responsive & Desktop-First):**
  * **En Móvil (Android / iOS / PWA):** Interfaz vertical estricta a pantalla completa (`9:16`) optimizada para gestos (swipe vertical, toque central para pausa, doble toque para guardar citas/favoritos).
  * **En Escritorio (Desktop / Tablet):** El reproductor se despliega como un contenedor central fluido estilo "historia ampliada", flanqueado por paneles laterales retráctiles para la tabla de contenidos, controles avanzados y navegación rápida con atajos de teclado (`Espacio` para pausa, flechas `Arriba/Abajo` para cambiar de bloque, `Izquierda/Derecha` para saltar capítulo).

---

## 4. Arquitectura Funcional Detallada (Core Features)

### Módulo A: Motor de Ingestión Local (Parser In-Browser / Client-Side)
El usuario arrastra archivos `.epub` o `.pdf` directamente a la interfaz. Todo el procesamiento se ejecuta en el cliente (usando Web Workers para no congelar la UI).
1. **Parser de EPUB (`epubjs` o similar adaptado a cliente):** Extrae metadatos (título, autor, portada, serie/saga y volumen), capítulos limpios e imágenes vectoriales/bitmap.
2. **Parser de PDF (`pdfjs-dist`):** Extrae texto, elimina cabeceras/pies de página recurrentes mediante heurísticas de coordenadas, une saltos de línea forzados y extrae imágenes incrustadas.
3. **Generación del Esquema JSON Estándar (Leeto Format):**
```json
{
  "book_id": "sha256_hash_of_file",
  "title": "Título del Libro",
  "author": "Autor",
  "cover_url": "blob:...",
  "file_size": 1048576,
  "saga": "Nombre de la Saga",
  "volume_number": 1,
  "chapters": [
    {
      "chapter_index": 1,
      "chapter_title": "Capítulo I",
      "blocks": [
        {
          "id": "blk_001",
          "type": "text",
          "content": "Párrafo limpio adaptado para visualización...",
          "word_count": 30,
          "estimated_duration_ms": 4500
        },
        {
          "id": "blk_002",
          "type": "image",
          "url": "blob:...",
          "caption": "Ilustración de la escena",
          "estimated_duration_ms": 6000
        }
      ]
    }
  ]
}
```

### Módulo B: Galería y Biblioteca Inteligente (`Tabs` & `Command Palette`)
Antes de entrar al reproductor, el usuario gestiona su colección en una interfaz construida con componentes estilo **shadcn/ui**:
1. **Navegación por Pestañas (`Tabs`):**
   * **Todos los libros:** Grid responsivo con portadas, barras de progreso en la base de cada tarjeta, porcentaje exacto y tiempo restante estimado.
   * **Autores:** Agrupación dinámica por escritor con contador de obras.
   * **Sagas / Series:** Agrupamiento por colección literaria ordenada por número de volumen (`#1`, `#2`...), detectando metadatos estándar (`series` / `belongs-to-collection`) con opción de edición manual mediante un `Dialog`.
   * **Favoritos / Citas:** Colección de fragmentos guardados con doble toque durante la lectura.
2. **Búsqueda Instantánea:** Filtrado en tiempo real por título, autor o saga mediante barra de búsqueda estilo `Command`.
3. **Gestión de Metadatos:** Menú contextual (`DropdownMenu`) por libro para editar datos, cambiar portada o eliminar de `IndexedDB`.

### Módulo C: El Reproductor Dinámico (`LeetoPlayer`)
El núcleo de la experiencia es un reproductor vertical inmersivo:
1. **Modos de Visualización:**
   * **Modo Automático por Tiempos (Timer-driven):** Avanza fluido al ritmo de las Palabras Por Minuto (PPM) configuradas, con efecto de resaltado progresivo de texto (*kinetic typography* / estilo karaoke).
   * **Modo Manual (Scroll o Swipe):** El usuario controla el ritmo vertical como un feed de vídeo.
2. **Integración de Ilustraciones:** Cuando el bloque activo es de tipo `image`, el reproductor despliega la ilustración a pantalla completa (con efecto sutil de zoom o *Ken Burns*) durante su `estimated_duration_ms` antes de continuar con el texto.
3. **Sincronización de Audio (Text-to-Speech Opcional):**
   * Integración con la API nativa del dispositivo/navegador (`window.speechSynthesis` / Capacitor TTS) para lectura de voz local y gratuita sin servidores externos, sincronizando los saltos de bloque con los eventos de la voz.
4. **Controles Multimedia Complejos:**
   * Barra de progreso superior segmentada estilo *Stories*.
   * `Slider` inferior de *Scrubbing* para saltar a cualquier segundo o párrafo del capítulo.
   * Menú flotante lateral (`Lucide Icons`): Control de velocidad (`0.75x` a `2x`), activación de voz, selector de temas, tamaño tipográfico y tabla de contenidos (`Drawer`).

### Módulo D: Sincronización Local-First & Cloud Backup (Sin Servidor Propio)
Dado que la app es 100% offline y no usa base de datos centralizada, la sincronización entre dispositivos (PC, Android, iOS) se realiza mediante un **Sistema de Archivo Remoto Conectado**:
1. **Conector de Proveedor Cloud (Google Drive API / OneDrive / WebDAV / Carpeta Local):**
   * El usuario vincula su propia cuenta de Google Drive mediante autenticación OAuth de cliente o selecciona una carpeta sincronizada localmente (Syncthing, Nextcloud, Google Drive Desktop).
2. **Estructura de Sincronización en la Nube:**
   * Leeto crea una carpeta dedicada (`/LeetoSync/`) en la nube del usuario.
   * Guarda un archivo de metadatos ligero: `leeto_progress.json` y opcionalmente sincroniza los archivos `.epub/.pdf` alojados en esa carpeta para mantener la misma biblioteca en todos los dispositivos.
3. **Resolución de Conflictos (Last-Write-Wins + Timestamp):**
   * Al pausar o cerrar un libro, se actualiza `leeto_progress.json` con el `timestamp` UTC actual, el `book_id`, el índice del capítulo y el ID del bloque exacto.
   * Al abrir Leeto en otro dispositivo, compara los timestamps; si el remoto es más reciente, descarga el estado y posiciona automáticamente la lectura en el bloque exacto.

---

## 5. Stack Tecnológico Recomendado
* **Framework Web / Mobile:** Vite + React + TypeScript (o Next.js App Router) preparado para empaquetado nativo multiplataforma mediante **CapacitorJS** (Android e iOS) y distribución **PWA** en PC/Web.
* **Estilos y Componentes:** Tailwind CSS + componentes basados en **shadcn/ui** + `lucide-react` + `framer-motion` para animaciones cinéticas fluidas.
* **Almacenamiento Local (Local-First):** `IndexedDB` (vía `Dexie.js`) para persistir libros parseados, portadas, citas favoritas y estados locales de lectura offline.
* **Gestión de Sincronización:** Clientes REST livianos para Google Drive / WebDAV y Web Workers dedicados al parseo binario.

---

## 6. Estructura de Directorios del Proyecto

```text
leeto/
├── capacitor.config.ts         # Configuración nativa para Android e iOS
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── public/
└── src/
    ├── app/                    # Vistas / Rutas principales
    │   ├── layout.tsx
    │   ├── page.tsx            # Biblioteca Principal (Tabs + Command Search)
    │   └── read/
    │       └── [id]/
    │           └── page.tsx    # Reproductor LeetoPlayer
    ├── components/
    │   ├── ui/                 # Componentes base estilo shadcn (Button, Tabs, Dialog, Slider, Drawer)
    │   ├── library/            # Grid de libros, Tarjetas, Agrupador de Sagas/Autores, Dropzone
    │   └── player/             # Reproductor vertical, StoriesBar, TimelineSlider, Controles
    ├── core/
    │   ├── db/                 # Configuración de IndexedDB con Dexie.js
    │   ├── parsers/            # Web Workers para EPUB y PDF -> JSON
    │   ├── tts/                # Motor de síntesis de voz local sincronizada
    │   └── sync/               # Clientes de Google Drive / WebDAV y resolución de conflictos
    ├── styles/
    │   └── globals.css         # Variables CSS de temas (Modos claro/oscuro + énfasis editorial)
    └── types/
        └── index.ts            # Tipados TypeScript estrictos
```

---

## 7. Tipado TypeScript Base (`src/types/index.ts`)

```typescript
export type ThemeMode = 'light' | 'dark';
export type AccentTheme = 'amber' | 'sepia' | 'eink' | 'oled';

export interface LeetoBlock {
  id: string;
  type: 'text' | 'image';
  content: string; // Texto limpio o Blob URL para imagen
  caption?: string;
  word_count?: number;
  estimated_duration_ms: number;
}

export interface LeetoChapter {
  chapter_index: number;
  chapter_title: string;
  blocks: LeetoBlock[];
}

export interface LeetoBook {
  book_id: string;
  title: string;
  author: string;
  cover_url: string;
  file_size: number;
  saga?: string;
  volume_number?: number;
  chapters: LeetoChapter[];
  created_at: number;
}

export interface SavedQuote {
  id: string;
  book_id: string;
  book_title: string;
  chapter_title: string;
  block_id: string;
  content: string;
  saved_at: number;
}

export interface ReadingProgress {
  book_id: string;
  current_chapter_index: number;
  current_block_id: string;
  percentage: number;
  updated_at: number; // Timestamp UTC para sincronización
}

export interface SyncState {
  last_synced_at: number;
  devices: Record<string, number>;
  progress: Record<string, ReadingProgress>;
  quotes: SavedQuote[];
}
```

---

## 8. Configuración de Temas y Estilos (`src/styles/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 38 92% 50%; /* Ámbar Editorial (#D97706) */
    --primary-foreground: 0 0% 98%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --border: 240 5.9% 90%;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 37 91% 55%;
    --primary-foreground: 0 0% 9%;
    --card: 240 10% 6%;
    --card-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --border: 240 3.7% 15.9%;
  }

  .theme-oled {
    --background: 0 0% 0%; /* Negro OLED absoluto */
    --foreground: 0 0% 98%;
    --primary: 37 91% 55%;
    --card: 0 0% 4%;
    --border: 0 0% 14%;
  }

  .theme-sepia {
    --background: 37 38% 92%;
    --foreground: 25 20% 20%;
    --primary: 24 70% 40%;
    --card: 37 35% 89%;
    --border: 30 20% 80%;
  }

  .theme-eink {
    --background: 0 0% 94%;
    --foreground: 0 0% 10%;
    --primary: 0 0% 20%;
    --card: 0 0% 97%;
    --border: 0 0% 75%;
  }
}
```

---

## 9. Plan de Ejecución Paso a Paso para el Agente de IA

Desarrolla este proyecto de forma modular siguiendo estas 5 fases secuenciales:

1. **Fase 1 - Configuración Base, Estructura y Temas:** Inicializa el proyecto con Vite/React + TypeScript + Tailwind + configuración de `shadcn/ui` + CapacitorJS, aplicando las variables de tema y los tipados de `src/types/index.ts`.
2. **Fase 2 - Motor de Parseo Local y Base de Datos Offline:** Implementa `Dexie.js` (`IndexedDB`) y los Web Workers para procesar `.epub` y `.pdf` localmente al formato JSON de Leeto, extrayendo metadatos, sagas e imágenes.
3. **Fase 3 - Galería y Biblioteca Inteligente:** Construye la pantalla principal con pestañas (*Todos, Autores, Sagas, Favoritos*), búsqueda instantánea, importador *drag & drop* y edición de metadatos.
4. **Fase 4 - Reproductor Dinámico (`LeetoPlayer`):** Desarrolla la interfaz vertical estilo Reel/TikTok adaptable a escritorio, con temporizador automático por PPM, animaciones `framer-motion`, barra superior tipo *Stories*, `Slider` inferior, gestos táctiles, atajos de teclado y soporte TTS local.
5. **Fase 5 - Sincronización Cloud Local-First:** Implementa el conector opcional para Google Drive / WebDAV / Carpeta Local que gestiona `/LeetoSync/leeto_progress.json` y sincroniza el progreso de lectura y citas entre dispositivos sin servidor propio.