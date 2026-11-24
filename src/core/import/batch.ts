export interface ImportBatchSummary {
  total: number;
  imported: number;
  duplicates: number;
  failedFiles: { name: string; error: string }[];
}

export interface BatchNotice {
  kind: 'success' | 'info' | 'error';
  title: string;
  detail?: string;
}

/** Un solo aviso al terminar un lote, con el resultado y los fallos. */
export function describeImportBatch(summary: ImportBatchSummary): BatchNotice {
  const failed = summary.failedFiles.length;
  const ok = summary.imported + summary.duplicates;

  if (ok === 0 && failed > 0) {
    return {
      kind: 'error',
      title: 'No se pudo importar ningún libro',
      detail: summary.failedFiles[0]?.error,
    };
  }
  if (failed > 0) {
    const names = summary.failedFiles
      .slice(0, 3)
      .map((file) => file.name)
      .join(', ');
    const more = failed > 3 ? ` y ${failed - 3} más` : '';
    return {
      kind: 'error',
      title: `Importados ${ok} de ${summary.total} libros`,
      detail: `Con error: ${names}${more}`,
    };
  }
  if (summary.imported === 0) {
    return {
      kind: 'info',
      title: 'Ya estaban en la biblioteca',
      detail: `${summary.duplicates} libros duplicados`,
    };
  }
  return {
    kind: 'success',
    title: `Se importaron ${summary.imported} libros`,
    detail:
      summary.duplicates > 0
        ? `${summary.duplicates} ya estaban en la biblioteca`
        : 'Se importaron todos',
  };
}
