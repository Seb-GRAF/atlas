import type { DashboardState, Listing as ApiListing, ProfileDetail } from '../../api/schemas';
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

function normalizeRawStatus(raw: string | null | undefined): AtlasListingStatus {
  const s = String(raw || '').trim();
  if (!s || s === 'À trier') return 'À trier';
  if (s === 'À contacter' || s === 'Sauvegardé' || s === 'Gardée') return 'À contacter';
  if (
    [
      'Visite',
      'Visite demandée',
      'Visite planifiée',
      'Visité',
      'Visite prévue'
    ].includes(s)
  )
    return 'Visite prévue';
  if (['Dossier', 'Dossier prêt à envoyer', 'Dossier à envoyer'].includes(s))
    return 'Dossier à envoyer';
  if (s === 'Dossier envoyé') return 'Dossier envoyé';
  if (s === 'Refus régie') return 'Refus régie';
  if (s === 'Refusé' || s === 'Écartée') return 'Écartée';
  if (s === 'Accepté') return 'Dossier envoyé';
  if (['Contacté', 'Contactée', 'Relance', 'Relance J+2', 'Relance à faire', 'Sans réponse'].includes(s))
    return 'À contacter';
  return 'À trier';
}

function rawSourceLabel(item: ApiListing): string {
  const raw = String(item.source || '').trim().toLowerCase();
  if (raw.includes('immobilier')) return 'immobilier.ch';
  if (raw.includes('flatfox')) return 'flatfox.ch';
  if (raw.includes('naef')) return 'naef.ch';
  if (raw.includes('bernard') || raw.includes('nicod')) return 'bernard-nicod';
  if (raw.includes('retraites') || raw.includes('populaires')) return 'Retraites Populaires';
  if (raw.includes('anibis')) return 'anibis.ch';
  const url = String(item.url || '').trim();
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      /* fallthrough */
    }
  }
  return raw;
}

function toAtlasSource(raw: ApiListing): AtlasListingSource | string {
  const label = rawSourceLabel(raw);
  for (const known of KNOWN_SOURCES) {
    if (label.includes(known.toLowerCase())) return known;
  }
  return label || 'unknown';
}

function getImageUrls(item: ApiListing): string[] {
  if (Array.isArray(item.imageUrlsLocal) && item.imageUrlsLocal.length) return item.imageUrlsLocal;
  if (Array.isArray(item.imageUrls) && item.imageUrls.length) return item.imageUrls;
  if (Array.isArray(item.imageUrlsRemote) && item.imageUrlsRemote.length) return item.imageUrlsRemote;
  if (item.imageUrl) return [item.imageUrl];
  return [];
}

function isNewToday(item: ApiListing): boolean {
  if (!item.firstSeenAt || item.isRemoved) return false;
  const seen = new Date(item.firstSeenAt);
  if (!Number.isFinite(seen.getTime())) return false;
  const today = new Date();
  return (
    seen.getFullYear() === today.getFullYear() &&
    seen.getMonth() === today.getMonth() &&
    seen.getDate() === today.getDate()
  );
}

function formatAge(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

type AgeMeta = {
  label: string | null;
  source: 'published' | 'firstSeen' | 'none';
};

function ageMeta(item: ApiListing): AgeMeta {
  const parse = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return null;
    return formatAge(Math.max(0, Date.now() - ts));
  };
  const published = parse(item.publishedAt);
  if (published) return { label: published, source: 'published' };
  const seen = parse(item.firstSeenAt);
  if (seen) return { label: seen, source: 'firstSeen' };
  return { label: null, source: 'none' };
}

function formatRooms(rooms: number): string {
  return Number.isInteger(rooms) ? String(rooms) : rooms.toString().replace('.', ',');
}

function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;
  return last.replace(/^\d{4,5}\s+/, '').trim() || null;
}

function listingTitle(item: ApiListing): string {
  if (item.title && item.title.trim()) return item.title;
  const city = item.area || cityFromAddress(item.address);
  if (item.rooms != null && city) return `${formatRooms(item.rooms)} pièces à ${city}`;
  if (item.rooms != null) return `${formatRooms(item.rooms)} pièces`;
  if (city) return city;
  return item.objectType || 'Annonce';
}

export function adaptListing(item: ApiListing): AtlasListing {
  const meta = ageMeta(item);
  return {
    id: String(item.id),
    title: listingTitle(item),
    area: item.area ?? '',
    address: item.address ?? '',
    rooms: item.rooms ?? null,
    surfaceM2: item.surfaceM2 ?? null,
    totalChf: item.totalChf ?? null,
    source: toAtlasSource(item),
    url: item.url ?? null,
    pinned: !!item.pinned,
    isNew: isNewToday(item),
    isRemoved: !!item.isRemoved,
    status: normalizeRawStatus(item.status),
    notes: item.notes ?? '',
    publishedLabel: meta.label
      ? meta.source === 'firstSeen'
        ? `Vu ${meta.label}`
        : `il y a ${meta.label}`
      : 'Inconnue',
    publishedShort: meta.label ?? '',
    transitText: item.transitText ?? null,
    driveText: item.driveText ?? null,
    distanceText: item.distanceText ?? null,
    driveMinutes: item.driveMinutes ?? null,
    transitMinutes: item.transitMinutes ?? null,
    driveRouteStatus: item.driveRouteStatus ?? null,
    transitRouteStatus: item.transitRouteStatus ?? null,
    transitRouteLabel: item.transitRouteLabel ?? null,
    transitRouteComputedAt: item.transitRouteComputedAt ?? null,
    transitRoute: item.transitRoute ?? null,
    commuteWarnings: Array.isArray(item.commuteWarnings) ? item.commuteWarnings : [],
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
