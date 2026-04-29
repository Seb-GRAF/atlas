import { Listing } from '../api/schemas';

export const WORKFLOW_STATUSES = [
  'À trier',
  'À contacter',
  'Contacté',
  'Visite prévue',
  'Dossier à envoyer',
  'Dossier envoyé',
  'Relance à faire',
  'Accepté',
  'Écartée',
  'Refus régie'
];
export const DONE_STATUSES = new Set(['Accepté', 'Écartée', 'Refus régie']);
export const REMOVED_KANBAN_STATUS = 'Retirées';
export const DEFAULT_STATUSES = WORKFLOW_STATUSES;

export type StageTab = 'triage' | 'active' | 'closed';

const ACTIVE_STATUSES = new Set([
  'À contacter',
  'Contacté',
  'Visite prévue',
  'Dossier à envoyer',
  'Dossier envoyé',
  'Relance à faire'
]);

export function normalizeListingStatus(status: string | null | undefined) {
  const s = String(status || '').trim();
  if (!s || s === 'À trier') return 'À trier';
  if (s === 'À contacter') return 'À contacter';
  if (s === 'Sauvegardé' || s === 'Gardée') return 'À contacter';
  if (['Contacté', 'Contactée'].includes(s)) return 'Contacté';
  if (['Visite', 'Visite demandée', 'Visite planifiée', 'Visité', 'Visite prévue'].includes(s)) return 'Visite prévue';
  if (['Dossier', 'Dossier prêt à envoyer', 'Dossier à envoyer'].includes(s)) return 'Dossier à envoyer';
  if (['Dossier envoyé'].includes(s)) return 'Dossier envoyé';
  if (['Relance', 'Relance J+2', 'Sans réponse', 'Relance à faire'].includes(s)) return 'Relance à faire';
  if (s === 'Refusé' || s === 'Écartée') return 'Écartée';
  if (s === 'Refus régie') return 'Refus régie';
  if (s === 'Accepté') return 'Accepté';
  return 'À trier';
}

export const STAGES: { value: StageTab; label: string; match: (item: Listing) => boolean }[] = [
  {
    value: 'triage',
    label: 'À trier',
    match: (item) => !item.isRemoved && normalizeListingStatus(item.status) === 'À trier'
  },
  {
    value: 'active',
    label: 'En cours',
    match: (item) => !item.isRemoved && ACTIVE_STATUSES.has(normalizeListingStatus(item.status))
  },
  {
    value: 'closed',
    label: 'Clos',
    match: (item) => !!item.isRemoved || DONE_STATUSES.has(normalizeListingStatus(item.status))
  }
];

