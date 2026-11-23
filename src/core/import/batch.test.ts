import { describe, expect, it } from 'vitest';
import { describeImportBatch } from './batch';

describe('describeImportBatch', () => {
  it('resume una importación completa en un solo aviso', () => {
    expect(
      describeImportBatch({ total: 4, imported: 4, duplicates: 0, failedFiles: [] }),
    ).toEqual({
      kind: 'success',
      title: 'Se importaron 4 libros',
      detail: 'Todos los libros se importaron correctamente',
    });
  });

  it('indica cuántos ya estaban en la biblioteca', () => {
    expect(
      describeImportBatch({ total: 4, imported: 2, duplicates: 2, failedFiles: [] }),
    ).toEqual({
      kind: 'success',
      title: 'Se importaron 2 libros',
      detail: '2 ya estaban en la biblioteca',
    });
  });

  it('detalla los archivos con error cuando hay fallos parciales', () => {
    expect(
      describeImportBatch({
        total: 5,
        imported: 3,
        duplicates: 0,
        failedFiles: [
          { name: 'roto.epub', error: 'EPUB inválido' },
          { name: 'cortado.pdf', error: 'PDF ilegible' },
        ],
      }),
    ).toEqual({
      kind: 'error',
      title: 'Importados 3 de 5 libros',
      detail: 'Con error: roto.epub, cortado.pdf',
    });
  });

  it('avisa cuando no se importó ninguno', () => {
    expect(
      describeImportBatch({
        total: 2,
        imported: 0,
        duplicates: 0,
        failedFiles: [{ name: 'a.epub', error: 'Archivo corrupto' }],
      }),
    ).toEqual({
      kind: 'error',
      title: 'No se pudo importar ningún libro',
      detail: 'Archivo corrupto',
    });
  });
});
