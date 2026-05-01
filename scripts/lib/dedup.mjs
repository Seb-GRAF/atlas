// Dedup helpers extracted from scrape-immobilier.mjs.
// Pure functions, no I/O — easy to unit-test.

const SOURCE_PRIORITY = {
  'immobilier.ch': 30,
  'naef.ch': 27,
  'bernard-nicod.ch': 26,
  'flatfox.ch': 20,
  'retraitespopulaires.ch': 18,
  'anibis.ch': 15
};

const SWISS_CANTON_CODES = new Set([
  'ag', 'ai', 'ar', 'be', 'bl', 'bs', 'fr', 'ge', 'gl', 'gr',
  'ju', 'lu', 'ne', 'nw', 'ow', 'sg', 'sh', 'so', 'sz', 'tg',
  'ti', 'ur', 'vd', 'vs', 'zg', 'zh'
]);

// French street type abbreviations -> canonical form. Eliminates the most
// common false-negative where the same flat is published as "Av. de la Gare"
// on one source and "Avenue de la Gare" on another.
const STREET_ABBREVIATIONS = [
  [/\b(av|ave)\b\.?/g, 'avenue'],
  [/\b(bd|blvd|boul)\b\.?/g, 'boulevard'],
  [/\bch\b\.?/g, 'chemin'],
  [/\brte\b\.?/g, 'route'],
  [/\bpl\b\.?/g, 'place'],
  [/\bimp\b\.?/g, 'impasse'],
  [/\br\b\.?/g, 'rue']
];

