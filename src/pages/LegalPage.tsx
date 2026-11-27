import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_LABEL, GITHUB_REPO_URL, SITE_URL } from '@/lib/buildInfo';

const SECTIONS: Array<{ id: string; title: string; paragraphs: string[]; items?: string[] }> = [
  {
    id: 'titular',
    title: '1. Titular y ámbito',
    paragraphs: [
      `Leeto es un lector de EPUB, PDF y cómics distribuido de forma gratuita por el proyecto ${GITHUB_REPO_URL}. Esta única página reúne el aviso legal, la política de privacidad, la política de cookies, los términos de uso y la información de seguridad de la aplicación web y de la APK de Android (${APP_LABEL}).`,
      'Al usar Leeto aceptas estos términos. Si no estás de acuerdo, puedes dejar de usar la aplicación y borrar tus datos desde el navegador o desde el dispositivo.',
    ],
  },
  {
    id: 'datos',
    title: '2. Qué datos guarda Leeto',
    paragraphs: [
      'Leeto funciona principalmente en local. Los libros que importas, sus portadas e imágenes, tu progreso de lectura, tus citas, tus ajustes y las carpetas que elegiste se guardan en el almacenamiento de tu dispositivo (IndexedDB y localStorage del navegador o de la WebView de la APK).',
      'No creamos cuentas, no pedimos correo electrónico y no enviamos esos datos a ningún servidor propio. Solo salen de tu dispositivo si tú activas y configuras expresamente una opción de sincronización.',
    ],
    items: [
      'Biblioteca: archivos importados, metadatos, capítulos y recursos gráficos.',
      'Lectura: posición, porcentaje, estado y tiempo de lectura, además de citas y notas.',
      'Preferencias: tema, tamaño de texto, ritmo, voz, movimiento y ajustes de sincronización.',
      'Carpetas: nombre de la carpeta y, cuando el navegador lo permite, un identificador de acceso para volver a escanearla. El acceso se concede solo cuando tú lo confirmas.',
    ],
  },
  {
    id: 'sincronizacion',
    title: '3. Sincronización',
    paragraphs: [
      'La sincronización es opcional y está desactivada por defecto. Si la activas con una carpeta local, Leeto escribe un archivo de sincronización y los archivos de tu biblioteca en la carpeta que elijas; para volver a usarla en otra sesión debes seleccionarla de nuevo.',
      'Google Drive está preparado como proveedor, pero permanece desactivado hasta que se configure su integración de OAuth. Cuando se active, los archivos se guardarán únicamente en tu cuenta de Google, bajo los permisos que tú concedas. Leeto no tendrá acceso a otros archivos de tu Drive.',
      'No usamos WebDAV ni ningún otro proveedor en esta versión. Puedes exportar e importar el archivo JSON manualmente si no quieres usar un proveedor.',
    ],
  },
  {
    id: 'permisos',
    title: '4. Permisos y archivos del dispositivo',
    paragraphs: [
      'Leeto solo lee los archivos que arrastras, seleccionas o que se encuentran en las carpetas que eliges explícitamente. En Android usamos el selector de documentos del sistema para elegir carpetas de libros; la app no solicita acceso global al almacenamiento.',
      'Si retiras el permiso o el navegador caduca el acceso, la carpeta deja de poder escanearse hasta que la vuelvas a elegir. Puedes quitar una carpeta guardada desde el diálogo de escaneo.',
    ],
  },
  {
    id: 'voz',
    title: '5. Voz, accesibilidad y reproducción',
    paragraphs: [
      'La lectura en voz alta usa las voces instaladas en tu dispositivo. Leeto no graba audio ni envía el texto a un servicio de voz externo.',
      'El modo de movimiento reducido respeta la preferencia de accesibilidad de tu sistema. El resaltado de la palabra activa se puede desactivar en los ajustes de lectura.',
    ],
  },
  {
    id: 'cookies',
    title: '6. Cookies, analítica y publicidad',
    paragraphs: [
      'Leeto no usa cookies, balizas, pixel de seguimiento, analítica ni publicidad. No hay redes de terceros incrustadas en la aplicación.',
      'El service worker guarda en caché los archivos estáticos de la web para que funcione sin conexión. Esa caché vive en tu dispositivo y no contiene tus libros ni tus datos personales.',
    ],
  },
  {
    id: 'compartir',
    title: '7. Compartir',
    paragraphs: [
      'El botón «Compartir» usa el menú nativo del dispositivo cuando está disponible. Si no lo está, copia el enlace al portapapeles. Leeto no publica nada por ti ni comparte tu biblioteca: solo el enlace de la aplicación y del repositorio.',
    ],
  },
  {
    id: 'seguridad',
    title: '8. Seguridad',
    paragraphs: [
      'La web se sirve por HTTPS. La APK se firma con una clave privada que no se distribuye en el repositorio, y cada release publica su huella SHA-256 para que puedas verificarla.',
      'Tus credenciales de proveedores externos no se guardan en los archivos de sincronización ni se envían a Leeto. Aun así, protege la carpeta o la cuenta que uses para sincronizar: quien tenga acceso a ella podrá leer los archivos que Leeto guarde allí.',
    ],
  },
  {
    id: 'menores',
    title: '9. Menores de edad',
    paragraphs: [
      'Leeto no está dirigido a menores de 13 años y no recoge datos de ellos. Los libros y portadas que importes son responsabilidad de quien los añade a la biblioteca.',
    ],
  },
  {
    id: 'propiedad',
    title: '10. Propiedad intelectual y licencias',
    paragraphs: [
      `El código fuente de Leeto está publicado en ${GITHUB_REPO_URL}. Las marcas y contenidos de terceros que aparecen en los libros importados pertenecen a sus respectivos titulares; Leeto no reclama propiedad sobre ellos.`,
      'Las dependencias de código abierto se listan en package.json y package-lock.json, junto con sus licencias en sus propios paquetes. La distribución de la APK incluye esos avisos a través de sus metadatos de build.',
    ],
  },
  {
    id: 'responsabilidad',
    title: '11. Garantías y responsabilidad',
    paragraphs: [
      'Leeto se ofrece «tal cual», sin garantía de funcionamiento ininterrumpido. Mantén copias de seguridad de tus libros y de la carpeta de sincronización. El uso de la aplicación es bajo tu responsabilidad.',
    ],
  },
  {
    id: 'contacto',
    title: '12. Contacto y cambios',
    paragraphs: [
      `Para preguntas, incidencias o solicitudes relacionadas con estos términos, abre un issue en ${GITHUB_REPO_URL}/issues. Esta página se actualizará cuando cambie el comportamiento de la aplicación; la versión indicada arriba corresponde al build que estás usando.`,
    ],
  },
];

/** Página legal única: aviso legal, privacidad, cookies, términos y seguridad. */
export default function LegalPage() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 pt-6 pb-12 sm:px-6">
      <header className="space-y-3">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la biblioteca
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Información legal y privacidad</h1>
        <p className="text-muted-foreground text-sm">
          Última actualización: 27 de noviembre de 2026 · {SITE_URL}
        </p>
      </header>

      <nav aria-label="Secciones legales" className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="border-border hover:bg-muted rounded-full border px-3 py-1 text-xs"
          >
            {section.title.replace(/^\d+\.\s*/, '')}
          </a>
        ))}
      </nav>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-6 space-y-3">
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-muted-foreground text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
