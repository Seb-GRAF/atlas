import type { Area } from '../../api/schemas';

const CANTON_MAP: Record<string, string> = {
  ag: 'aargau',
  ai: 'appenzell-innerrhoden',
  ar: 'appenzell-ausserrhoden',
  be: 'bern',
  bl: 'basel-landschaft',
  bs: 'basel-stadt',
  fr: 'fribourg',
  ge: 'geneve',
  gl: 'glarus',
  gr: 'graubunden',
  ju: 'jura',
  lu: 'luzern',
  ne: 'neuchatel',
  nw: 'nidwalden',
  ow: 'obwalden',
  sg: 'st-gallen',
  sh: 'schaffhausen',
  so: 'solothurn',
  sz: 'schwyz',
  tg: 'thurgau',
  ti: 'ticino',
  ur: 'uri',
  vd: 'vaud',
  vs: 'valais',
  zg: 'zug',
  zh: 'zurich'
};

export type GeoResult = {
  attrs?: Record<string, unknown>;
};

export type GeoAddress = {
  label: string;
  lat: number | null;
  lon: number | null;
};

function cleanLabel(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildGeoSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseGeoAreaResult(result: GeoResult): Area | null {
  const attrs = result.attrs;
  if (!attrs) return null;

  const rawLabel = cleanLabel(attrs.label || attrs.name);
  const label = rawLabel.replace(/\s*(?:\([A-Z]{2}\)|[A-Z]{2})\s*$/, '').trim();
  if (!label) return null;

  const detail = String(attrs.detail ?? '').toLowerCase();
  const detailMatch = detail.match(/\b([a-z]{2})$/);
  const cantonAbbr = String(attrs.canton || attrs.kanton || detailMatch?.[1] || '').toLowerCase();

  return {
    label,
    slug: buildGeoSlug(label),
    canton: CANTON_MAP[cantonAbbr] || cantonAbbr,
    cantonAbbr: cantonAbbr.toUpperCase(),
    npa: null,
    lat: toFiniteNumber(attrs.lat),
    lon: toFiniteNumber(attrs.lon)
  };
}

export function parseGeoAddressResult(result: GeoResult): GeoAddress | null {
  const attrs = result.attrs;
  if (!attrs) return null;
  const label = cleanLabel(attrs.label);
  if (!label) return null;
  return {
    label,
    lat: toFiniteNumber(attrs.lat),
    lon: toFiniteNumber(attrs.lon)
  };
}
