import type { DashboardState, Listing as ApiListing, ProfileDetail } from '../../api/schemas';
import {
  getImageUrls,
  isNewToday,
  listingSourceLabel,
  listingTitle,
  normalizeListingStatus,
  publishedLabel,
  publishedMeta
} from '../../utils/listings';
import type {
  AtlasListing,
  AtlasListingSource,
  AtlasListingStatus,
  AtlasProfile,
  AtlasStage,
  AtlasStageValue
} from '../types';

const KNOWN_SOURCES: AtlasListingSource[] = [
  'immobilier.ch',
  'flatfox.ch',
  'naef.ch',
  'bernard-nicod',
  'Retraites Populaires',
  'anibis.ch'
];

const STATUS_FALLBACKS: Record<string, AtlasListingStatus> = {
  'À trier': 'À trier',
  'À contacter': 'À contacter',
  Contacté: 'À contacter',
  'Visite prévue': 'Visite prévue',
  'Dossier à envoyer': 'Dossier à envoyer',
  'Dossier envoyé': 'Dossier envoyé',
  'Relance à faire': 'À contacter',
  Accepté: 'Dossier envoyé',
  Écartée: 'Écartée',
  'Refus régie': 'Refus régie'
};

function toAtlasStatus(raw: string | null | undefined): AtlasListingStatus {
  const normalized = normalizeListingStatus(raw);
  return STATUS_FALLBACKS[normalized] ?? 'À trier';
}

function toAtlasSource(raw: string | null | undefined): AtlasListingSource | string {
  const label = (listingSourceLabel({ source: raw ?? null, url: null } as ApiListing) || '').toLowerCase();
  for (const known of KNOWN_SOURCES) {
    if (label.includes(known.toLowerCase())) return known;
  }
  return raw || label || 'unknown';
}

function shortAge(item: ApiListing): string {
  const meta = publishedMeta(item);
  return meta.label ?? '';
}

export function adaptListing(item: ApiListing): AtlasListing {
  const id = String(item.id);
  return {
    id,
    title: item.title || listingTitle(item),
    area: item.area ?? '',
    address: item.address ?? '',
    rooms: item.rooms ?? null,
    surfaceM2: item.surfaceM2 ?? null,
    totalChf: item.totalChf ?? null,
    source: toAtlasSource(item.source),
    url: item.url ?? null,
    pinned: !!item.pinned,
    isNew: isNewToday(item),
    isRemoved: !!item.isRemoved,
    status: toAtlasStatus(item.status),
    notes: item.notes ?? '',
    publishedLabel: publishedLabel(item),
    publishedShort: shortAge(item),
    transitText: item.transitText ?? null,
    driveText: item.driveText ?? null,
    distanceText: item.distanceText ?? null,
    lat: item.mapLocation?.lat ?? null,
    lon: item.mapLocation?.lon ?? null,
    images: getImageUrls(item)
  };
}

export function adaptListings(state: DashboardState): AtlasListing[] {
  return state.tracker.listings.map(adaptListing);
}

const STAGE_DEFINITIONS: { value: AtlasStageValue; label: string; match: (l: AtlasListing) => boolean }[] = [
  { value: 'triage', label: 'À trier', match: (l) => !l.isRemoved && l.status === 'À trier' },
  {
    value: 'active',
    label: 'En cours',
    match: (l) => !l.isRemoved && (l.status === 'À contacter' || l.status === 'Visite prévue')
  },
  {
    value: 'visits',
    label: 'Visites',
    match: (l) => !l.isRemoved && l.status === 'Visite prévue'
  },
  {
    value: 'files',
    label: 'Dossiers',
    match: (l) =>
      !l.isRemoved && (l.status === 'Dossier à envoyer' || l.status === 'Dossier envoyé')
  },
  {
    value: 'done',
    label: 'Archivées',
    match: (l) => l.isRemoved || l.status === 'Refus régie' || l.status === 'Écartée'
  }
];

export function listStages(listings: AtlasListing[]): AtlasStage[] {
  return STAGE_DEFINITIONS.map(({ value, label, match }) => ({
    value,
    label,
    count: listings.filter(match).length
  }));
}

export function matchesStage(listing: AtlasListing, stage: AtlasStageValue): boolean {
  const def = STAGE_DEFINITIONS.find((s) => s.value === stage);
  return def ? def.match(listing) : true;
}

export function adaptProfile(detail: ProfileDetail | null, state: DashboardState | null): AtlasProfile {
  const slug = detail?.slug ?? state?.profile ?? 'default';
  const zones = detail?.areas?.map((a) => a.label) ?? [];
  const workplaceAddress = detail?.preferences?.workplaceAddress ?? null;
  const workplaceCoords = state?.map?.workplace
    ? { lat: state.map.workplace.lat, lon: state.map.workplace.lon }
    : null;
  const enabled: Partial<Record<AtlasListingSource, boolean>> = {};
  const sources = detail?.sources ?? {};
  if (typeof sources.immobilier === 'boolean') enabled['immobilier.ch'] = sources.immobilier;
  if (typeof sources.flatfox === 'boolean') enabled['flatfox.ch'] = sources.flatfox;
  if (typeof sources.naef === 'boolean') enabled['naef.ch'] = sources.naef;
  if (typeof sources.bernardNicod === 'boolean') enabled['bernard-nicod'] = sources.bernardNicod;
  if (typeof sources.retraitesListings === 'boolean')
    enabled['Retraites Populaires'] = sources.retraitesListings;
  if (typeof sources.anibis === 'boolean') enabled['anibis.ch'] = sources.anibis;

  const generatedRaw = state?.latest?.generatedAt ?? null;
  const generatedLabel = generatedRaw ? relativeFr(generatedRaw) : '';

  return {
    slug,
    shortTitle: detail?.shortTitle ?? state?.profile ?? 'Atlas',
    zones,
    workplace: workplaceAddress,
    workplaceCoords,
    newCount: state?.latest?.newCount ?? 0,
    generatedAt: generatedLabel,
    budgetMaxChf: detail?.filters?.maxTotalChf ?? null,
    budgetCeilingChf: detail?.filters?.maxTotalHardChf ?? null,
    enabledSources: enabled
  };
}

function relativeFr(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const ageMs = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}
