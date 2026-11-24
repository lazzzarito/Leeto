import { XMLParser } from 'fast-xml-parser';

export interface XmlNode {
  '#text'?: string;
  [key: string]: unknown;
}

export function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null;
}

export function asNode(value: unknown): XmlNode {
  return isNode(value) ? value : {};
}

export function nodeArray(value: unknown): XmlNode[] {
  if (Array.isArray(value)) return value.filter(isNode);
  return isNode(value) ? [value] : [];
}

export function textOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (isNode(value) && typeof value['#text'] === 'string') return value['#text'].trim();
  return '';
}

export function attributeOf(value: unknown, name: string): string {
  const node = asNode(value);
  const attribute = node[`@_${name}`];
  return typeof attribute === 'string' || typeof attribute === 'number'
    ? String(attribute).trim()
    : '';
}

/** Configuración compartida por los parsers EPUB/FB2/DOCX/ODT. */
export function makeXmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
    // Entidades permitidas, con límites explícitos contra expansiones anidadas.
    processEntities: {
      maxTotalExpansions: 1000,
      maxExpandedLength: 100_000,
      maxEntityCount: 100,
    },
  });
}
