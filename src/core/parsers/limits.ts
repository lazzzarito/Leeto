/** Topes estructurales para archivos de libro no confiables. */
export const PARSE_LIMITS = {
  maxPdfPages: 2000,
  maxBookCharacters: 30_000_000,
  maxHtmlCharsPerChapter: 5_000_000,
  maxEpubSpineItems: 1500,
  maxBlocksPerBook: 100_000,
  maxAssetsPerBook: 2000,
  maxTocNodes: 10_000,
  maxElementsPerDocument: 2000,
  maxHtmlNestingDepth: 200,
} as const;
