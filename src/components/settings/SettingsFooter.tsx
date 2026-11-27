const AUTHOR_URL = 'https://1azarito.vercel.app';

/** Crédito y copyright del modal; el año se calcula en cada render. */
export default function SettingsFooter() {
  return (
    <footer className="text-muted-foreground pt-2 pb-2 text-center text-xs leading-relaxed">
      <p>
        Made with <span aria-label="amor">❤️‍🔥</span> by{' '}
        <a
          href={AUTHOR_URL}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2"
        >
          1azarito
        </a>
      </p>
      <p>© {new Date().getFullYear()} Leeto. Todos los derechos reservados.</p>
    </footer>
  );
}