function normalizeKeyText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalizeStreetWords(text = '') {
  let out = String(text || '');
  for (const [pattern, replacement] of STREET_ABBREVIATIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function normalizeAreaToken(value = '') {
  let token = normalizeKeyText(value)
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bde\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = token.split(' ');
  if (parts.length > 1 && SWISS_CANTON_CODES.has(parts[parts.length - 1])) {
    parts.pop();
    token = parts.join(' ');
  }
  return token;
}

function extractSwissPostalCode(item) {
  const sources = [item?.address, item?.area].filter(Boolean);
  for (const text of sources) {
    const m = String(text).match(/\b(\d{4})\b/);
    if (m) return m[1];
  }
  return null;
}

function toPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFlatfoxPriceFromText(text = '') {
  const m = String(text || '').match(/CHF\s*([\d''\s.,]+)/i);
  if (!m) return null;
  const cleaned = String(m[1] || '').replace(/[\s']/g, '').replace(',', '.');
  const n = Number(cleaned);
  return toPositiveNumber(n);
}

export function buildAddressDedupKey(item) {
  const rawAddress = String(item?.address || '').trim();
  const areaKey = normalizeAreaToken(item?.area || '');

  const normalizedParts = rawAddress
    .split(',')
    .map((part) => {
      const normalized = normalizeKeyText(part);
      const canonical = canonicalizeStreetWords(normalized);
      return canonical
        .replace(/\b\d{4}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    })
    .filter(Boolean);

  if (areaKey && !normalizedParts.some((part) => part === areaKey)) {
    normalizedParts.push(areaKey);
  }

  normalizedParts.sort();
  return normalizedParts.join('|');
}

export function buildCrossSourceDedupKey(item) {
  if (item?.dedupDisabled === true) return null;

  const address = buildAddressDedupKey(item);
  if (!address) return null;

  const rooms = Number.isFinite(Number(item?.rooms)) ? String(Math.floor(Number(item.rooms))) : 'na';
  const surface = Number.isFinite(Number(item?.surfaceM2))
    ? String(Math.round(Number(item.surfaceM2) / 5) * 5)
    : 'na';
  const price = Number.isFinite(Number(item?.totalChf)) && Number(item?.totalChf) > 0
    ? String(Math.round(Number(item.totalChf) / 50) * 50)
    : 'na';

  if (rooms === 'na' && surface === 'na' && price === 'na') return null;

  return `${address}|r:${rooms}|s:${surface}|p:${price}`;
}

// Same as buildCrossSourceDedupKey but with the surface slot fixed to "any".
// Used by the surfaceless fallback pass to merge entries where one side
// (typically Bernard-Nicod cards) lacks m². Returns null if address is empty
// or rooms+price are both missing — same guard as the primary key.
export function buildSurfacelessDedupKey(item) {
  if (item?.dedupDisabled === true) return null;

  const address = buildAddressDedupKey(item);
  if (!address) return null;

  const rooms = Number.isFinite(Number(item?.rooms)) ? String(Math.floor(Number(item.rooms))) : 'na';
  const price = Number.isFinite(Number(item?.totalChf)) && Number(item?.totalChf) > 0
    ? String(Math.round(Number(item.totalChf) / 50) * 50)
    : 'na';

  if (rooms === 'na' && price === 'na') return null;

  return `${address}|r:${rooms}|s:any|p:${price}`;
}

function hasBlankSurface(item) {
  const n = Number(item?.surfaceM2);
  return !Number.isFinite(n) || n <= 0;
}

export function listingQualityRank(item, trackerMap) {
  let rank = 0;

  if (trackerMap?.has(String(item?.id))) rank += 1000;
  rank += SOURCE_PRIORITY[item?.source] || 0;
  rank += Math.min(Array.isArray(item?.imageUrls) ? item.imageUrls.length : 0, 6);
  if (toPositiveNumber(item?.surfaceM2) != null) rank += 2;
  if (toPositiveNumber(item?.totalChf) != null) rank += 2;
  if (parseFlatfoxPriceFromText(item?.priceRaw || '') != null) rank += 1;

  return rank;
}

function mergeDuplicate(byKey, key, item, trackerMap, removedIds) {
  const existing = byKey.get(key);
  if (!existing) {
    byKey.set(key, { ...item, duplicateSources: [item.source] });
    return;
  }
  const keepIncoming = listingQualityRank(item, trackerMap) > listingQualityRank(existing, trackerMap);
  const loser = keepIncoming ? existing : item;
  const winner = keepIncoming ? { ...item } : { ...existing };
  const combined = new Set([
    ...(Array.isArray(existing.duplicateSources) ? existing.duplicateSources : [existing.source]),
    item.source,
    winner.source
  ]);
  winner.duplicateSources = [...combined];
  byKey.set(key, winner);
  if (loser.id && String(loser.id) !== String(winner.id)) {
    removedIds.add(String(loser.id));
  }
}

export function dedupeCrossSourceListings(items = [], trackerMap) {
  // Two-pass: first bucket by base key (address|rooms|surface|price), then
  // split any bucket whose members carry distinct Swiss postal codes. This
  // way [withPostal, noPostal] still merges (no signal to separate), but
  // [postal=1003, postal=1008] correctly splits into two listings.
  const buckets = new Map();
  const passthrough = [];
  const removedIds = new Set();

  for (const item of items) {
    if (item?.anibisSearchUrlMatch === true) {
      passthrough.push({ ...item, duplicateSources: [item.source] });
      continue;
    }
    const key = buildCrossSourceDedupKey(item);
    if (!key) {
      passthrough.push({ ...item, duplicateSources: [item.source] });
      continue;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }

  const byKey = new Map();
  for (const [baseKey, group] of buckets.entries()) {
    if (group.length === 1) {
      byKey.set(baseKey, { ...group[0], duplicateSources: [group[0].source] });
      continue;
    }
    const distinctPostals = new Set(group.map(extractSwissPostalCode).filter(Boolean));
    const useSubKey = distinctPostals.size > 1;
    for (const item of group) {
      const postal = extractSwissPostalCode(item);
      const key = useSubKey && postal ? `${baseKey}|z:${postal}` : baseKey;
      mergeDuplicate(byKey, key, item, trackerMap, removedIds);
    }
  }

  // Surfaceless fallback pass: merge blank-surface entries (typically BN cards)
  // into matching entries with a populated surface, when address+rooms+price
  // already match. We re-key each kept entry as `address|rooms|s:any|price`
  // and look for groups containing both "blank" and "populated" siblings.
  // Postal-code split still applies inside the surfaceless space.
  const surfacelessGroups = new Map();
  const keyByEntryRef = new Map();
  for (const [exactKey, entry] of byKey.entries()) {
    const sKey = buildSurfacelessDedupKey(entry);
    if (!sKey) continue;
    keyByEntryRef.set(entry, exactKey);
    if (!surfacelessGroups.has(sKey)) surfacelessGroups.set(sKey, []);
    surfacelessGroups.get(sKey).push(entry);
  }

  for (const [, group] of surfacelessGroups.entries()) {
    if (group.length < 2) continue;
    const blanks = group.filter(hasBlankSurface);
    const populated = group.filter((g) => !hasBlankSurface(g));
    if (blanks.length === 0 || populated.length === 0) continue;

    // Postal-code split inside the surfaceless space: a blank can only merge
    // into a populated sibling that shares its postal code (when both have
    // one). If the blank has no postal, it's free to merge.
    for (const blank of blanks) {
      const blankPostal = extractSwissPostalCode(blank);
      const eligible = populated.filter((p) => {
        const pPostal = extractSwissPostalCode(p);
        if (blankPostal && pPostal && blankPostal !== pPostal) return false;
        return true;
      });
      if (eligible.length === 0) continue;

      // Tie-break on closest price, then highest quality rank.
      const blankPrice = Number(blank?.totalChf);
      const winnerPick = eligible
        .map((p) => ({
          entry: p,
          priceDelta: Number.isFinite(Number(p.totalChf)) && Number.isFinite(blankPrice)
            ? Math.abs(Number(p.totalChf) - blankPrice)
            : Number.POSITIVE_INFINITY,
          rank: listingQualityRank(p, trackerMap)
        }))
        .sort((a, b) => a.priceDelta - b.priceDelta || b.rank - a.rank)[0]
        .entry;

      const blankKey = keyByEntryRef.get(blank);
      const winnerKey = keyByEntryRef.get(winnerPick);
      if (!blankKey || !winnerKey || blankKey === winnerKey) continue;

      const blankRank = listingQualityRank(blank, trackerMap);
      const winnerRank = listingQualityRank(winnerPick, trackerMap);
      const keepBlank = blankRank > winnerRank;
      const keepEntry = keepBlank ? blank : winnerPick;
      const dropEntry = keepBlank ? winnerPick : blank;
      const keepEntryKey = keepBlank ? blankKey : winnerKey;
      const dropEntryKey = keepBlank ? winnerKey : blankKey;

      const combined = new Set([
        ...(Array.isArray(keepEntry.duplicateSources) ? keepEntry.duplicateSources : [keepEntry.source]),
        ...(Array.isArray(dropEntry.duplicateSources) ? dropEntry.duplicateSources : [dropEntry.source])
      ]);
      const merged = { ...keepEntry, duplicateSources: [...combined] };
      byKey.set(keepEntryKey, merged);
      byKey.delete(dropEntryKey);
      keyByEntryRef.set(merged, keepEntryKey);
      // Mark the dropped entry's id as removed (only when ids actually differ).
      if (dropEntry.id && String(dropEntry.id) !== String(keepEntry.id)) {
        removedIds.add(String(dropEntry.id));
      }
    }
  }

  const kept = [...byKey.values(), ...passthrough];
  return { kept, removedIds };
}

// Compact "stub" form for entries we no longer want to keep full payloads on
// (cross-source dedup losers, criteria-filtered entries). Just enough to:
// - suppress re-discovery on next scan (id + dedupKey),
// - remember why it was filtered (filterReason),
// - allow time-based pruning (timestamps).
export function toDiscardedStub(item) {
  if (!item || typeof item !== 'object') return null;
  const dedupKey = buildCrossSourceDedupKey(item);
  const stub = {
    id: String(item.id),
    dedupKey: dedupKey ?? null,
    filterReason: item.filterReason ?? '',
    firstSeenAt: item.firstSeenAt ?? null,
    lastSeenAt: item.lastSeenAt ?? null,
    isStub: true
  };
  if (item.isRemoved) {
    stub.isRemoved = true;
    stub.removedAt = item.removedAt ?? null;
  } else {
    stub.display = false;
  }
  return stub;
}

export function isStub(entry) {
  return !!(entry && typeof entry === 'object' && entry.isStub === true);
}

// Used for testing alone; exported so callers can verify intent.
export const __internal = { normalizeKeyText, normalizeAreaToken, canonicalizeStreetWords, extractSwissPostalCode };