function dateMs(iso: string | null | undefined) {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function listingFallbackDateMs(item: Listing) {
  return dateMs(item.firstSeenAt) || dateMs(item.lastSeenAt) || dateMs(item.updatedAt);
}

export function listingDateMs(item: Listing) {
  return dateMs(item.publishedAt) || listingFallbackDateMs(item);
}

function formatAge(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

export function isRefused(item: Listing) {
  const status = normalizeListingStatus(item.status);
  return !item.isRemoved && (status === 'Écartée' || status === 'Refus régie');
}

export function isNewToday(item: Listing) {
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

export function filterAndSortListings(items: Listing[], query: string) {
  const q = query.trim().toLowerCase();
  let out = [...items].filter((item) => item.display !== false);

  if (q) {
    out = out.filter((item) => {
      const hay = `${item.objectType || ''} ${item.address || ''} ${item.area || ''} ${item.title || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  out.sort((a, b) => {
    const pinned = Number(!!b.pinned) - Number(!!a.pinned);
    if (pinned) return pinned;
    const aGrey = a.isRemoved || isRefused(a) ? 1 : 0;
    const bGrey = b.isRemoved || isRefused(b) ? 1 : 0;
    if (aGrey !== bGrey) return aGrey - bGrey;
    const aSortDate = listingDateMs(a);
    const bSortDate = listingDateMs(b);
    return bSortDate - aSortDate;
  });

  return out;
}

export function listingMatchesStage(item: Listing, stage: StageTab) {
  return STAGES.find((s) => s.value === stage)?.match(item) ?? false;
}

export function stageCounts(items: Listing[]) {
  const counts = Object.fromEntries(STAGES.map((s) => [s.value, 0])) as Record<StageTab, number>;
  for (const item of items) {
    for (const s of STAGES) if (s.match(item)) counts[s.value] += 1;
  }
  return counts;
}

export function filterListingsForStage(items: Listing[], stage: StageTab, query: string) {
  return filterAndSortListings(
    items.filter((item) => listingMatchesStage(item, stage)),
    query
  );
}

export function getImageUrls(item: Listing) {
  if (Array.isArray(item.imageUrlsLocal) && item.imageUrlsLocal.length) return item.imageUrlsLocal;
  if (Array.isArray(item.imageUrls) && item.imageUrls.length) return item.imageUrls;
  if (Array.isArray(item.imageUrlsRemote) && item.imageUrlsRemote.length) return item.imageUrlsRemote;
  if (item.imageUrl) return [item.imageUrl];
  return [];
}

export function publishedMeta(item: Listing) {
  const parseAge = (iso: string | null | undefined) => {
    if (!iso) return null;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return null;
    const ageMs = Math.max(0, Date.now() - ts);
    return {
      ageMs,
      days: Math.floor(ageMs / 86400000),
      label: formatAge(ageMs)
    };
  };

  const publishedAge = parseAge(item.publishedAt);
  if (publishedAge) {
    return { ...publishedAge, approximate: false, source: 'published' as const, iso: item.publishedAt || null };
  }

  const discoveredAge = parseAge(item.firstSeenAt);
  if (discoveredAge) {
    return { ...discoveredAge, approximate: true, source: 'firstSeen' as const, iso: item.firstSeenAt || null };
  }

  return { ageMs: null, days: null, label: null, approximate: false, source: 'none' as const, iso: null };
}

export function publishedLabel(item: Listing) {
  const meta = publishedMeta(item);
  if (!meta.label) return 'Inconnue';
  return meta.source === 'firstSeen' ? `Vu ${meta.label}` : meta.label;
}

export function listingSourceLabel(item: Listing) {
  const raw = String(item.source || '').trim().toLowerCase();
  if (raw.includes('immobilier')) return 'immobilier.ch';
  if (raw.includes('flatfox')) return 'flatfox.ch';

  const url = String(item.url || '').trim();
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
      if (host) return host;
    } catch {
      return raw || null;
    }
  }

  return raw || null;
}

export function getUrgency(item: Listing) {
  if (item.isRemoved) return { level: 'done' as const, label: 'Retirée' };

  const status = normalizeListingStatus(item.status);
  if (DONE_STATUSES.has(status)) return { level: 'done' as const, label: 'Clos' };
  if (status === 'Relance à faire') return { level: 'high' as const, label: 'Relance' };

  const refIso = item.updatedAt || item.firstSeenAt || item.lastSeenAt;
  const ageHours = refIso ? (Date.now() - new Date(refIso).getTime()) / 3600000 : 0;

  if (status === 'À trier') {
    if (ageHours > 18) return { level: 'high' as const, label: 'Trier' };
    if (ageHours > 8) return { level: 'medium' as const, label: 'Nouveau' };
  }

  if (status === 'À contacter') {
    if (ageHours > 18) return { level: 'high' as const, label: 'Urgent' };
    if (ageHours > 8) return { level: 'medium' as const, label: 'Suivi' };
  }

  if (status === 'Visite prévue') {
    if (ageHours > 36) return { level: 'high' as const, label: 'Relance' };
    if (ageHours > 18) return { level: 'medium' as const, label: 'Suivi' };
  }

  if (status === 'Dossier à envoyer' || status === 'Dossier envoyé') {
    if (ageHours > 24) return { level: 'high' as const, label: 'Urgent' };
    if (ageHours > 12) return { level: 'medium' as const, label: 'Suivi' };
  }

  return { level: 'low' as const, label: 'OK' };
}

function formatRooms(rooms: number) {
  return Number.isInteger(rooms) ? String(rooms) : rooms.toString().replace('.', ',');
}

function cityFromAddress(address: string | null | undefined) {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;
  return last.replace(/^\d{4,5}\s+/, '').trim() || null;
}

export function listingTitle(item: Listing) {
  const city = item.area || cityFromAddress(item.address);
  if (item.rooms != null && city) {
    return `${formatRooms(item.rooms)} pièces à ${city}`;
  }
  if (item.rooms != null) {
    return `${formatRooms(item.rooms)} pièces`;
  }
  if (city) return city;
  return item.objectType || item.title || 'Annonce';
}
