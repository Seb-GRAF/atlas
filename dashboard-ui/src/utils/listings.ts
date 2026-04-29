import { Listing } from '../api/schemas';

export const DEFAULT_STATUSES = ['À contacter', 'Visite', 'Dossier', 'Relance', 'Accepté', 'Refusé', 'Sans réponse'];
export const DONE_STATUSES = new Set(['Accepté', 'Refusé']);
export const REMOVED_KANBAN_STATUS = 'Retirées';

export function listingDateMs(item: Listing) {
  const iso = item.publishedAt || item.firstSeenAt || item.lastSeenAt || item.updatedAt;
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

export function isRefused(item: Listing) {
  return !item.isRemoved && (item.status || '') === 'Refusé';
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
    const aGrey = a.isRemoved || isRefused(a) ? 1 : 0;
    const bGrey = b.isRemoved || isRefused(b) ? 1 : 0;
    if (aGrey !== bGrey) return aGrey - bGrey;
    return listingDateMs(b) - listingDateMs(a) || (b.score || 0) - (a.score || 0);
  });

  return out;
}

export function getImageUrls(item: Listing) {
  if (Array.isArray(item.imageUrlsLocal) && item.imageUrlsLocal.length) return item.imageUrlsLocal;
  if (Array.isArray(item.imageUrls) && item.imageUrls.length) return item.imageUrls;
  if (Array.isArray(item.imageUrlsRemote) && item.imageUrlsRemote.length) return item.imageUrlsRemote;
  if (item.imageUrl) return [item.imageUrl];
  return [];
}

export function scoreLines(item: Listing) {
  const hideDistanceReasons = (lines: string[]) => lines.filter((line) => !/^Trajet\b/i.test(String(line).trim()));
  if (Array.isArray(item.scoreBreakdown) && item.scoreBreakdown.length) return hideDistanceReasons(item.scoreBreakdown);
  if (!item.scoreTooltip) return [];
  return String(item.scoreTooltip)
    .split(/[|·]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^score\s*:/i.test(line))
    .filter((line) => !/^Trajet\b/i.test(line));
}

export function scorePercent(item: Listing) {
  const raw = Number(item.score ?? 0);
  return Math.max(0, Math.min(100, raw));
}

export function publishedMeta(item: Listing) {
  const parseDays = (iso: string | null | undefined) => {
    if (!iso) return null;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return null;
    return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
  };

  const publishedDays = parseDays(item.publishedAt);
  if (publishedDays != null) return { days: publishedDays, approximate: false, iso: item.publishedAt || null };

  const discoveredDays = parseDays(item.firstSeenAt);
  if (discoveredDays != null) return { days: discoveredDays, approximate: true, iso: item.firstSeenAt || null };

  return { days: null, approximate: false, iso: null };
}

export function publishedLabel(item: Listing) {
  const meta = publishedMeta(item);
  if (meta.days == null) return 'N/A';
  return meta.approximate ? `${meta.days} j*` : `${meta.days} j`;
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

  const status = item.status || 'À contacter';
  if (DONE_STATUSES.has(status)) return { level: 'done' as const, label: 'Clos' };
  if (status === 'Sans réponse' || status === 'Relance') return { level: 'high' as const, label: 'Relance' };

  const refIso = item.updatedAt || item.firstSeenAt || item.lastSeenAt;
  const ageHours = refIso ? (Date.now() - new Date(refIso).getTime()) / 3600000 : 0;

  if (status === 'À contacter') {
    if (ageHours > 18) return { level: 'high' as const, label: 'Urgent' };
    if (ageHours > 8) return { level: 'medium' as const, label: 'Suivi' };
  }

  if (status === 'Visite') {
    if (ageHours > 36) return { level: 'high' as const, label: 'Relance' };
    if (ageHours > 18) return { level: 'medium' as const, label: 'Suivi' };
  }

  if (status === 'Dossier') {
    if (ageHours > 24) return { level: 'high' as const, label: 'Urgent' };
    if (ageHours > 12) return { level: 'medium' as const, label: 'Suivi' };
  }

  return { level: 'low' as const, label: 'OK' };
}

export function listingTitle(item: Listing) {
  return item.objectType || item.title || 'Annonce';
}
