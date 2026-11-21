import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseEpub } from './epub';
import type { ParseProgress, ParseRequest } from './types';

async function buildEpubFixture(): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
  <metadata>
    <dc:title>El Libro</dc:title>
    <dc:creator>Ana Autora</dc:creator>
    <dc:language>es</dc:language>
    <meta name="cover" content="cover"/>
    <meta property="belongs-to-collection">La Saga</meta>
    <meta property="group-position">2</meta>
  </metadata>
  <manifest>
    <item id="cover" href="images/fig.png" media-type="image/png" properties="cover-image"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="c1"/></spine>
</package>`,
  );
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint id="n1" playOrder="1"><navLabel><text>Primero</text></navLabel><content src="chapter1.xhtml"/></navPoint></navMap></ncx>`,
  );
  zip.file(
    'OEBPS/chapter1.xhtml',
    `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Primero</title></head><body>
      <h1>Capítulo Uno</h1>
      <p>Hola mundo, esto es una prueba.</p>
      <p>Segundo párrafo con <b>énfasis</b>.</p>
      <img src="images/fig.png" alt="Figura"/>
    </body></html>`,
  );
  zip.file('OEBPS/images/fig.png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
}

describe('parseEpub', () => {
  it('extrae metadatos, saga, capítulos, bloques y la portada', async () => {
    const bytes = await buildEpubFixture();
    const request: ParseRequest = {
      contentHash: 'sha256:fixture',
      fileName: 'libro.epub',
      fileSize: bytes.byteLength,
      mimeType: 'application/epub+zip',
      bytes,
    };
    const progress: ParseProgress[] = [];

    const result = await parseEpub(request, (event) => progress.push(event));

    expect(result.title).toBe('El Libro');
    expect(result.author).toBe('Ana Autora');
    expect(result.language).toBe('es');
    expect(result.saga).toBe('La Saga');
    expect(result.volumeNumber).toBe(2);
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]?.title).toBe('Primero');
    expect(result.chapters[0]?.blocks.map((block) => block.type)).toEqual([
      'text',
      'text',
      'text',
      'image',
    ]);
    expect(result.chapters[0]?.blocks.at(-1)).toMatchObject({
      type: 'image',
      alt: 'Figura',
      assetId: result.coverAssetId,
    });
    expect(result.assets).toHaveLength(1);
    expect(result.totalWordCount).toBeGreaterThan(0);
    expect(progress.some((event) => event.stage === 'extracting-assets')).toBe(true);
    expect(progress.at(-1)?.stage).toBe('normalizing');
  });

  it('rechaza un ZIP sin contenedor EPUB', async () => {
    const zip = new JSZip();
    zip.file('otro.txt', 'nada');
    const bytes = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
    await expect(
      parseEpub(
        {
          contentHash: 'sha256:bad',
          fileName: 'malo.epub',
          fileSize: bytes.byteLength,
          mimeType: 'application/epub+zip',
          bytes,
        },
        () => {},
      ),
    ).rejects.toMatchObject({ code: 'INVALID_FORMAT' });
  });
});
