#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  buildTransitRouteOverlay,
  buildTransitLocationCacheKey,
  buildDriveCacheKey,
  clearCommuteFields,
  clearedCommuteFields,
  formatTransitLocation,
  formatMinutesText,
  getCachedRoute,
  normalizeTransitConnection,
  parseTransportDurationToMinutes,
  projectRetainedCommuteFields,
  resolveTransitReference,
  setCachedRoute,
  setCommuteFailureFields,
  setCommuteSuccessFields,
  toDurationMinutesOrNull
} from './lib/commute.mjs';
import { geocodeAddress as geocodeSwissAddress, reverseGeocode as reverseGeocodeAddress } from './lib/geocode.mjs';
import {
  buildAddressDedupKey,
  buildCrossSourceDedupKey,
  dedupeCrossSourceListings,
  isStub,
  listingQualityRank,
  toDiscardedStub
} from './lib/dedup.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const LEGACY_DATA_DIR = path.join(ROOT, 'data');
const PROFILES_DATA_DIR = path.join(LEGACY_DATA_DIR, 'profiles');
const DEFAULT_WORK_ADDRESS = 'Gare de Fribourg, 1700 Fribourg, Suisse';
const DEFAULT_PROFILE = 'vaud-3-pieces';
const TRAVEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function sanitizeProfile(value = DEFAULT_PROFILE) {
  const clean = String(value || DEFAULT_PROFILE).trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(clean) ? clean : DEFAULT_PROFILE;
}

function parseProfileFromArgv(argv = process.argv.slice(2)) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || '');
    if (arg.startsWith('--profile=')) {
      return arg.slice('--profile='.length);
    }
    if (arg === '--profile') {
      return argv[i + 1] || DEFAULT_PROFILE;
    }
  }
  return null;
}

function profilePaths(profile) {
  const dataDir = path.join(PROFILES_DATA_DIR, profile);
  return {
    dataDir,
    configPath: path.join(dataDir, 'watch-config.json'),
    trackerPath: path.join(dataDir, 'tracker.json'),
    latestPath: path.join(dataDir, 'latest-listings.json'),
    geocodeCachePath: path.join(dataDir, 'geocode-cache.json'),
    routeCachePath: path.join(dataDir, 'route-cache.json')
  };
}

const PROFILE = sanitizeProfile(process.env.APART_PROFILE || process.env.APARTMENT_PROFILE || parseProfileFromArgv() || DEFAULT_PROFILE);
const {
  dataDir: DATA_DIR,
  configPath: CONFIG_PATH,
  trackerPath: TRACKER_PATH,
  latestPath: LATEST_PATH,
  geocodeCachePath: GEOCODE_CACHE_PATH,
  routeCachePath: ROUTE_CACHE_PATH
} = profilePaths(PROFILE);

const STATUS_WORKFLOW_VERSION = 2;
const STATUSES = [
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
const PROGRESS_PREFIX = '__SCAN_PROGRESS__';
const PROGRESS_ENABLED = process.env.SCAN_PROGRESS === '1';
const SOURCE_PRIORITY = {
  'immobilier.ch': 30,
  'naef.ch': 27,
  'bernard-nicod.ch': 26,
  'flatfox.ch': 20,
  'retraitespopulaires.ch': 18,
  'anibis.ch': 15
};

function emitProgress(payload) {
  if (!PROGRESS_ENABLED) return;
  console.log(`${PROGRESS_PREFIX}${JSON.stringify({ ...payload, at: new Date().toISOString() })}`);
}

const DEFAULT_NON_SPECULATIVE_GROUPS = [];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const IMAGE_EXT_BY_CONTENT_TYPE = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif'
};

function decodeHtml(input = '') {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function stripTags(html = '') {
  return decodeHtml(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function isHttpUrl(value = '') {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function imageExtFromUrl(value = '') {
  try {
    const pathname = new URL(String(value || '')).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext) ? ext : '';
  } catch {
    return '';
  }
}

function imageExtFromContentType(value = '') {
  const raw = String(value || '').toLowerCase().split(';')[0].trim();
  return IMAGE_EXT_BY_CONTENT_TYPE[raw] || '';
}

async function fetchBinary(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: 'image/*,*/*;q=0.8'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || '';
  return { buffer: buf, contentType };
}

async function findExistingImageFile(baseNoExt = '') {
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = `${baseNoExt}${ext}`;
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

function toLocalImageWebPath(filePath = '') {
  const rel = path.relative(LEGACY_DATA_DIR, filePath).split(path.sep).join('/');
  return `/data/${rel}`;
}

function uniqueStrings(values = []) {
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const value = String(raw || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function preferLargerImageUrl(value = '') {
  const clean = String(value || '').trim();
  if (!isHttpUrl(clean)) return clean;

  try {
    const url = new URL(clean);
    const host = url.hostname.toLowerCase();

    if (host.endsWith('immobilier.ch')) {
      url.pathname = url.pathname.replace(/\/images\/NewThumbnail\//i, '/images/full/');
      return url.toString();
    }

    if (host === 'cdn.flatfox.ch') {
      url.pathname = url.pathname.replace(/^\/t_(?:listing_card_\d+x\d+|size_[a-z])\//i, '/');
      return url.toString();
    }

    if (host === 'c.anibis.ch') {
      url.pathname = url.pathname.replace(/^\/thumbnail\//i, '/big/');
      return url.toString();
    }
  } catch {
    return clean;
  }

  return clean;
}

function preferLargerImageUrls(values = []) {
  return uniqueStrings(values.map((value) => preferLargerImageUrl(value)));
}

function localImageUrlsFromItem(item = {}) {
  return uniqueStrings([
    ...(Array.isArray(item?.imageUrlsLocal) ? item.imageUrlsLocal : []),
    ...((Array.isArray(item?.imageUrls) ? item.imageUrls : []).filter((x) => !isHttpUrl(x))),
    ...(!isHttpUrl(item?.imageUrl) && item?.imageUrl ? [item.imageUrl] : [])
  ]);
}

function remoteImageUrlsFromItem(item = {}) {
  const explicit = uniqueStrings(Array.isArray(item?.imageUrlsRemote) ? item.imageUrlsRemote : []);
  if (explicit.length) return preferLargerImageUrls(explicit.filter((x) => isHttpUrl(x)));

  return preferLargerImageUrls([
    ...((Array.isArray(item?.imageUrls) ? item.imageUrls : []).filter((x) => isHttpUrl(x))),
    ...(isHttpUrl(item?.imageUrl) ? [item.imageUrl] : [])
  ]);
}

function applyListingImageFields(item = {}, { localUrls = [], remoteUrls = [] } = {}) {
  const local = uniqueStrings(localUrls);
  const remote = preferLargerImageUrls(remoteUrls.filter((x) => isHttpUrl(x)));
  const display = local.length ? local : remote;

  item.imageUrlsLocal = local;
  item.imageUrlsRemote = remote;
  item.imageUrls = display;
  item.imageUrl = display[0] || null;
}

function normalizeListingImageFields(listings = []) {
  if (!Array.isArray(listings)) return;
  for (const item of listings) {
    applyListingImageFields(item, {
      localUrls: localImageUrlsFromItem(item),
      remoteUrls: remoteImageUrlsFromItem(item)
    });
  }
}

function resolveMaxArchivedImagesPerListing(config = {}) {
  const value = Number(config?.media?.maxArchivedImagesPerListing ?? 5);
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(12, Math.trunc(value)));
}

async function localizeVisibleListingImages(listings = [], config = {}) {
  if (!Array.isArray(listings) || !listings.length) return;

  const imagesDir = path.join(DATA_DIR, 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  const urlToLocal = new Map();
  const maxPerListing = resolveMaxArchivedImagesPerListing(config);

  for (const item of listings) {
    const preservedLocal = localImageUrlsFromItem(item);
    const remoteUrls = remoteImageUrlsFromItem(item).slice(0, maxPerListing);

    if (!remoteUrls.length) {
      applyListingImageFields(item, { localUrls: preservedLocal, remoteUrls: [] });
      continue;
    }

    const localized = [];

    for (const sourceUrl of remoteUrls) {
      if (urlToLocal.has(sourceUrl)) {
        localized.push(urlToLocal.get(sourceUrl));
        continue;
      }

      const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 24);
      const baseNoExt = path.join(imagesDir, hash);

      try {
        const existing = await findExistingImageFile(baseNoExt);
        if (existing) {
          const localPath = toLocalImageWebPath(existing);
          urlToLocal.set(sourceUrl, localPath);
          localized.push(localPath);
          continue;
        }

        const { buffer, contentType } = await fetchBinary(sourceUrl);
        const ext = imageExtFromUrl(sourceUrl) || imageExtFromContentType(contentType) || '.jpg';
        const filePath = `${baseNoExt}${ext}`;
        await fs.writeFile(filePath, buffer);

        const localPath = toLocalImageWebPath(filePath);
        urlToLocal.set(sourceUrl, localPath);
        localized.push(localPath);
      } catch {
        // Keep the remote URL as fallback if archiving fails.
      }
    }

    applyListingImageFields(item, {
      localUrls: [...localized, ...preservedLocal].slice(0, maxPerListing),
      remoteUrls
    });
  }
}

function chfToNumber(str = '') {
  const cleaned = str.replace(/[^0-9]/g, '');
  return cleaned ? Number(cleaned) : null;
}

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sanitizeTravelText(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  const m = text.match(/(\d+)/);
  if (!m) return text;
  return Number(m[1]) > 0 ? text : '';
}

function publishedAgeDays(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function resolveMaxPublishedAgeDays(config) {
  const val = config?.filters?.maxPublishedAgeDays;
  if (val === null || val === undefined || val === '') return 30;
  const explicit = Number(val);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return 30;
}

function publicationEligibility(item, config) {
  const maxAgeDays = resolveMaxPublishedAgeDays(config);
  const ageDays = publishedAgeDays(item?.publishedAt);

  if (maxAgeDays == null) {
    return { eligible: true, ageDays, maxAgeDays: null };
  }

  if (ageDays == null) {
    return { eligible: true, ageDays: null, maxAgeDays };
  }

  return {
    eligible: ageDays <= maxAgeDays,
    ageDays,
    maxAgeDays
  };
}

function locationEligibility() {
  return { eligible: true, reason: '' };
}

function parseRooms(text = '') {
  // Try specific "X pièce(s)" / "X½ pièces" / "X Zimmer" patterns first
  const specific = text.match(/(\d+(?:[.,½]\d*)?)\s*(?:½\s*)?(?:pi[eè]ces?|zimmer|rooms?|½)/i);
  if (specific) {
    return Number(specific[1].replace(',', '.').replace('½', '.5'));
  }
  // Try "X.5" or "X,5" standalone (common Swiss format like "3.5" or "2,5")
  const decimal = text.match(/\b(\d+[.,]5)\b/);
  if (decimal) {
    return Number(decimal[1].replace(',', '.'));
  }
  return null;
}

function slugToTitle(href = '') {
  const withoutQuery = href.split('?')[0];
  const bits = withoutQuery.split('/').filter(Boolean);
  const tail = bits[bits.length - 1] || '';
  const noId = tail.replace(/-\d+$/, '');
  return noId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function extractAreaAfterSwissZip(value = '') {
  const m = String(value || '').match(/\b\d{4}\s+(.+)$/);
  if (!m?.[1]) return '';
  return String(m[1]).split(',')[0].trim();
}

function inferAreaFromAddress(address = '', fallback = '') {
  const parts = String(address || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return fallback;

  const first = parts[0];
  if (!/\d/.test(first)) return first;

  const withZip = parts.find((p) => /\b\d{4}\b/.test(p));
  if (withZip) {
    const city = extractAreaAfterSwissZip(withZip);
    if (city) return city;
  }

  return fallback;
}

function inferAreaFromAddressStrict(address = '') {
  const parts = String(address || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return '';

  const first = parts[0];
  if (!/\d/.test(first)) return first;

  const withZip = parts.find((p) => /\b\d{4}\b/.test(p));
  if (withZip) {
    const city = extractAreaAfterSwissZip(withZip);
    if (city) return city;
  }

  return '';
}

function parsePrice(raw = '') {
  const text = stripTags(raw);
  const rentMatch = text.match(/CHF\s*([\d'\s]+)\.?-?\/?mois/i);
  const chargesMatch = text.match(/\(\+\s*([\d'\s]+)\.?-?\s*charges\)/i);
  const rentChf = rentMatch ? chfToNumber(rentMatch[1]) : null;
  const chargesChf = chargesMatch ? chfToNumber(chargesMatch[1]) : 0;
  const totalChf = rentChf != null ? rentChf + (chargesChf || 0) : null;
  return { priceRaw: text, rentChf, chargesChf, totalChf };
}

function toAbsoluteUrl(value = '') {
  const clean = decodeHtml(value || '');
  if (!clean) return null;
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (clean.startsWith('/')) return `https://www.immobilier.ch${clean}`;
  return `https://www.immobilier.ch/${clean}`;
}

function toAbsoluteUrlForHost(value = '', host = '') {
  const clean = decodeHtml(value || '');
  if (!clean) return null;
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  const base = String(host || '').replace(/\/$/, '');
  if (!base) return clean;
  if (clean.startsWith('/')) return `${base}${clean}`;
  return `${base}/${clean}`;
}

function isLikelyResidentialListing(item = {}) {
  const text = `${item.objectType || ''} ${item.title || ''}`.toLowerCase();
  const url = String(item?.url || '').toLowerCase();

  if (/\/location\/(parking|local|commerce|bureau|terrain)\//i.test(url)) return false;
  if (/parking|garage|place de parc|place ouverte|d[eé]pot|surface commerciale|bureau|commerce|arcade|terrain|atelier/.test(text)) {
    return false;
  }

  if (/appartement|studio|loft|duplex|attique|maison|pi[eè]ces?/.test(text)) return true;

  const rooms = toPositiveNumber(item?.rooms);
  return rooms != null && rooms > 0;
}

function isExcludedType(item, config) {
  const text = `${item.objectType || ''} ${item.title || ''}`.toLowerCase();
  const keywords = config.filters?.excludedObjectTypeKeywords || ['chambre', 'colocation', 'wg'];
  return keywords.some((k) => text.includes(String(k).toLowerCase()));
}

function isSizeEligible(item, config) {
  const minRooms = Number(config.filters?.minRoomsPreferred ?? 2);
  const maxRoomsRaw = config.filters?.maxRoomsPreferred;
  const maxRooms = maxRoomsRaw == null || maxRoomsRaw === '' ? Infinity : Number(maxRoomsRaw);
  const minSurface = Number(config.filters?.minSurfaceM2Preferred ?? 0);
  const minSurfaceFallback = Number(config.filters?.minSurfaceM2Fallback ?? 0);
  const allowMissingSurface = config.filters?.allowMissingSurface !== false;

  const rooms = Number(item.rooms ?? 0);
  const surface = Number(item.surfaceM2 ?? 0);
  const hasSurface = Number.isFinite(item.surfaceM2) && item.surfaceM2 > 0;

  if (!Number.isFinite(rooms) || rooms <= 0) {
    return false;
  }

  if (Number.isFinite(maxRooms) && rooms > maxRooms) return false;

  const meetsRooms = rooms >= minRooms;

  // If minSurfaceFallback is set, use OR logic: rooms >= minRooms OR surface >= fallback
  if (minSurfaceFallback > 0) {
    const surfaceFallbackOk = hasSurface && surface >= minSurfaceFallback;
    if (meetsRooms || surfaceFallbackOk) return true;
    return false;
  }

  if (!meetsRooms) return false;

  if (!Number.isFinite(minSurface) || minSurface <= 0) return true;

  // If surface is missing, defer to allowMissingSurface setting
  if (!hasSurface) return allowMissingSurface;

  return surface >= minSurface;
}

function normalizeStatus(status = '') {
  const s = String(status || '').trim();

  if (!s || s === 'À trier') return 'À trier';
  if (s === 'À contacter') return 'À contacter';
  if (['Sauvegardé', 'Gardée'].includes(s)) return 'À contacter';
  if (['Contacté', 'Contactée'].includes(s)) return 'Contacté';
  if (['Visite', 'Visite demandée', 'Visite planifiée', 'Visité', 'Visite prévue'].includes(s)) return 'Visite prévue';
  if (['Dossier', 'Dossier prêt à envoyer', 'Dossier à envoyer'].includes(s)) return 'Dossier à envoyer';
  if (s === 'Dossier envoyé') return 'Dossier envoyé';
  if (['Relance', 'Relance J+2', 'Sans réponse', 'Relance à faire'].includes(s)) return 'Relance à faire';
  if (['Refusé', 'Écartée'].includes(s)) return 'Écartée';
  if (s === 'Refus régie') return 'Refus régie';
  if (s === 'Accepté') return 'Accepté';

  return 'À trier';
}

function normalizeLegacyStatus(status = '') {
  const s = String(status || '').trim();
  if (!s || s === 'À contacter') return 'À trier';
  return normalizeStatus(s);
}

function migrateTrackerStatuses(tracker) {
  if (!tracker || typeof tracker !== 'object') return tracker;
  const legacy = Number(tracker.statusWorkflowVersion || 1) < STATUS_WORKFLOW_VERSION;
  const normalize = legacy ? normalizeLegacyStatus : normalizeStatus;

  if (Array.isArray(tracker.listings)) {
    for (const item of tracker.listings) {
      item.status = normalize(item.status);
    }
  }

  tracker.statuses = STATUSES;
  tracker.statusWorkflowVersion = STATUS_WORKFLOW_VERSION;
  return tracker;
}

function normalizeDateParts(day, month, year) {
  const d = Number(day);
  const m = Number(month);
  let y = Number(year);

  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null;
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;
  if (y < 100) y += 2000;
  if (y !== 2026) return null;

  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

function isStrictEntryDate(v = '') {
  return /^\d{2}\.\d{2}\.2026$/.test(String(v || '').trim());
}

function parseDateFromText(text = '') {
  const t = String(text || '').toLowerCase();
  if (!t) return null;

  const numeric = t.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (numeric) {
    const date = normalizeDateParts(numeric[1], numeric[2], numeric[3]);
    if (date) return date;
  }

  const monthMap = {
    janvier: 1,
    fevrier: 2,
    février: 2,
    mars: 3,
    avril: 4,
    mai: 5,
    juin: 6,
    juillet: 7,
    aout: 8,
    août: 8,
    septembre: 9,
    octobre: 10,
    novembre: 11,
    decembre: 12,
    décembre: 12
  };

  const named = t.match(/(\d{1,2})(?:er)?\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})/i);
  if (named) {
    const month = monthMap[named[2].toLowerCase()];
    const date = normalizeDateParts(named[1], month, named[3]);
    if (date) return date;
  }

  return null;
}

function extractMoveInDateFromAdditionalInfo(text = '') {
  const clean = stripTags(String(text || '')).replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  if (!/(date\s+d['']?entr(?:é|e)e|disponibilit(?:é|e)|disponible|a\s+partir|à\s+partir)/i.test(clean)) {
    return null;
  }

  return parseDateFromText(clean);
}

function parseMoveInDateFromObjectApi(payload) {
  const extraProperties = Array.isArray(payload?.extraProperties) ? payload.extraProperties : [];

  for (const line of extraProperties) {
    const date = extractMoveInDateFromAdditionalInfo(line);
    if (isStrictEntryDate(date)) return date;
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLimited(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(Number(limit || 1), items.length || 1));

  async function runWorker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

function sanitizeAddressPart(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bCH-\d{4}\b/gi, ' ')
    .replace(/\bVD\b/gi, ' ')
    .trim();
}

function buildListingAddressQuery(item) {
  const addressRaw = sanitizeAddressPart(item.address || '');
  const area = sanitizeAddressPart(item.area || '');

  if (addressRaw) {
    return [addressRaw, 'Suisse'].filter(Boolean).join(', ');
  }

  if (area) {
    return [area, 'Suisse'].filter(Boolean).join(', ');
  }

  return '';
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return 6371 * c;
}

async function fetchDrivingMinutes(workCoords, listingCoords, routeCache) {
  if (!workCoords || !listingCoords) return { minutes: null, status: 'missing-address' };

  const key = buildDriveCacheKey(listingCoords, workCoords);
  const cached = getCachedRoute(routeCache, key, TRAVEL_CACHE_TTL_MS);
  if (cached.fresh && cached.minutes != null) {
    return { minutes: cached.minutes, status: 'ok' };
  }

  try {
    const payload = await fetchJson(
      `https://router.project-osrm.org/route/v1/driving/${listingCoords.lon},${listingCoords.lat};${workCoords.lon},${workCoords.lat}?overview=false`
    );

    const seconds = Number(payload?.routes?.[0]?.duration);
    const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
    setCachedRoute(routeCache, key, { minutes, route: null, status: minutes == null ? 'route-failed' : 'ok' });
    return { minutes, status: minutes == null ? 'route-failed' : 'ok' };
  } catch (err) {
    if (cached.hasValue) return { minutes: cached.minutes, status: 'cached-stale' };
    return { minutes: null, status: 'route-failed', error: err.message };
  }
}

function buildFootRouteCacheKey(fromLngLat, toLngLat) {
  return `foot:${fromLngLat[0].toFixed(5)},${fromLngLat[1].toFixed(5)}->${toLngLat[0].toFixed(5)},${toLngLat[1].toFixed(5)}`;
}

async function fetchFootRoute(fromLngLat, toLngLat, routeCache) {
  if (!Array.isArray(fromLngLat) || !Array.isArray(toLngLat)) return null;

  const key = buildFootRouteCacheKey(fromLngLat, toLngLat);
  const cached = getCachedRoute(routeCache, key, TRAVEL_CACHE_TTL_MS);
  if (cached.fresh) {
    if (Array.isArray(cached.route) && cached.route.length >= 2) return cached.route;
    if (cached.entry?.status === 'route-failed') return null;
  }

  try {
    const payload = await fetchJson(
      `https://router.project-osrm.org/route/v1/foot/${fromLngLat[0]},${fromLngLat[1]};${toLngLat[0]},${toLngLat[1]}?overview=full&geometries=geojson`
    );
    const coords = payload?.routes?.[0]?.geometry?.coordinates;
    const route = Array.isArray(coords) && coords.length >= 2 ? coords : null;
    setCachedRoute(routeCache, key, { minutes: null, route, status: route ? 'ok' : 'route-failed' });
    return route;
  } catch {
    return Array.isArray(cached.route) && cached.route.length >= 2 ? cached.route : null;
  }
}

async function fetchTransitRoute(workAddress, listingAddress, routeCache, workCoords = null, listingCoords = null) {
  if (!workAddress || !listingAddress) {
    return { minutes: null, route: null, status: 'missing-address' };
  }

  const transitRef = resolveTransitReference();
  const from = formatTransitLocation(listingCoords, listingAddress);
  const to = formatTransitLocation(workCoords, workAddress);
  const key = buildTransitLocationCacheKey(listingCoords, listingAddress, workCoords, workAddress);
  const cached = getCachedRoute(routeCache, key, TRAVEL_CACHE_TTL_MS);
  if (cached.fresh && cached.minutes != null) {
    return { minutes: cached.minutes, route: cached.route, status: 'ok' };
  }

  try {
    const url = new URL('https://transport.opendata.ch/v1/connections');
    url.searchParams.set('limit', '1');
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('date', transitRef.date);
    url.searchParams.set('time', transitRef.arrivalTime);
    url.searchParams.set('isArrivalTime', '1');

    const payload = await fetchJson(url.toString());
    const connection = payload?.connections?.[0] || null;
    const minutes = parseTransportDurationToMinutes(connection?.duration || '');
    const route = minutes == null ? null : normalizeTransitConnection(connection, transitRef);

    setCachedRoute(routeCache, key, {
      minutes,
      route,
      status: minutes == null ? 'route-failed' : 'ok'
    });

    return { minutes, route, status: minutes == null ? 'route-failed' : 'ok' };
  } catch (err) {
    if (cached.hasValue) {
      return { minutes: cached.minutes, route: cached.route, status: 'cached-stale' };
    }
    return { minutes: null, route: null, status: 'route-failed', error: err.message };
  }
}

async function geocodeAddress(query, geocodeCache) {
  return geocodeSwissAddress(query, geocodeCache, { fetchJson, sleep });
}

async function reverseGeocode(lat, lon, geocodeCache) {
  return reverseGeocodeAddress(lat, lon, geocodeCache, { fetchJson, sleep });
}

async function computeDistanceFromWork(item, workCoords, geocodeCache) {
  if (!workCoords) {
    return { computed: false, distanceKm: null, distanceText: '', listingAddress: '', listingCoords: null };
  }

  const listingAddress = buildListingAddressQuery(item);
  if (!listingAddress) {
    return { computed: false, distanceKm: null, distanceText: '', listingAddress: '', listingCoords: null };
  }

  const listingCoords = await geocodeAddress(listingAddress, geocodeCache);
  if (!listingCoords || typeof listingCoords !== 'object') {
    return { computed: false, distanceKm: null, distanceText: '', listingAddress, listingCoords: null };
  }

  const rawKm = haversineKm(workCoords, listingCoords);
  const distanceKm = Number(rawKm.toFixed(1));

  return {
    computed: true,
    distanceKm,
    distanceText: `${distanceKm.toFixed(1)} km`,
    listingAddress,
    listingCoords
  };
}

async function computeCommuteFromWork(item, workAddress, workCoords, geocodeCache, routeCache) {
  if (!item.display) {
    clearCommuteFields(item);
    return;
  }

  const distance = await computeDistanceFromWork(item, workCoords, geocodeCache);
  if (!distance.computed || !distance.listingCoords || !distance.listingAddress) {
    clearCommuteFields(item);
    setCommuteFailureFields(item, distance.listingAddress ? 'geocode-failed' : 'missing-address', 'Trajet indisponible: adresse non géocodée.');
    item.distanceFromWorkAddress = workAddress || '';
    return;
  }

  const [drive, transit] = await Promise.all([
    fetchDrivingMinutes(workCoords, distance.listingCoords, routeCache),
    fetchTransitRoute(workAddress, distance.listingAddress, routeCache, workCoords, distance.listingCoords)
  ]);
  const transitRouteOverlay = transit.route
    ? await buildTransitRouteOverlay(transit.route, {
        listingId: String(item.id),
        listingCoords: distance.listingCoords,
        workplaceCoords: workCoords,
        resolveFootRoute: (fromLngLat, toLngLat) => fetchFootRoute(fromLngLat, toLngLat, routeCache)
      })
    : null;

  setCommuteSuccessFields(item, {
    workAddress,
    distanceKm: distance.distanceKm,
    driveMinutes: drive.minutes,
    transitMinutes: transit.minutes,
    transitRoute: transit.route,
    transitRouteOverlay,
    driveStatus: drive.status,
    transitStatus: transit.status
  });

  const warnings = [];
  if (drive.status === 'cached-stale') warnings.push('Temps voiture issu du cache.');
  if (drive.status === 'route-failed') warnings.push('Temps voiture indisponible.');
  if (transit.status === 'cached-stale') warnings.push('Trajet public issu du cache.');
  if (transit.status === 'route-failed') warnings.push('Transport public indisponible.');
  item.commuteWarnings = warnings;
}

function mergeNotesWithEntryDate(notes = '', moveInDate = null) {
  const current = String(notes || '');

  if (!moveInDate) {
    return current.replace(/Entr(?:é|e)e\s*:[^\n]*/i, '').replace(/\n{2,}/g, '\n').trim();
  }

  const line = `Entrée : ${moveInDate}`;

  if (/Entr(?:é|e)e\s*:/i.test(current)) {
    return current.replace(/Entr(?:é|e)e\s*:[^\n]*/i, line).trim();
  }

  return current ? `${current}\n${line}`.trim() : line;
}

async function fetchMoveInDate(objectId) {
  if (!objectId) return { fetched: false, date: null };

  try {
    const payload = await fetchJson(`https://www.immobilier.ch/api/objects/${objectId}?lang=fr`);
    return {
      fetched: true,
      date: parseMoveInDateFromObjectApi(payload)
    };
  } catch {
    return { fetched: false, date: null };
  }
}

/**
 * Lightweight check: is the listing URL still returning a valid page?
 * Returns true if the listing appears to still be live (HTTP 200 on the
 * original host), false if clearly removed (404/410/redirect to homepage).
 * On network errors or ambiguous results, returns true (conservative —
 * don't remove what we can't confirm is gone).
 */
async function isListingUrlStillLive(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    // immobilier.ch SPA: HTML page always returns 200 even for removed listings.
    // Use the JSON API instead — removed listings have isVisible:"false".
    const immobilierMatch = url.match(/immobilier\.ch\/.*?(\d{6,})$/);
    if (immobilierMatch) {
      const objectId = immobilierMatch[1];
      try {
        const payload = await fetchJson(`https://www.immobilier.ch/api/objects/${objectId}?lang=fr`);
        if (payload && String(payload.isVisible) === 'false') {
          console.log(`INFO ${objectId}: immobilier.ch API reports isVisible=false → listing removed`);
          return false;
        }
        return true;
      } catch {
        // API error (404, network) — treat as removed since we know the page
        // shell persists even after removal
        return false;
      }
    }

    const result = await fetchHtmlWithRedirects(url, 3);
    const code = Number(result.statusCode || 0);
    if (code >= 400) return false;

    // Check if we were redirected to a generic page (homepage / search)
    const originalHost = new URL(url).hostname;
    const finalHost = new URL(result.finalUrl || url).hostname;
    if (finalHost !== originalHost) return false;

    const finalPath = new URL(result.finalUrl || url).pathname;
    // Redirected to homepage or generic search = listing removed
    if (finalPath === '/' || finalPath === '' || /^\/(search|recherche|louer|fr\/?)?$/i.test(finalPath)) {
      return false;
    }

    // Quick content sanity: if the response is very short or contains
    // typical "not found" markers, treat as removed
    const html = String(result.html || '');
    if (html.length < 500) return false;
    if (/cette annonce n.{0,5}existe plus|annonce retir|listing not found|page introuvable/i.test(html)) {
      return false;
    }

    return true;
  } catch {
    // Network error, timeout, HTTP 4xx/5xx thrown by fetchHtmlWithRedirects
    // Be conservative: don't remove if we can't reach the site
    return true;
  }
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          accept: 'text/html,application/xhtml+xml'
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} on ${url}`));
            return;
          }
          resolve(raw);
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error(`Timeout on ${url}`));
    });
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          accept: 'application/json,text/plain,*/*'
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} on ${url}`));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(new Error(`Invalid JSON on ${url}: ${err.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error(`Timeout on ${url}`));
    });
  });
}

function fetchHtmlWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          accept: 'text/html,application/xhtml+xml'
        }
      },
      async (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', async () => {
          const code = Number(res.statusCode || 0);

          if (code >= 300 && code < 400 && res.headers.location) {
            if (maxRedirects <= 0) {
              reject(new Error(`Too many redirects on ${url}`));
              return;
            }

            try {
              const nextUrl = new URL(res.headers.location, url).toString();
              const redirected = await fetchHtmlWithRedirects(nextUrl, maxRedirects - 1);
              resolve(redirected);
            } catch (err) {
              reject(err);
            }
            return;
          }

          if (code >= 400) {
            reject(new Error(`HTTP ${code} on ${url}`));
            return;
          }

          resolve({ html: raw, finalUrl: url, statusCode: code });
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error(`Timeout on ${url}`));
    });
  });
}

function shouldRetryAnibisRequest(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (!msg) return false;

  return [
    'timeout',
    'timed out',
    'econnreset',
    'socket hang up',
    'eai_again',
    'enotfound',
    '503',
    '502',
    '504'
  ].some((token) => msg.includes(token));
}

async function fetchHtmlWithRedirectsRetry(url, options = {}) {
  const attempts = Math.max(1, Number(options?.attempts ?? 3));
  const maxRedirects = Math.max(1, Number(options?.maxRedirects ?? 5));
  const baseDelayMs = Math.max(0, Number(options?.baseDelayMs ?? 1200));

  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchHtmlWithRedirects(url, maxRedirects);
    } catch (err) {
      lastError = err;

      const retryable = shouldRetryAnibisRequest(err);
      if (!retryable || attempt >= attempts) {
        throw err;
      }

      const waitMs = baseDelayMs * attempt;
      await sleep(waitMs);
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

function parseAnibisSearchDataFromHtml(html = '') {
  const nextDataMatch = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!nextDataMatch?.[1]) return null;

  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
    if (!Array.isArray(queries)) return null;

    const payload = queries.find((q) => JSON.stringify(q?.queryKey || '').includes('SearchListingsByConstraints'));
    return payload?.state?.data || null;
  } catch {
    return null;
  }
}

function parseAnibisPrice(formattedPrice = '') {
  const text = stripTags(String(formattedPrice || ''));
  if (!text || /sur\s+demande|gratis|gratuit/i.test(text)) return null;
  return toPositiveNumber(chfToNumber(text));
}

function parseAnibisSurfaceM2(...texts) {
  for (const text of texts) {
    const m = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*m(?:2|²)/i);
    if (m?.[1]) {
      const n = Number(m[1].replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function isAnibisRentalListing(raw, frSlug, title, description, formattedPriceText) {
  const haystack = normalizeKeyText([
    frSlug,
    title,
    description,
    raw?.body,
    raw?.title
  ].filter(Boolean).join(' '));

  const saleSignals = [
    'a vendre',
    'a-vendre',
    'vente',
    'acheter',
    'a acheter',
    'a-acheter'
  ];

  if (saleSignals.some((signal) => haystack.includes(signal))) {
    return false;
  }

  const rentalSignals = [
    'a louer',
    'a-louer',
    'location',
    'sous location',
    'sous-location',
    'reprise de bail',
    'reprise-de-bail'
  ];

  const hasRentalSignal = rentalSignals.some((signal) => haystack.includes(signal));
  const isMonthlyPrice = /\bpar\s+mois\b|\/\s*mois\b/i.test(formattedPriceText);

  return hasRentalSignal || isMonthlyPrice;
}

function parseAnibisListing(raw, fallbackAreaLabel = '', options = {}) {
  const sourceId = String(raw?.listingID || '').trim();
  if (!sourceId) return null;

  const categoryId = String(raw?.primaryCategory?.categoryID || '').toLowerCase();
  if (categoryId !== 'realestate') return null;

  const frSlug = String(raw?.seoInformation?.frSlug || '').trim();
  if (options.trustSearchUrlFilters) {
    if (!frSlug.includes('/immobilier/')) return null;
  } else if (!frSlug.includes('/immobilier/appartements/')) {
    return null;
  }

  const listingPath = frSlug.replace(/^\/+|\/+$/g, '');
  const url = listingPath ? `https://www.anibis.ch/fr/vi/${listingPath}/${sourceId}` : null;

  const title = stripTags(raw?.title || 'Appartement');
  const description = stripTags(raw?.body || '');
  const formattedPriceText = stripTags(raw?.formattedPrice || '');

  if (!options.trustSearchUrlFilters && !isAnibisRentalListing(raw, frSlug, title, description, formattedPriceText)) {
    return null;
  }

  const rooms = parseRooms(title) ?? parseRooms(description);
  const surfaceM2 = parseAnibisSurfaceM2(title, description);

  const postcode = String(raw?.postcodeInformation?.postcode || '').trim();
  const city = String(raw?.postcodeInformation?.locationName || fallbackAreaLabel || '').trim();
  const canton = String(raw?.postcodeInformation?.canton?.shortName || '').trim();
  const address = [postcode, city].filter(Boolean).join(' ').trim();

  const totalChf = parseAnibisPrice(raw?.formattedPrice);
  const imageUrls = [...new Set([
    toAbsoluteUrlForHost(raw?.thumbnail?.retinaRendition?.src || '', 'https://www.anibis.ch'),
    toAbsoluteUrlForHost(raw?.thumbnail?.normalRendition?.src || '', 'https://www.anibis.ch')
  ].filter(Boolean))].slice(0, 6);

  const result = {
    id: `anibis:${sourceId}`,
    sourceId,
    url,
    title,
    objectType: rooms != null ? `Appartement ${rooms} pièces` : 'Appartement',
    address,
    area: city || fallbackAreaLabel || canton,
    rooms,
    surfaceM2,
    priceRaw: formattedPriceText,
    rentChf: totalChf,
    chargesChf: 0,
    totalChf,
    imageUrl: imageUrls[0] || null,
    imageUrls,
    source: 'anibis.ch',
    publishedAt: raw?.timestamp || null
  };

  if (options.trustSearchUrlFilters) {
    result.anibisSearchUrlMatch = true;
  }

  return result;
}

function isStoredAnibisSaleListing(item) {
  if (String(item?.source || '') !== 'anibis.ch') return false;

  const haystack = normalizeKeyText([
    item?.title,
    item?.url,
    item?.notes,
    item?.priceRaw
  ].filter(Boolean).join(' '));

  return [
    'a vendre',
    'a-vendre',
    'vente',
    'acheter',
    'a acheter',
    'a-acheter'
  ].some((signal) => haystack.includes(signal));
}

function isTrustedAnibisSearchUrlResult(item, config = {}) {
  return String(item?.source || '') === 'anibis.ch'
    && item?.anibisSearchUrlMatch === true
    && config?.anibis?.trustSearchUrlFilters !== false;
}

function withPageParam(url, page) {
  const u = new URL(url);
  if (page > 1) {
    u.searchParams.set('page', String(page));
  } else {
    u.searchParams.delete('page');
  }
  return u.toString();
}

function normalizeAnibisSearchUrl(value = '', sorting = 'newest') {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const url = new URL(raw, 'https://www.anibis.ch');
  if (!/(^|\.)anibis\.ch$/i.test(url.hostname)) {
    throw new Error(`Invalid Anibis search URL host: ${url.hostname}`);
  }

  const sortValue = String(sorting || '').trim();
  if (sortValue && !url.searchParams.has('sorting')) {
    url.searchParams.set('sorting', sortValue);
  }

  return url.toString();
}

function buildAnibisQueryUrl(query, sorting = 'newest') {
  const url = new URL('https://www.anibis.ch/fr/q');
  url.searchParams.set('query', query);

  const sortValue = String(sorting || '').trim();
  if (sortValue) {
    url.searchParams.set('sorting', sortValue);
  }

  return url.toString();
}

function configuredAnibisSearchUrls(config) {
  const values = [];
  const anibisConfig = config?.anibis || {};

  if (typeof anibisConfig.searchUrl === 'string') {
    values.push(anibisConfig.searchUrl);
  }

  if (Array.isArray(anibisConfig.searchUrls)) {
    for (const item of anibisConfig.searchUrls) {
      if (typeof item === 'string') values.push(item);
      else if (item && typeof item.url === 'string') values.push(item.url);
    }
  }

  const sorting = String(anibisConfig.sorting || 'newest').trim();
  return [...new Set(values.map((url) => normalizeAnibisSearchUrl(url, sorting)).filter(Boolean))];
}

async function scrapeAnibisSearchUrl(searchUrl, fallbackAreaLabel = '', maxPages = 2, requestOptions = {}) {
  const firstUrl = normalizeAnibisSearchUrl(searchUrl, requestOptions.sorting || 'newest');
  const firstRes = await fetchHtmlWithRedirectsRetry(firstUrl, requestOptions);
  const firstData = parseAnibisSearchDataFromHtml(firstRes.html);

  if (!firstData) {
    throw new Error(`No Anibis search payload found at ${firstRes.finalUrl || firstUrl}`);
  }

  const perPage = Math.max(1, Number(firstData?.listings?.edges?.length || 30));
  const totalCount = Math.max(0, Number(firstData?.listings?.totalCount || perPage));
  const pages = Math.max(1, Math.min(Math.ceil(totalCount / perPage), Number(maxPages) || 1));

  const out = [];
  const parsePageData = (data) => {
    const edges = Array.isArray(data?.listings?.edges) ? data.listings.edges : [];
    for (const edge of edges) {
      const parsed = parseAnibisListing(edge?.node, fallbackAreaLabel, {
        trustSearchUrlFilters: requestOptions.trustSearchUrlFilters === true
      });
      if (parsed) out.push(parsed);
    }
  };

  parsePageData(firstData);

  for (let page = 2; page <= pages; page += 1) {
    try {
      const pageUrl = withPageParam(firstRes.finalUrl, page);
      const pageRes = await fetchHtmlWithRedirectsRetry(pageUrl, requestOptions);
      const pageData = parseAnibisSearchDataFromHtml(pageRes.html);
      parsePageData(pageData);
    } catch (err) {
      console.error(`WARN anibis url="${firstUrl}" page=${page}: ${err.message}`);
    }
  }

  return out;
}

async function scrapeAnibisQuery(query, fallbackAreaLabel = '', maxPages = 2, requestOptions = {}) {
  const firstUrl = buildAnibisQueryUrl(query, requestOptions.sorting || 'newest');
  return scrapeAnibisSearchUrl(firstUrl, fallbackAreaLabel, maxPages, requestOptions);
}

async function scrapeAnibisListings(config) {
  const out = [];
  const areas = Array.isArray(config?.areas) ? config.areas : [];
  const targetAreaSet = buildTargetAreaSet(areas);
  const maxPagesPerArea = Math.max(1, Number(config?.anibis?.maxPagesPerArea ?? 2));
  const maxPagesPerSearchUrl = Math.max(1, Number(config?.anibis?.maxPagesPerSearchUrl ?? maxPagesPerArea));
  const querySuffix = String(config?.anibis?.querySuffix || 'appartement louer').trim();
  const sorting = String(config?.anibis?.sorting || 'newest').trim();
  const filterSearchUrlsByAreas = config?.anibis?.filterSearchUrlsByAreas === true;
  const trustSearchUrlFilters = config?.anibis?.trustSearchUrlFilters !== false;
  const runAreaQueries = config?.anibis?.runAreaQueries !== false;

  const requestOptions = {
    attempts: Math.max(1, Number(config?.anibis?.requestRetries ?? 3)),
    maxRedirects: Math.max(1, Number(config?.anibis?.maxRedirects ?? 5)),
    baseDelayMs: Math.max(0, Number(config?.anibis?.retryBackoffMs ?? 1200)),
    sorting,
    trustSearchUrlFilters: false
  };

  for (const searchUrl of configuredAnibisSearchUrls(config)) {
    try {
      const listings = await scrapeAnibisSearchUrl(searchUrl, '', maxPagesPerSearchUrl, {
        ...requestOptions,
        trustSearchUrlFilters
      });
      for (const item of listings) {
        if (filterSearchUrlsByAreas && !isTargetAreaCity(item.area || '', targetAreaSet)) continue;
        out.push(item);
      }
    } catch (err) {
      console.error(`WARN anibis url="${searchUrl}": ${err.message}`);
    }
  }

  if (runAreaQueries) {
    for (const area of areas) {
      const areaLabel = String(area?.label || '').trim();
      if (!areaLabel) continue;

      const query = `${areaLabel} ${querySuffix}`.trim();

      try {
        const listings = await scrapeAnibisQuery(query, areaLabel, maxPagesPerArea, requestOptions);
        for (const item of listings) {
          if (!isTargetAreaCity(item.area || '', targetAreaSet)) continue;
          out.push(item);
        }
      } catch (err) {
        console.error(`WARN anibis area="${areaLabel}": ${err.message}`);
      }
    }
  }

  return out;
}

function parseListingsFromHtml(html, areaLabel) {
  const blocks = html.match(/<div id="filter-item-\d+" class="filter-item"[\s\S]*?(?=<div id="filter-item-|<immo-ads id=|$)/g) || [];
  const out = [];

  for (const block of blocks) {
    const idMatch = block.match(/id="filter-item-(\d+)"/);
    const hrefMatch = block.match(/id="link-result-item-\d+"[^>]*href="([^"]+)"/);
    const titlePriceMatch = block.match(/<strong class="title">([\s\S]*?)<\/strong>/);
    const objectTypeMatch = block.match(/<p class="object-type">([\s\S]*?)<\/p>/);
    const addressMatch = block.match(/<p class="object-type">[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/);
    const areaMatch = block.match(/class="space">([\d.,'\s]+)\s*m<sup>2<\/sup>/i);
    const imageMatches = [...block.matchAll(/<img[^>]+data-src="([^"]+)"[^>]*>/gi)];
    const agencyLinkMatch = block.match(/id="link-result-agency-\d+"[^>]*href="([^"]+)"/i);
    const agencyAltMatch = block.match(/id="link-result-agency-\d+"[^>]*>[\s\S]*?<img[^>]*alt="([^"]+)"/i);

    if (!idMatch || !hrefMatch) continue;

    const id = idMatch[1];
    const href = decodeHtml(hrefMatch[1]);
    if (/\/vendre\//i.test(href)) continue;

    const url = href.startsWith('http') ? href : `https://www.immobilier.ch${href}`;
    if (/\/vendre\//i.test(url)) continue;

    const imageUrls = [...new Set(
      imageMatches
        .map((m) => toAbsoluteUrl(m[1]))
        .map((x) => preferLargerImageUrl(x))
        .filter((x) => x && !/logo[-_]?small|\/logo\./i.test(String(x)))
    )].slice(0, 6);
    const imageUrl = imageUrls[0] || null;
    const objectType = stripTags(objectTypeMatch?.[1] || 'Appartement');
    const rooms = parseRooms(objectType);
    const surfaceM2 = areaMatch ? Number(areaMatch[1].replace(/['\s]/g, '').replace(',', '.')) : null;
    const address = stripTags(addressMatch?.[1] || '');
    const inferredArea = inferAreaFromAddress(address, areaLabel);
    const agencyUrl = toAbsoluteUrlForHost(agencyLinkMatch?.[1] || '', 'https://www.immobilier.ch');
    const agencyName = stripTags(agencyAltMatch?.[1] || '');
    const { priceRaw, rentChf, chargesChf, totalChf } = parsePrice(titlePriceMatch?.[1] || '');

    out.push({
      id,
      sourceId: id,
      url,
      title: slugToTitle(href),
      objectType,
      address,
      area: inferredArea,
      rooms,
      surfaceM2,
      priceRaw,
      rentChf,
      chargesChf,
      totalChf,
      imageUrl,
      imageUrls,
      agencyName: agencyName || null,
      agencyUrl: agencyUrl || null,
      providerName: agencyName || null,
      source: 'immobilier.ch',
      publishedAt: null
    });
  }

  return out;
}

function normalizeKeyText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Swiss canton abbreviations used as city suffixes (e.g. "Romont FR", "Sierre VS")
const SWISS_CANTON_CODES = new Set([
  'ag', 'ai', 'ar', 'be', 'bl', 'bs', 'fr', 'ge', 'gl', 'gr',
  'ju', 'lu', 'ne', 'nw', 'ow', 'sg', 'sh', 'so', 'sz', 'tg',
  'ti', 'ur', 'vd', 'vs', 'zg', 'zh'
]);

function normalizeAreaToken(value = '') {
  let token = normalizeKeyText(value)
    .replace(/\bsaint\b/g, 'st')   // Saint-Légier ↔ St-Légier
    .replace(/\bde\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip trailing Swiss canton suffix (e.g. "romont fr" → "romont")
  const parts = token.split(' ');
  if (parts.length > 1 && SWISS_CANTON_CODES.has(parts[parts.length - 1])) {
    parts.pop();
    token = parts.join(' ');
  }

  return token;
}

function resolveNonSpeculativeGroups(config) {
  const configured = Array.isArray(config?.filters?.nonSpeculativeGroups)
    ? config.filters.nonSpeculativeGroups
    : [];

  const source = configured.length ? configured : DEFAULT_NON_SPECULATIVE_GROUPS;
  return source
    .map((x) => normalizeKeyText(String(x || '')))
    .filter(Boolean);
}

function nonSpeculativeEligibility(item, config) {
  const enabled = !!config?.filters?.nonSpeculativeOnly;
  if (!enabled) {
    return { eligible: true, reason: '' };
  }

  const groups = resolveNonSpeculativeGroups(config);
  if (!groups.length) {
    return { eligible: true, reason: '' };
  }

  const haystack = normalizeKeyText([
    item?.providerName,
    item?.agencyName,
    item?.agencyUrl,
    item?.title,
    item?.notes
  ].filter(Boolean).join(' '));

  const eligible = groups.some((token) => haystack.includes(token));
  return {
    eligible,
    reason: eligible ? '' : 'Bailleur hors liste non spéculative'
  };
}

function buildTargetAreaSet(areas = []) {
  const set = new Set();
  const push = (value) => {
    const key = normalizeAreaToken(value);
    if (key) set.add(key);
  };

  for (const area of areas) {
    push(area?.label || '');
    push(area?.slug || '');
  }

  return set;
}

function isTargetAreaCity(city = '', targetAreaSet) {
  if (!targetAreaSet || !targetAreaSet.size) return true;

  const key = normalizeAreaToken(city);
  if (!key) return false;

  return targetAreaSet.has(key);
}

function resolveImmobilierCanton(area = {}, config = {}) {
  const explicit = String(area?.canton || config?.canton || '').trim().toLowerCase();
  if (explicit) return explicit;
  return 'vaud';
}

const IMMOBILIER_SLUG_LEADING_ARTICLES = new Set(['la', 'le', 'les', 'l']);
const IMMOBILIER_SLUG_JOINERS = new Set(['de', 'du', 'des', 'd']);

function normalizeSlugCandidate(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugSaintToSt(value = '') {
  return String(value || '').replace(/(^|-)saint(?=-|$)/g, '$1st');
}

function slugStToSaint(value = '') {
  return String(value || '').replace(/(^|-)st(?=-|$)/g, '$1saint');
}

function compactImmobilierSlug(value = '') {
  const tokens = String(value || '').split('-').filter(Boolean);
  if (!tokens.length) return '';

  while (tokens.length && IMMOBILIER_SLUG_LEADING_ARTICLES.has(tokens[0])) {
    tokens.shift();
  }

  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;

    if (IMMOBILIER_SLUG_JOINERS.has(token)) continue;
    if (token === 'la' && i > 0 && (tokens[i - 1] === 'st' || tokens[i - 1] === 'saint')) continue;

    out.push(token);
  }

  return out.join('-');
}

function buildImmobilierSlugCandidates(area = {}) {
  const ordered = [];
  const seen = new Set();

  const add = (value) => {
    const key = normalizeSlugCandidate(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    ordered.push(key);
  };

  add(area?.slug || '');
  add(area?.label || '');

  for (let i = 0; i < ordered.length; i += 1) {
    const slug = ordered[i];
    add(slugSaintToSt(slug));
    add(slugStToSaint(slug));

    const compact = compactImmobilierSlug(slug);
    add(compact);
    add(slugSaintToSt(compact));
    add(slugStToSaint(compact));
  }

  return ordered;
}

async function resolveImmobilierSlugForArea(area = {}, config = {}) {
  const canton = resolveImmobilierCanton(area, config);
  const candidates = buildImmobilierSlugCandidates(area);
  const fallback = normalizeSlugCandidate(area?.slug || area?.label || '');
  if (!candidates.length) return fallback;

  const areaTargetSet = buildTargetAreaSet([area]);
  let best = null;

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const slug = candidates[idx];
    const url = `https://www.immobilier.ch/fr/louer/appartement/${canton}/${slug}/page-1`;

    try {
      const html = await fetchHtml(url);
      const items = parseListingsFromHtml(html, area?.label || '');
      if (!items.length) continue;

      let strictMatches = 0;
      let looseMatches = 0;

      for (const item of items) {
        const strictArea = inferAreaFromAddressStrict(item.address || '');
        if (strictArea && isTargetAreaCity(strictArea, areaTargetSet)) {
          strictMatches += 1;
        }
        if (isTargetAreaCity(item.area || '', areaTargetSet)) {
          looseMatches += 1;
        }
      }

      const matchRank = strictMatches * 100 + looseMatches;
      if (!best || matchRank > best.matchRank) {
        best = { slug, matchRank, strictMatches, looseMatches };
      }

      // Fast path: current slug already returns matching city names.
      if (idx === 0 && strictMatches > 0) {
        return slug;
      }
    } catch {
      // try next candidate
    }
  }

  if (best && (best.strictMatches > 0 || best.looseMatches > 0)) {
    return best.slug;
  }

  return candidates[0] || fallback;
}

function resolveFlatfoxAreaTokens(areas = []) {
  const tokens = new Set();

  for (const area of areas) {
    const label = String(area?.label || '').trim();
    const slug = String(area?.slug || '').trim().toLowerCase();

    // Flatfox works best with the original city name (with spaces/accents)
    if (label) tokens.add(label);
    // Also try the slug as fallback
    if (slug) tokens.add(slug.replace(/_/g, '-'));
  }

  return [...tokens];
}

function parseFlatfoxMoveInDate(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return normalizeDateParts(iso[3], iso[2], iso[1]);
  }

  return parseDateFromText(raw);
}

function parseFlatfoxPriceFromText(text = '') {
  const m = String(text || '').match(/CHF\s*([\d''\s.,]+)/i);
  if (!m) return null;
  return toPositiveNumber(chfToNumber(m[1] || ''));
}

function parseFlatfoxListing(raw, fallbackAreaLabel = '') {
  const sourceId = String(raw?.pk || '').trim();
  if (!sourceId) return null;

  if (String(raw?.offer_type || '').toUpperCase() !== 'RENT') return null;
  if (String(raw?.object_category || '').toUpperCase() !== 'APARTMENT') return null;
  if (String(raw?.status || '').toLowerCase() !== 'act') return null;

  const parsedRooms = toPositiveNumber(String(raw?.number_of_rooms || '').replace(',', '.'));
  const rooms = parsedRooms ?? parseRooms(raw?.short_title || raw?.public_title || '');

  const surfaceM2 = toPositiveNumber(raw?.surface_living) ?? toPositiveNumber(raw?.space_display);

  const rentChf = toPositiveNumber(raw?.rent_net);
  const chargesChf = toPositiveNumber(raw?.rent_charges) ?? 0;
  const gross = toPositiveNumber(raw?.rent_gross);
  const priceDisplay = toPositiveNumber(raw?.price_display);
  const textPrice = parseFlatfoxPriceFromText(raw?.public_title || raw?.description_title || raw?.short_title || '');
  const computedFromNet = rentChf != null ? rentChf + (chargesChf || 0) : null;
  const totalChf = gross ?? priceDisplay ?? computedFromNet ?? textPrice;

  const city = String(raw?.city || fallbackAreaLabel || '').trim();
  const street = String(raw?.street || '').trim();
  const zipcode = raw?.zipcode != null ? String(raw.zipcode).trim() : '';
  const publicAddress = String(raw?.public_address || '').trim();
  const address = publicAddress || [street, [zipcode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const imageUrls = [...new Set(
    (Array.isArray(raw?.images) ? raw.images : [])
      .map((img) => {
        if (img && typeof img === 'object') {
          return toAbsoluteUrlForHost(img.url || img.url_listing_search || img.url_thumb_m || '', 'https://flatfox.ch');
        }
        return null;
      })
      .filter(Boolean)
  )].slice(0, 6);

  const agencyName = [raw?.agency?.name, raw?.agency?.name_2]
    .map((x) => stripTags(String(x || '')))
    .filter(Boolean)
    .join(' / ')
    .trim();

  const url = toAbsoluteUrlForHost(raw?.url || raw?.short_url || '', 'https://flatfox.ch');
  const title = stripTags(raw?.description_title || raw?.short_title || slugToTitle(raw?.slug || '') || 'Appartement');

  return {
    id: `flatfox:${sourceId}`,
    sourceId,
    url,
    title,
    objectType: rooms != null ? `Appartement ${rooms} pièces` : (raw?.short_title || 'Appartement'),
    address,
    area: city,
    rooms,
    surfaceM2,
    priceRaw: raw?.public_title || (totalChf != null ? `CHF ${totalChf}/mois` : ''),
    rentChf,
    chargesChf,
    totalChf,
    imageUrl: imageUrls[0] || null,
    imageUrls,
    agencyName: agencyName || null,
    agencyUrl: null,
    providerName: agencyName || null,
    source: 'flatfox.ch',
    movingDateRaw: raw?.moving_date || null,
    publishedAt: raw?.published || raw?.created || null
  };
}

async function scrapeFlatfoxPopularArea(areaToken, fallbackAreaLabel = '', maxPages = 3) {
  const out = [];
  let page = 0;
  let nextUrl = `https://flatfox.ch/api/v1/public-listing/popular/?area=${encodeURIComponent(areaToken)}&limit=100&expand=images`;

  while (nextUrl && page < maxPages) {
    page += 1;

    const payload = await fetchJson(nextUrl);
    const results = Array.isArray(payload?.results) ? payload.results : [];

    for (const entry of results) {
      const parsed = parseFlatfoxListing(entry, fallbackAreaLabel);
      if (parsed) out.push(parsed);
    }

    const next = payload?.next;
    nextUrl = typeof next === 'string' && next.trim() ? next : null;
  }

  return out;
}

async function scrapeFlatfoxListings(config) {
  const out = [];
  const areas = Array.isArray(config?.areas) ? config.areas : [];
  const targetAreaSet = buildTargetAreaSet(areas);
  const tokens = resolveFlatfoxAreaTokens(areas);
  const maxPages = Math.max(1, Number(config?.flatfox?.maxPagesPerArea ?? 3));

  for (const token of tokens) {
    try {
      const items = await scrapeFlatfoxPopularArea(token, '', maxPages);
      for (const item of items) {
        if (!isTargetAreaCity(item.area || '', targetAreaSet)) continue;
        out.push(item);
      }
    } catch (err) {
      console.error(`WARN flatfox area=${token}: ${err.message}`);
    }
  }

  return out;
}

function extractJsonArrayVariable(html = '', variableName = '') {
  const varToken = `var ${variableName}`;
  const idx = String(html || '').indexOf(varToken);
  if (idx < 0) return null;

  const start = String(html || '').indexOf('[', idx);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = '';
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === '[') {
      depth += 1;
      continue;
    }

    if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseNaefListing(raw, fallbackAreaLabel = '') {
  const sourceId = String(raw?.no_dossier || '').trim();
  if (!sourceId) return null;

  const naefTypeCode = String(raw?.type_code || '').trim().toUpperCase();
  // Keep apartments only (Naef feed includes parking/commercial objects too).
  if (naefTypeCode !== 'APP') return null;

  const typeText = `${raw?.type_designation_fr || ''} ${raw?.type_code || ''} ${raw?.intitule_plaquette || ''}`.toLowerCase();
  if (/parking|garage|depot|dépôt|surface|bureau|commerce|arcade|atelier|immeuble|terrain/.test(typeText)) {
    return null;
  }

  const rooms = toPositiveNumber(String(raw?.nb_pieces || '').replace(',', '.'))
    ?? parseRooms(raw?.intitule_plaquette || raw?.type_designation_fr || '');

  const totalChf = toPositiveNumber(raw?.loyer_mensuel_brut) ?? toPositiveNumber(raw?.loyer_mensuel_net);
  const rentChf = toPositiveNumber(raw?.loyer_mensuel_net) ?? totalChf;
  const chargesChf = totalChf != null && rentChf != null ? Math.max(0, totalChf - rentChf) : 0;

  const city = String(raw?.adresse_localite || fallbackAreaLabel || '').trim();
  const postcode = String(raw?.npa || '').trim();
  const address = [raw?.adresse_rue, [postcode, city].filter(Boolean).join(' ')].map((x) => String(x || '').trim()).filter(Boolean).join(', ');

  const url = toAbsoluteUrlForHost(raw?.link || '', 'https://www.naef.ch');
  if (!url || /\/vente\//i.test(url) || /\/location\/(parking|local|commerce|bureau|terrain)\//i.test(url)) return null;

  const imageUrls = [...new Set((Array.isArray(raw?.imgs) ? raw.imgs : [])
    .map((x) => toAbsoluteUrlForHost(x, 'https://www.naef.ch'))
    .filter(Boolean))].slice(0, 6);

  const publishedAtRaw = String(raw?.date_modification || '').trim();
  const publishedAt = publishedAtRaw
    ? new Date(publishedAtRaw.replace(' ', 'T')).toISOString()
    : null;

  return {
    id: `naef:${sourceId}`,
    sourceId,
    url,
    title: stripTags(raw?.intitule_plaquette || raw?.type_designation_fr || 'Appartement'),
    objectType: stripTags(raw?.type_designation_fr || (rooms != null ? `Appartement ${rooms} pièces` : 'Appartement')),
    address,
    area: city,
    rooms,
    surfaceM2: toPositiveNumber(raw?.surface_habitable),
    priceRaw: totalChf != null ? `CHF ${Math.round(totalChf)}/mois` : '',
    rentChf,
    chargesChf,
    totalChf,
    imageUrl: imageUrls[0] || null,
    imageUrls,
    agencyName: 'Naef Immobilier',
    agencyUrl: 'https://www.naef.ch',
    providerName: 'Naef Immobilier',
    source: 'naef.ch',
    listingStage: 'early_market',
    publishedAt: Number.isFinite(new Date(publishedAt).getTime()) ? publishedAt : null
  };
}

async function scrapeNaefListings(config) {
  const out = [];
  const targetAreaSet = buildTargetAreaSet(config?.areas || []);

  try {
    const html = await fetchHtml('https://www.naef.ch/louer/appartements-maisons/');
    const jsonArray = extractJsonArrayVariable(html, 'all_db_datas');
    if (!jsonArray) return out;

    const entries = JSON.parse(jsonArray);
    for (const raw of entries) {
      const parsed = parseNaefListing(raw);
      if (!parsed) continue;
      if (!isTargetAreaCity(parsed.area || '', targetAreaSet)) continue;
      out.push(parsed);
    }
  } catch (err) {
    console.error(`WARN naef source: ${err.message}`);
  }

  return out;
}

function parseHtmlTagAttributes(tag = '') {
  const out = {};
  const regex = /([:@a-zA-Z0-9_-]+)="([^"]*)"/g;
  let match;

  while ((match = regex.exec(String(tag || '')))) {
    out[match[1]] = decodeHtml(match[2] || '');
  }

  return out;
}

function parseBernardPrice(text = '') {
  const m = String(text || '').match(/CHF\s*([\d'''`\u2018\u2019\s.,]+)/i);
  if (!m) return null;
  // Strip thousands separators (apostrophes) and trailing decimals (.00 / .-)
  const cleaned = String(m[1] || '')
    .replace(/['''`\u2018\u2019\s]/g, '')  // remove thousands separators
    .replace(/\.\-$/, '')                   // trailing .- (e.g. "1700.-")
    .replace(/\.00$/, '');                  // trailing .00 (e.g. "1500.00")
  return toPositiveNumber(Number(cleaned));
}

function buildBernardSourceId(href = '', title = '') {
  const clean = String(href || '').split('?')[0].replace(/\/$/, '');
  const tail = clean.split('/').filter(Boolean).pop() || '';
  const numeric = tail.match(/-(\d+)$/);
  if (numeric?.[1]) return numeric[1];
  return crypto.createHash('sha1').update(`${clean}|${title}`).digest('hex').slice(0, 16);
}

function parseBernardNicodPropertyCard(cardHtml = '', fallbackAreaLabel = '') {
  // Pull the listing URL from the bookmark anchor.
  const hrefMatch = cardHtml.match(/<a[^>]+href="([^"]+)"[^>]+rel="bookmark"/i);
  const href = hrefMatch ? hrefMatch[1] : '';
  if (!href) return null;

  const url = toAbsoluteUrlForHost(href, 'https://www.bernard-nicod.ch');
  if (!url) return null;
  if (/\/vente\//i.test(url)) return null;

  // Title: <div class="object-title">…<p class="mb-0">Title here</p></div>
  const titleMatch = cardHtml.match(/<div[^>]*class="[^"]*object-title[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  const title = titleMatch ? stripTags(titleMatch[1]).trim() : (slugToTitle(href) || 'Appartement');
  const lower = title.toLowerCase();

  if (/parking|garage|place de parc|villa|maison|chalet|bureau|commerce|arcade|terrain|immeuble/.test(lower)) {
    return null;
  }
  if (!/(appartement|studio|loft|duplex|pi[eè]ces?)/.test(lower)) {
    return null;
  }

  // Address (city only on new design): <div class="field--name-field-cp-address">…<div class="field__item">Rolle</div>
  const addrMatch = cardHtml.match(/field--name-field-cp-address[\s\S]*?<div[^>]*class="[^"]*field__item[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const area = addrMatch ? stripTags(addrMatch[1]).trim() : (fallbackAreaLabel || '');

  // Rooms: a sibling <p class="mb-0">4.5 pièces</p>; prefer parsing from title to avoid grabbing surface lines.
  const rooms = parseRooms(title);

  // Surface: card has no structured field, but listings often state it in
  // the title (e.g. "Sublime appartement de 3.0 pièces de 98m² avec vue …").
  const surfaceMatch = title.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
  const surfaceFromTitle = surfaceMatch ? toPositiveNumber(surfaceMatch[1].replace(',', '.')) : null;

  // Price: appears in a <p class="mb-0">CHF 3'500.-</p> within a secondary-info block. Fall back to scanning the whole card for any "CHF ..." price.
  const priceBlocks = [...cardHtml.matchAll(/<p[^>]*class="[^"]*mb-0[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]).trim());
  const priceText = priceBlocks.find((t) => /CHF\s*[\d]/i.test(t)) || '';
  const totalChf = parseBernardPrice(priceText);

  // Image URLs: collect every data-src attribute from the card's slick carousel, prepending host.
  const imageUrls = [...new Set([...cardHtml.matchAll(/data-src="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((u) => /cp_object_photos|object_card/i.test(u))
    .map((u) => toAbsoluteUrlForHost(u, 'https://www.bernard-nicod.ch'))
    .filter(Boolean))].slice(0, 8);

  const sourceId = buildBernardSourceId(href, title);

  return {
    id: `bernard:${sourceId}`,
    sourceId,
    url,
    title,
    objectType: rooms != null ? `Appartement ${rooms} pièces` : 'Appartement',
    address: area,
    area,
    rooms,
    surfaceM2: surfaceFromTitle,
    priceRaw: priceText,
    rentChf: totalChf,
    chargesChf: 0,
    totalChf,
    imageUrl: imageUrls[0] || null,
    imageUrls,
    agencyName: 'Bernard Nicod',
    agencyUrl: 'https://www.bernard-nicod.ch',
    providerName: 'Bernard Nicod',
    source: 'bernard-nicod.ch',
    listingStage: 'early_market',
    publishedAt: null
  };
}

function parseBernardLastPage(html = '') {
  // Drupal pager: <a href="?page=47" title="Aller à la dernière page">. Returns 0 if not found (single page).
  const lastMatch = String(html || '').match(/href="\?page=(\d+)"[^>]*title="Aller à la dernière page"/i);
  if (lastMatch?.[1]) return Math.max(0, Number(lastMatch[1]));
  // Fallback: take the max page number referenced anywhere in pager links.
  const pages = [...String(html || '').matchAll(/href="\?page=(\d+)"/gi)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (!pages.length) return 0;
  return Math.max(...pages);
}

// Detail-page enrichment for the new bernard-nicod.ch site. The card carries
// city + price + rooms but never a street address; the detail page also
// hides the street text, but it embeds the listing's exact coordinates in a
// "Get directions" Google Maps link (destination=lat,lon). We reverse-
// geocode those coordinates against Nominatim to recover the street + postal
// code. Cached via geocodeCache so the second scan and onwards are free.
async function enrichBernardNicodFromDetail(item, geocodeCache) {
  if (!item?.url) return;
  try {
    const html = await fetchHtml(item.url);
    const coordMatch = html.match(/destination=([\-0-9.]+),([\-0-9.]+)/);
    if (!coordMatch) return;
    const lat = Number(coordMatch[1]);
    const lon = Number(coordMatch[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    item.mapLocation = { lat, lon, query: item.url, source: 'listing', precision: 'address' };

    if (!geocodeCache || typeof geocodeCache !== 'object') return;
    const reversed = await reverseGeocode(lat, lon, geocodeCache);
    if (!reversed) return;

    if (reversed.address) item.address = reversed.address;
    if (reversed.city && !item.area) item.area = reversed.city;
  } catch {
    // Detail fetch / reverse failed — keep the card-level data we already have.
  }
}

async function scrapeBernardNicodListings(config, geocodeCache) {
  const out = [];
  const targetAreaSet = buildTargetAreaSet(config?.areas || []);
  const maxPages = Math.max(1, Number(config?.bernardNicod?.maxPages ?? 8));

  // Drupal pager is 0-indexed (?page=0..N).
  let lastPage = 0;

  for (let page = 0; page <= Math.min(maxPages - 1, lastPage); page += 1) {
    try {
      const url = `https://www.bernard-nicod.ch/fr/recherche/residentiel/location?page=${page}`;
      const html = await fetchHtml(url);
      if (page === 0) {
        lastPage = Math.max(0, Math.min(maxPages - 1, parseBernardLastPage(html)));
      }

      const cards = [...html.matchAll(/<article[^>]*node--type-objects-cp[^>]*>[\s\S]*?<\/article>/gi)].map((m) => m[0]);
      if (!cards.length) break;

      for (const cardHtml of cards) {
        const parsed = parseBernardNicodPropertyCard(cardHtml);
        if (!parsed) continue;
        if (!isTargetAreaCity(parsed.area || '', targetAreaSet)) continue;
        out.push(parsed);
      }
    } catch (err) {
      console.error(`WARN bernard-nicod page=${page}: ${err.message}`);
      break;
    }
  }

  // Sequentially fetch each detail page to extract coords and reverse-geocode.
  // Reverse-geocode shares the geocodeCache so repeat scans skip Nominatim.
  for (const item of out) {
    await enrichBernardNicodFromDetail(item, geocodeCache);
  }

  return out;
}

function parseDrupalSettingsJson(html = '') {
  const match = String(html || '').match(/<script[^>]+data-drupal-selector="drupal-settings-json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parseRetraitesMarker(marker = {}) {
  const attrs = marker?.attributes || marker || {};
  const uniqueId = String(attrs?.uniqueID || '').trim();
  if (!uniqueId) return null;

  // Only residential rentals
  if (String(attrs?.offer_type || '').toUpperCase() !== 'RENT') return null;

  const city = String(attrs?.city || '').trim();
  const postalCode = String(attrs?.postal_code || '').trim();
  const street = String(attrs?.street || '').trim();
  const address = [street, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const rooms = toPositiveNumber(String(attrs?.rooms_number || '').replace(',', '.'));
  const surfaceM2 = toPositiveNumber(attrs?.surface);

  const rentChf = toPositiveNumber(attrs?.price);
  const chargesChf = toPositiveNumber(attrs?.price_extra) ?? 0;
  const totalChf = rentChf != null ? rentChf + (chargesChf || 0) : null;

  // Images: prefer originals > large > medium for the dashboard lightbox.
  const pictureSizes = Array.isArray(attrs?.pictures?.sizes) ? attrs.pictures.sizes : [];
  const medium = pictureSizes.flatMap((s) => Array.isArray(s?.m) ? s.m : []);
  const large = pictureSizes.flatMap((s) => Array.isArray(s?.l) ? s.l : []);
  const originals = Array.isArray(attrs?.pictures?.originals) ? attrs.pictures.originals : [];

  const imageUrls = [...new Set([...originals, ...large, ...medium]
    .map((x) => toAbsoluteUrlForHost(x, 'https://immobilier2.retraitespopulaires.ch'))
    .filter(Boolean))].slice(0, 8);

  // RP's API used to return YYYY-MM-DD; it now returns full ISO with offset
  // (e.g. "2026-02-14T00:00:00+01:00"). Detect which and parse accordingly.
  const publishedAtRaw = String(attrs?.publication_date || '').trim();
  const publishedAt = (() => {
    if (!publishedAtRaw) return null;
    const isoCandidate = /^\d{4}-\d{2}-\d{2}T/.test(publishedAtRaw)
      ? publishedAtRaw
      : `${publishedAtRaw}T00:00:00+01:00`;
    const ts = Date.parse(isoCandidate);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  })();

  const availableDateRaw = String(attrs?.available_date || '').trim();
  const linkRaw = String(attrs?.link || '').trim();

  return {
    id: `rp:${uniqueId}`,
    sourceId: uniqueId,
    url: toAbsoluteUrlForHost(linkRaw, 'https://www.retraitespopulaires.ch'),
    title: rooms != null ? `Appartement ${rooms} pièces` : 'Appartement',
    objectType: rooms != null ? `Appartement ${rooms} pièces` : 'Appartement',
    address,
    area: city,
    rooms,
    surfaceM2,
    priceRaw: totalChf != null ? `CHF ${Math.round(totalChf)}/mois` : '',
    rentChf,
    chargesChf,
    totalChf,
    imageUrl: imageUrls[0] || null,
    imageUrls,
    imageUrlsRemote: imageUrls,
    imageUrlsLocal: [],
    agencyName: stripTags(attrs?.agency_name || 'Retraites Populaires'),
    agencyUrl: 'https://www.retraitespopulaires.ch',
    providerName: stripTags(attrs?.agency_name || 'Retraites Populaires'),
    source: 'retraitespopulaires.ch',
    listingStage: 'early_market',
    movingDateRaw: availableDateRaw || null,
    publishedAt
  };
}

async function scrapeRetraitesPopulairesListings(config) {
  const dedup = new Map();

  const areas = Array.isArray(config?.areas) ? config.areas : [];
  const targetAreaSet = buildTargetAreaSet(areas);
  const rangeKm = Math.max(5, Math.min(30, Number(config?.retraitesListings?.rangeKm ?? 15)));

  // One request per area - markers contain ALL results in range (no pagination needed)
  for (const area of areas) {
    const areaLabel = String(area?.label || '').trim();
    if (!areaLabel) continue;

    const params = new URLSearchParams({
      place: areaLabel,
      range: String(rangeKm),
      type: '0',
      sort_by: 'proximity_asc',
      page: '0'
    });

    const url = `https://www.retraitespopulaires.ch/immobilier/louer/louer-un-appartement?${params.toString()}`;

    try {
      const html = await fetchHtml(url);
      const settings = parseDrupalSettingsJson(html);
      const markers = Array.isArray(settings?.markers) ? settings.markers : [];

      for (const marker of markers) {
        const parsed = parseRetraitesMarker(marker);
        if (!parsed) continue;
        if (!isTargetAreaCity(parsed.area || '', targetAreaSet)) continue;

        const key = String(parsed.id);
        if (!dedup.has(key) || listingQualityRank(parsed, new Map()) > listingQualityRank(dedup.get(key), new Map())) {
          dedup.set(key, parsed);
        }
      }
    } catch (err) {
      console.error(`WARN retraites-populaires listings area="${areaLabel}": ${err.message}`);
    }
  }

  return [...dedup.values()];
}

async function fetchFlatfoxListingById(sourceId, fallbackAreaLabel = '') {
  if (!sourceId) return null;

  try {
    const payload = await fetchJson(`https://flatfox.ch/api/v1/public-listing/${encodeURIComponent(sourceId)}/?expand=images`);
    return parseFlatfoxListing(payload, fallbackAreaLabel);
  } catch {
    return null;
  }
}

function toMap(list = []) {
  return new Map(list.map((item) => [String(item.id), item]));
}

function makeSummary(latest) {
  const top = latest.matching.slice(0, 5);
  const lines = [];
  lines.push(`Scan terminé: ${latest.totalCount} annonces actives analysées`);
  lines.push(`Nouvelles annonces: ${latest.newCount}`);
  lines.push(`Annonces retirées (conservées en grisé): ${latest.removedCount || 0}`);
  lines.push(`Annonces pertinentes (budget/critères): ${latest.matchingCount}`);
  if (!top.length) {
    lines.push('Aucune nouvelle annonce pertinente au dernier scan.');
  } else {
    lines.push('Top annonces:');
    for (const x of top) {
      const total = x.totalChf != null ? `CHF ${x.totalChf}` : x.priceRaw;
      lines.push(`- ${x.objectType} · ${x.area} · ${total} · ${x.url}`);
    }
  }
  return lines.join('\n');
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function defaultAreasForProfile(profile) {
  if (profile === 'fribourg') {
    return [
      { slug: 'chatel-st-denis', label: 'Châtel-Saint-Denis', canton: 'fribourg' },
      { slug: 'romont-fr', label: 'Romont FR', canton: 'fribourg' }
    ];
  }

  if (profile === 'saint-maurice') {
    return [
      { slug: 'st-maurice', label: 'Saint-Maurice', canton: 'valais' }
    ];
  }

  return [
    { slug: 'vevey', label: 'Vevey', canton: 'vaud' },
    { slug: 'tour-peilz', label: 'La Tour-de-Peilz', canton: 'vaud' },
    { slug: 'corseaux', label: 'Corseaux', canton: 'vaud' },
    { slug: 'corsier-vevey', label: 'Corsier-sur-Vevey', canton: 'vaud' }
  ];
}

function makeDefaultConfig(profile, base = null) {
  const isFribourg = profile === 'fribourg';
  const isSaintMaurice = profile === 'saint-maurice';

  const template = base && typeof base === 'object' ? JSON.parse(JSON.stringify(base)) : {
    name: 'Apartment Search',
    pagesPerArea: 2,
    sources: {
      immobilier: true,
      flatfox: true,
      naef: true,
      bernardNicod: true,
      retraitesListings: true,
      anibis: false
    },
    flatfox: { maxPagesPerArea: 3, recheckKnownIdsLimit: 20 },
    filters: {
      maxTotalChf: isSaintMaurice ? 1700 : 1400,
      maxTotalHardChf: isSaintMaurice ? 1700 : (isFribourg ? 1650 : 1550),
      maxPublishedAgeDays: (isFribourg || isSaintMaurice) ? 20 : null,
      minRoomsPreferred: isSaintMaurice ? 3 : (isFribourg ? 2.5 : 2),
      minSurfaceM2Preferred: isFribourg ? 50 : 0,
      excludedObjectTypeKeywords: ['chambre', 'colocation', 'wg'],
      missingScansBeforeRemoved: 2,
      moveInDeadline: '2026-03-01'
    },
    preferences: {
      natureViewPreferred: true,
      washingMachinePreferred: true,
      bathtubPreferred: true,
      workplaceAddress: isSaintMaurice
        ? 'Gare de Saint-Maurice, 1890 Saint-Maurice, Suisse'
        : DEFAULT_WORK_ADDRESS
    }
  };

  const titleSuffix = isFribourg ? 'Fribourg' : (isSaintMaurice ? 'Saint-Maurice' : 'Vevey');
  template.name = `Apartment Search (${titleSuffix})`;
  template.areas = defaultAreasForProfile(profile);
  template.sources = {
    ...(template.sources || {}),
    immobilier: template.sources?.immobilier !== false,
    flatfox: template.sources?.flatfox !== false,
    naef: template.sources?.naef !== false,
    bernardNicod: template.sources?.bernardNicod !== false,
    retraitesListings: template.sources?.retraitesListings !== false,
    anibis: !!template.sources?.anibis
  };
  template.flatfox = {
    maxPagesPerArea: 3,
    recheckKnownIdsLimit: 20,
    ...(template.flatfox || {})
  };

  template.filters = {
    ...(template.filters || {}),
    maxTotalChf: Number(template.filters?.maxTotalChf ?? (isSaintMaurice ? 1700 : 1400)),
    maxTotalHardChf: Number(template.filters?.maxTotalHardChf ?? (isSaintMaurice ? 1700 : (isFribourg ? 1650 : 1550))),
    minRoomsPreferred: Number(template.filters?.minRoomsPreferred ?? (isSaintMaurice ? 3 : (isFribourg ? 2.5 : 2))),
    maxPublishedAgeDays: (isFribourg || isSaintMaurice)
      ? Number(template.filters?.maxPublishedAgeDays ?? 20)
      : (template.filters?.maxPublishedAgeDays ?? null)
  };
  delete template.filters.maxPearlTotalChf;
  delete template.filters.pearl;

  if (isSaintMaurice) {
    template.filters = {
      ...(template.filters || {}),
      maxTotalChf: Number(template.filters?.maxTotalChf ?? 1700),
      maxTotalHardChf: Number(template.filters?.maxTotalHardChf ?? 1700),
      minRoomsPreferred: Number(template.filters?.minRoomsPreferred ?? 3),
      maxPublishedAgeDays: template.filters?.maxPublishedAgeDays == null
        ? 20
        : Number(template.filters?.maxPublishedAgeDays)
    };
    delete template.filters.maxPearlTotalChf;
    delete template.filters.pearl;

    template.preferences = {
      ...(template.preferences || {}),
      workplaceAddress: template.preferences?.workplaceAddress || 'Gare de Saint-Maurice, 1890 Saint-Maurice, Suisse'
    };
    delete template.preferences.transportToLausanne;
  }

  return template;
}

async function bootstrapProfileData(profile) {
  await fs.mkdir(PROFILES_DATA_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  const legacyFiles = {
    configPath: path.join(LEGACY_DATA_DIR, 'watch-config.json'),
    trackerPath: path.join(LEGACY_DATA_DIR, 'tracker.json'),
    latestPath: path.join(LEGACY_DATA_DIR, 'latest-listings.json'),
    geocodeCachePath: path.join(LEGACY_DATA_DIR, 'geocode-cache.json'),
    routeCachePath: path.join(LEGACY_DATA_DIR, 'route-cache.json')
  };

  if (profile === 'vevey') {
    for (const [key, legacyPath] of Object.entries(legacyFiles)) {
      const targetPath = {
        configPath: CONFIG_PATH,
        trackerPath: TRACKER_PATH,
        latestPath: LATEST_PATH,
        geocodeCachePath: GEOCODE_CACHE_PATH,
        routeCachePath: ROUTE_CACHE_PATH
      }[key];

      if (!targetPath) continue;
      if (!(await fileExists(targetPath)) && (await fileExists(legacyPath))) {
        await fs.copyFile(legacyPath, targetPath);
      }
    }
  }

  if (!(await fileExists(CONFIG_PATH))) {
    const veveyConfig = await readJsonSafe(path.join(PROFILES_DATA_DIR, 'vevey', 'watch-config.json'), null);
    const legacyConfig = await readJsonSafe(legacyFiles.configPath, null);
    const baseConfig = veveyConfig || legacyConfig || null;
    const config = makeDefaultConfig(profile, baseConfig);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
}

async function main() {
  await bootstrapProfileData(PROFILE);

  const config = await readJsonSafe(CONFIG_PATH, null);
  if (!config) {
    throw new Error(`Config manquante: ${CONFIG_PATH}`);
  }

  if (PROFILE === 'fribourg' || PROFILE === 'saint-maurice') {
    config.sources = {
      ...(config.sources || {})
    };
    if (typeof config.sources.immobilier !== 'boolean') config.sources.immobilier = true;
    if (typeof config.sources.flatfox !== 'boolean') config.sources.flatfox = true;
    if (typeof config.sources.naef !== 'boolean') config.sources.naef = true;
    if (typeof config.sources.bernardNicod !== 'boolean') config.sources.bernardNicod = true;
    if (typeof config.sources.retraitesListings !== 'boolean') config.sources.retraitesListings = true;
    if (typeof config.sources.anibis !== 'boolean') config.sources.anibis = false;
  }

  if (PROFILE === 'saint-maurice') {
    config.filters = {
      ...(config.filters || {}),
      maxTotalChf: Number(config.filters?.maxTotalChf ?? 1700),
      maxTotalHardChf: Number(config.filters?.maxTotalHardChf ?? 1700),
      minRoomsPreferred: Number(config.filters?.minRoomsPreferred ?? 3),
      maxPublishedAgeDays: config.filters?.maxPublishedAgeDays == null
        ? 20
        : Number(config.filters?.maxPublishedAgeDays)
    };
    delete config.filters.maxPearlTotalChf;
    delete config.filters.pearl;

    const existingWorkAddress = config.preferences?.workplaceAddress || config.preferences?.workAddress;
    config.preferences = {
      ...(config.preferences || {})
    };
    if (!existingWorkAddress) {
      config.preferences.workplaceAddress = 'Gare de Saint-Maurice, 1890 Saint-Maurice, Suisse';
    }
    delete config.preferences.transportToLausanne;
  }

  const areas = Array.isArray(config.areas) ? config.areas : [];
  const pagesPerArea = Math.max(1, Number(config.pagesPerArea) || 1);
  const enabledSources = [
    { key: 'immobilier', label: 'immobilier.ch' },
    config.sources?.flatfox !== false && { key: 'flatfox', label: 'flatfox.ch' },
    config.sources?.naef !== false && { key: 'naef', label: 'naef.ch' },
    config.sources?.bernardNicod !== false && { key: 'bernard-nicod', label: 'bernard-nicod.ch' },
    config.sources?.retraitesListings !== false && { key: 'retraites-populaires', label: 'Retraites Populaires' },
    config.sources?.anibis !== false && { key: 'anibis', label: 'anibis.ch' }
  ].filter(Boolean);
  const progressPhases = [
    { key: 'prepare-listings', label: 'Préparation des annonces', kind: 'phase' },
    config.sources?.flatfox !== false && { key: 'flatfox-recheck', label: 'Vérification Flatfox', kind: 'phase' },
    { key: 'dedupe', label: 'Tri et déduplication', kind: 'phase' },
    { key: 'saving', label: 'Images et sauvegarde', kind: 'phase' }
  ].filter(Boolean);
  const progressRows = [
    ...enabledSources.map((source) => ({ ...source, kind: 'source' })),
    ...progressPhases
  ];
  const immobilierUnits = areas.length * pagesPerArea;
  const sourceUnits = enabledSources.filter((source) => source.key !== 'immobilier').length;
  const postProcessingUnits = config.sources?.flatfox !== false ? 4 : 3;
  const totalUnits = immobilierUnits + sourceUnits + postProcessingUnits;
  let progressDone = 0;
  const emitStructuredProgress = (event) => {
    const currentStep = event.message || event.currentStep || 'Scan en cours';
    emitProgress({
      ...event,
      total: totalUnits,
      done: progressDone,
      totalUnits,
      completedUnits: progressDone,
      sources: progressRows,
      currentStep,
      currentMessage: event.currentMessage || currentStep
    });
  };
  const completeUnit = (event) => {
    const units = Math.max(1, Number(event.units ?? 1) || 1);
    progressDone = Math.min(totalUnits, progressDone + units);
    emitStructuredProgress({ ...event, units });
  };
  emitStructuredProgress({
    type: 'phase:start',
    phase: 'preparing',
    message: 'Préparation du scan'
  });

  const missingScansBeforeRemoved = Math.max(1, Number(config.filters?.missingScansBeforeRemoved ?? 2));

  const previousLatest = await readJsonSafe(LATEST_PATH, { all: [] });
  const prevIds = new Set((previousLatest.all || []).map((x) => String(x.id)));

  const tracker = await readJsonSafe(TRACKER_PATH, {
    createdAt: new Date().toISOString(),
    statuses: STATUSES,
    statusWorkflowVersion: STATUS_WORKFLOW_VERSION,
    listings: []
  });
  migrateTrackerStatuses(tracker);

  const geocodeCache = await readJsonSafe(GEOCODE_CACHE_PATH, {});
  const routeCache = await readJsonSafe(ROUTE_CACHE_PATH, {});
  const workAddress = config.preferences?.workplaceAddress || config.preferences?.workAddress || DEFAULT_WORK_ADDRESS;
  const workCoords = await geocodeAddress(workAddress, geocodeCache);
  if (!workCoords) {
    console.error(`WARN commute: could not geocode workplace "${workAddress}"`);
  }

  const trackerMap = toMap(tracker.listings || []);
  const targetAreaSet = buildTargetAreaSet(config.areas || []);

  // Stubs (slimmed historical entries) carry just enough metadata to suppress
  // re-discovery. Build lookup sets so freshly-scraped listings whose id or
  // dedupKey matches a stub can be skipped without re-fetching/re-evaluating.
  const stubIds = new Set();
  const stubDedupKeys = new Set();
  for (const entry of tracker.listings || []) {
    if (isStub(entry)) {
      if (entry.id != null) stubIds.add(String(entry.id));
      if (entry.dedupKey) stubDedupKeys.add(entry.dedupKey);
    }
  }

  const scraped = [];
  const sourceFailures = [];

  const immobilierTasks = [];
  for (const area of areas) {
    const canton = resolveImmobilierCanton(area, config);
    const areaLabel = String(area?.label || '').trim();
    const configuredSlug = normalizeSlugCandidate(area?.slug || '');
    const immobilierSlug = await resolveImmobilierSlugForArea(area, config);
    const finalSlug = immobilierSlug || configuredSlug;

    if (immobilierSlug && configuredSlug && immobilierSlug !== configuredSlug) {
      console.log(`INFO immobilier slug auto-resolved for "${areaLabel}": ${configuredSlug} -> ${immobilierSlug}`);
    }

    for (let page = 1; page <= pagesPerArea; page += 1) {
      immobilierTasks.push({ areaLabel, configuredSlug, canton, finalSlug, page });
    }
  }

  emitStructuredProgress({
    type: 'source:start',
    source: 'immobilier.ch',
    phase: 'sources',
    message: 'immobilier.ch: recherche des annonces'
  });
  let immobilierPageFailures = 0;
  const immobilierResults = await runLimited(
    immobilierTasks,
    Number(config.scanConcurrency?.immobilierPages ?? 3),
    async (task) => {
      const progressLabel = `immobilier.ch · ${task.areaLabel || task.configuredSlug || 'zone'} · page ${task.page}`;
      const url = `https://www.immobilier.ch/fr/louer/appartement/${task.canton}/${task.finalSlug}/page-${task.page}`;
      try {
        const html = await fetchHtml(url);
        const items = parseListingsFromHtml(html, task.areaLabel);
        return items.filter((item) => isTargetAreaCity(item.area || '', targetAreaSet));
      } catch (err) {
        immobilierPageFailures += 1;
        console.error(`WARN ${url}: ${err.message}`);
        return [];
      } finally {
        completeUnit({
          type: 'unit:done',
          source: 'immobilier.ch',
          phase: 'sources',
          message: `${progressLabel} terminée`
        });
      }
    }
  );
  const immobilierItems = immobilierResults.flat();
  scraped.push(...immobilierItems);
  if (immobilierPageFailures > 0) {
    const error = `${immobilierPageFailures} page${immobilierPageFailures > 1 ? 's' : ''} en erreur`;
    emitStructuredProgress({
      type: 'source:error',
      source: 'immobilier.ch',
      phase: 'sources',
      error,
      found: immobilierItems.length,
      message: `immobilier.ch: ${error}`
    });
    sourceFailures.push(`immobilier.ch: ${error}`);
  } else {
    emitStructuredProgress({
      type: 'source:done',
      source: 'immobilier.ch',
      phase: 'sources',
      found: immobilierItems.length,
      message: `immobilier.ch: ${immobilierItems.length} annonces`
    });
  }

  const sourceTasks = [
    config.sources?.flatfox !== false && {
      label: 'flatfox.ch',
      run: () => scrapeFlatfoxListings(config)
    },
    config.sources?.naef !== false && {
      label: 'naef.ch',
      run: () => scrapeNaefListings(config)
    },
    config.sources?.bernardNicod !== false && {
      label: 'bernard-nicod.ch',
      run: () => scrapeBernardNicodListings(config, geocodeCache)
    },
    config.sources?.retraitesListings !== false && {
      label: 'Retraites Populaires',
      run: () => scrapeRetraitesPopulairesListings(config)
    },
    config.sources?.anibis !== false && {
      label: 'anibis.ch',
      run: () => scrapeAnibisListings(config)
    }
  ].filter(Boolean);

  const sourceResults = await runLimited(
    sourceTasks,
    Number(config.scanConcurrency?.sources ?? 3),
    async (task) => {
      emitStructuredProgress({
        type: 'source:start',
        source: task.label,
        phase: 'sources',
        message: `${task.label}: recherche des annonces`
      });

      try {
        const items = await task.run();
        if (!Array.isArray(items)) {
          throw new Error(`${task.label} scraper returned non-array result`);
        }
        completeUnit({
          type: 'source:done',
          source: task.label,
          phase: 'sources',
          found: items.length,
          units: 1,
          message: `${task.label}: ${items.length} annonces`
        });
        return items;
      } catch (err) {
        const message = err?.message || String(err);
        console.error(`WARN ${task.label}: ${message}`);
        completeUnit({
          type: 'source:error',
          source: task.label,
          phase: 'sources',
          error: message,
          units: 1,
          message: `${task.label}: erreur`
        });
        sourceFailures.push(`${task.label}: ${message}`);
        return [];
      }
    }
  );
  scraped.push(...sourceResults.flat());

  if (sourceFailures.length > 0) {
    throw new Error(`Scan interrompu: ${sourceFailures.join('; ')}`);
  }

  emitStructuredProgress({
    type: 'source:start',
    source: 'Préparation des annonces',
    kind: 'phase',
    phase: 'preparing-listings',
    message: 'Préparation des annonces'
  });

  const dedupById = new Map();
  for (const item of scraped) {
    const key = String(item.id);
    const existing = dedupById.get(key);
    if (!existing) {
      dedupById.set(key, item);
      continue;
    }

    const incomingRank = listingQualityRank(item, trackerMap);
    const existingRank = listingQualityRank(existing, trackerMap);
    dedupById.set(key, incomingRank > existingRank ? item : existing);
  }

  completeUnit({
    type: 'source:done',
    source: 'Préparation des annonces',
    kind: 'phase',
    phase: 'preparing-listings',
    message: 'Préparation des annonces terminée'
  });

  if (config.sources?.flatfox !== false) {
    emitStructuredProgress({
      type: 'source:start',
      source: 'Vérification Flatfox',
      kind: 'phase',
      phase: 'flatfox-recheck',
      message: 'Vérification Flatfox'
    });
    const recheckLimit = Math.max(0, Number(config.flatfox?.recheckKnownIdsLimit ?? 20));
    const missingKnownFlatfox = (tracker.listings || [])
      .filter((x) => x?.source === 'flatfox.ch' && x?.sourceId && !dedupById.has(String(x.id)))
      .slice(0, recheckLimit);

    for (const old of missingKnownFlatfox) {
      const recovered = await fetchFlatfoxListingById(old.sourceId, old.area || '');
      if (!recovered) continue;
      if (!isTargetAreaCity(recovered.area || '', targetAreaSet)) continue;

      const key = String(recovered.id);
      const existing = dedupById.get(key);
      if (!existing || listingQualityRank(recovered, trackerMap) > listingQualityRank(existing, trackerMap)) {
        dedupById.set(key, recovered);
      }
    }
    completeUnit({
      type: 'source:done',
      source: 'Vérification Flatfox',
      kind: 'phase',
      phase: 'flatfox-recheck',
      message: 'Vérification Flatfox terminée'
    });
  }

  emitStructuredProgress({
    type: 'source:start',
    source: 'Tri et déduplication',
    kind: 'phase',
    phase: 'dedupe',
    message: 'Tri et déduplication'
  });

  const { kept: crossSourceDeduped, removedIds: crossSourceRemovedIds } = dedupeCrossSourceListings([...dedupById.values()], trackerMap);
  const dedup = new Map(crossSourceDeduped.map((item) => [String(item.id), item]));
  const activeDedupKeys = new Set(
    crossSourceDeduped
      .map((item) => buildCrossSourceDedupKey(item))
      .filter(Boolean)
  );

  const now = new Date().toISOString();
  const merged = [];

  for (const item of dedup.values()) {
    // Suppress re-discovery: if this item matches a stubbed historical entry
    // (by id or by composite dedup key), skip processing entirely. The stub
    // already in `merged` (added by the loop below over tracker.listings)
    // represents this listing's filtered/removed state; re-promoting it here
    // would resurrect a previously-rejected listing without the user changing
    // any criteria.
    if (stubIds.has(String(item.id))) continue;
    const itemDedupKey = buildCrossSourceDedupKey(item);
    if (itemDedupKey && stubDedupKeys.has(itemDedupKey)) continue;

    item.lastSeenAt = now;

    const minBudget = Number(config.filters?.minTotalChf ?? 0);
    const hardBudget = config.filters?.maxTotalHardChf ?? 1450;
    item.excludedType = isExcludedType(item, config);
    item.sizeEligible = isSizeEligible(item, config);
    item.withinHardBudget = item.totalChf != null ? item.totalChf <= hardBudget : false;
    item.aboveMinBudget = minBudget <= 0 || (item.totalChf != null && item.totalChf >= minBudget);

    const publicationMeta = publicationEligibility(item, config);
    item.publishedAgeDays = publicationMeta.ageDays;
    item.maxPublishedAgeDays = publicationMeta.maxAgeDays;
    item.publicationEligible = publicationMeta.eligible;

    const locationMeta = locationEligibility(item, config);
    item.locationEligible = locationMeta.eligible;
    item.locationFilterReason = locationMeta.reason;

    const nonSpecMeta = nonSpeculativeEligibility(item, config);
    item.nonSpeculativeEligible = nonSpecMeta.eligible;
    item.nonSpeculativeFilterReason = nonSpecMeta.reason;

    const isOffMarketListing = String(item.listingStage || '').toLowerCase() === 'off_market';
    const trustedAnibisSearchUrlResult = isTrustedAnibisSearchUrlResult(item, config);

    item.display = trustedAnibisSearchUrlResult
      ? true
      : isOffMarketListing
      ? (!item.excludedType && item.locationEligible && item.nonSpeculativeEligible)
      : (!item.excludedType
        && item.sizeEligible
        && item.aboveMinBudget
        && item.withinHardBudget
        && item.publicationEligible
        && item.locationEligible
        && item.nonSpeculativeEligible);

    if (item.display) {
      if (item.source === 'immobilier.ch') {
        const moveIn = await fetchMoveInDate(item.sourceId || item.id);
        item.entryDateText = moveIn.date;
        item.entryDateFetched = moveIn.fetched;
      } else {
        const moveInDate = parseFlatfoxMoveInDate(item.movingDateRaw);
        item.entryDateText = isStrictEntryDate(moveInDate) ? moveInDate : null;
        item.entryDateFetched = Boolean(item.entryDateText);
      }
    } else {
      item.entryDateText = null;
      item.entryDateFetched = false;
    }
    // Commute is computed in a separate phase by recompute-distances.mjs after
    // the scan finishes, so the modal can close as soon as listings are ready.
    item.commutePending = true;

    if (!item.display) {
      if (item.excludedType) item.filterReason = 'Type exclu (chambre/colocation)';
      else if (!item.locationEligible) item.filterReason = item.locationFilterReason || 'Hors zones ciblées';
      else if (!item.nonSpeculativeEligible) item.filterReason = item.nonSpeculativeFilterReason || 'Bailleur hors liste non spéculative';
      else if (isOffMarketListing) item.filterReason = 'Signal off-market hors critères';
      else if (!item.aboveMinBudget) item.filterReason = `En dessous de CHF ${minBudget}`;
      else if (!item.sizeEligible) item.filterReason = 'Taille hors critères';
      else if (!item.publicationEligible) {
        item.filterReason = `Annonce trop ancienne (> ${item.maxPublishedAgeDays} jours)`;
      } else item.filterReason = `Au-dessus de CHF ${hardBudget}`;
    } else {
      item.filterReason = '';
    }

    const existing = trackerMap.get(String(item.id));
    if (existing) {
      const previousValidDate = isStrictEntryDate(existing.entryDateText) ? existing.entryDateText : null;
      const apiProvidedDate = isStrictEntryDate(item.entryDateText) ? item.entryDateText : null;
      const entryDateText = item.entryDateFetched ? apiProvidedDate : previousValidDate;
      const retainedCommute = projectRetainedCommuteFields(existing, {
        visible: item.display !== false,
        workAddress,
        workCoords
      });
      const commutePending = item.display !== false && needsCommuteRecompute(retainedCommute);

      merged.push({
        ...existing,
        ...item,
        pinned: !!existing.pinned,
        entryDateText,
        ...retainedCommute,
        commutePending,
        publishedAt: item.publishedAt || existing.publishedAt || null,
        status: normalizeStatus(existing.status || 'À trier'),
        notes: mergeNotesWithEntryDate(existing.notes || '', entryDateText),
        firstSeenAt: existing.firstSeenAt || now,
        active: true,
        isRemoved: false,
        removedAt: null,
        missingCount: 0,
        isNew: !prevIds.has(String(item.id))
      });
    } else {
      const entryDateText = isStrictEntryDate(item.entryDateText) ? item.entryDateText : null;
      const cleared = clearedCommuteFields();
      cleared.distanceFromWorkAddress = workAddress;
      merged.push({
        ...item,
        entryDateText,
        ...cleared,
        commutePending: item.display !== false,
        publishedAt: item.publishedAt || null,
        status: 'À trier',
        notes: mergeNotesWithEntryDate('', entryDateText),
        firstSeenAt: now,
        active: true,
        isRemoved: false,
        removedAt: null,
        missingCount: 0,
        isNew: true
      });
    }
  }

  function needsCommuteRecompute(commuteFields) {
    if (!commuteFields) return true;
    if (commuteFields.driveRouteStatus === 'route-failed') return true;
    if (commuteFields.transitRouteStatus === 'route-failed') return true;
    if (commuteFields.driveRouteStatus === 'geocode-failed') return true;
    if (commuteFields.transitRouteStatus === 'geocode-failed') return true;
    if (commuteFields.driveRouteStatus === 'cached-stale') return true;
    if (commuteFields.transitRouteStatus === 'cached-stale') return true;
    if (commuteFields.driveMinutes == null && commuteFields.transitMinutes == null) return true;
    return false;
  }

  for (const old of tracker.listings || []) {
    // Stubs are already-discarded entries kept only to suppress re-discovery.
    // Pass them through unchanged — no eligibility re-evaluation possible
    // since the full payload has been dropped.
    if (isStub(old)) {
      merged.push(old);
      continue;
    }

    if (!dedup.has(String(old.id))) {
      // If this listing was explicitly removed by cross-source dedup (enriched data
      // matched another active listing), mark it as a duplicate — not as "missing".
      if (crossSourceRemovedIds.has(String(old.id))) {
        merged.push({
          ...old,
          ...clearedCommuteFields(),
          status: normalizeStatus(old.status),
          active: false,
          isRemoved: true,
          removedAt: old.removedAt || now,
          missingCount: 0,
          isNew: false,
          display: false,
          filterReason: 'Doublon inter-source (dedup enrichie)'
        });
        continue;
      }

      let nextMissing = Number(old.missingCount || 0) + 1;

      const outOfScopeListing = !isTargetAreaCity(old.area || '', targetAreaSet);

      if (outOfScopeListing) {
        merged.push({
          ...old,
          ...clearedCommuteFields(),
          status: normalizeStatus(old.status),
          active: false,
          isRemoved: false,
          removedAt: old.removedAt || null,
          missingCount: nextMissing,
          isNew: false,
          display: false,
          filterReason: 'Hors zone suivie'
        });
        continue;
      }

      const sourceLower = String(old?.source || '').toLowerCase();
      const nonResidentialDirectSource = ['naef.ch', 'bernard-nicod.ch'].includes(sourceLower)
        && !isLikelyResidentialListing(old);
      if (nonResidentialDirectSource) {
        merged.push({
          ...old,
          ...clearedCommuteFields(),
          status: normalizeStatus(old.status),
          active: false,
          isRemoved: true,
          removedAt: old.removedAt || now,
          missingCount: nextMissing,
          isNew: false,
          display: false,
          filterReason: 'Objet non résidentiel (filtré)'
        });
        continue;
      }

      const minBudget = Number(config.filters?.minTotalChf ?? 0);
      const hardBudget = config.filters?.maxTotalHardChf ?? 1450;

      const publicationMeta = publicationEligibility(old, config);
      const locationMeta = locationEligibility(old, config);
      const nonSpecMeta = nonSpeculativeEligibility(old, config);

      const refreshed = {
        excludedType: isExcludedType(old, config),
        sizeEligible: isSizeEligible(old, config),
        withinHardBudget: old.totalChf != null ? old.totalChf <= hardBudget : false,
        aboveMinBudget: minBudget <= 0 || (old.totalChf != null && old.totalChf >= minBudget),
        publishedAgeDays: publicationMeta.ageDays,
        maxPublishedAgeDays: publicationMeta.maxAgeDays,
        publicationEligible: publicationMeta.eligible,
        locationEligible: locationMeta.eligible,
        locationFilterReason: locationMeta.reason,
        nonSpeculativeEligible: nonSpecMeta.eligible,
        nonSpeculativeFilterReason: nonSpecMeta.reason
      };

    const isOffMarketListing = String(old.listingStage || '').toLowerCase() === 'off_market';
    const trustedAnibisSearchUrlResult = isTrustedAnibisSearchUrlResult(old, config);

    refreshed.display = trustedAnibisSearchUrlResult
      ? true
      : isOffMarketListing
      ? (!refreshed.excludedType && refreshed.locationEligible && refreshed.nonSpeculativeEligible)
      : (!refreshed.excludedType
          && refreshed.sizeEligible
          && refreshed.aboveMinBudget
          && refreshed.withinHardBudget
          && refreshed.publicationEligible
          && refreshed.locationEligible
          && refreshed.nonSpeculativeEligible);

      if (!refreshed.display) {
        if (refreshed.excludedType) refreshed.filterReason = 'Type exclu (chambre/colocation)';
        else if (!refreshed.locationEligible) refreshed.filterReason = refreshed.locationFilterReason || 'Hors zones ciblées';
        else if (!refreshed.nonSpeculativeEligible) refreshed.filterReason = refreshed.nonSpeculativeFilterReason || 'Bailleur hors liste non spéculative';
        else if (isOffMarketListing) refreshed.filterReason = 'Signal off-market hors critères';
        else if (!refreshed.aboveMinBudget) refreshed.filterReason = `En dessous de CHF ${minBudget}`;
        else if (!refreshed.sizeEligible) refreshed.filterReason = 'Taille hors critères';
        else if (!refreshed.publicationEligible) {
          refreshed.filterReason = `Annonce trop ancienne (> ${refreshed.maxPublishedAgeDays} jours)`;
        } else refreshed.filterReason = `Au-dessus de CHF ${hardBudget}`;
      } else {
        refreshed.filterReason = '';
      }

      const oldDedupKey = buildCrossSourceDedupKey(old);
      const duplicateOfActive = refreshed.display !== false && oldDedupKey && activeDedupKeys.has(oldDedupKey);
      const excludedAnibisSale = isStoredAnibisSaleListing(old);
      const anibisSourceDisabled = String(old?.source || '') === 'anibis.ch' && config.sources?.anibis === false;
      let shouldRemove = duplicateOfActive || excludedAnibisSale || anibisSourceDisabled
        ? true
        : (refreshed.display === false ? false : nextMissing >= missingScansBeforeRemoved);

      // Before marking a visible listing as removed due to missing scans,
      // verify the listing URL is actually gone. If the page is still live,
      // reset missingCount and keep it active.
      if (shouldRemove && !duplicateOfActive && !excludedAnibisSale && !anibisSourceDisabled
          && refreshed.display !== false && old.url) {
        const stillLive = await isListingUrlStillLive(old.url);
        if (stillLive) {
          shouldRemove = false;
          nextMissing = 0;
          console.log(`INFO ${old.id}: URL still live, keeping active despite missing from scrape`);
        }
      }

      if (duplicateOfActive || excludedAnibisSale || anibisSourceDisabled) {
        merged.push({
          ...old,
          ...clearedCommuteFields(),
          status: normalizeStatus(old.status),
          active: false,
          isRemoved: true,
          removedAt: old.removedAt || now,
          missingCount: nextMissing,
          isNew: false,
          display: false,
          filterReason: duplicateOfActive
            ? 'Doublon inter-source'
            : (excludedAnibisSale ? 'Annonce vente exclue (Anibis)' : 'Source Anibis désactivée')
        });
        continue;
      }

      const commuteFields = projectRetainedCommuteFields(old, {
        visible: !shouldRemove && refreshed.display !== false,
        workAddress,
        workCoords
      });

      merged.push({
        ...old,
        ...refreshed,
        ...commuteFields,
        status: normalizeStatus(old.status),
        active: !shouldRemove,
        isRemoved: shouldRemove,
        removedAt: shouldRemove ? old.removedAt || now : null,
        missingCount: nextMissing,
        isNew: false
      });
    }
  }

  for (const item of merged) {
    if (isStub(item)) continue;
    delete item.isPearl;
    delete item.score;
    delete item.scoreBreakdown;
    delete item.scoreTooltip;
  }

  merged.sort((a, b) => {
    // Stubs sort last (after active and after non-stub removed entries).
    const aStub = isStub(a) ? 1 : 0;
    const bStub = isStub(b) ? 1 : 0;
    if (aStub !== bStub) return aStub - bStub;
    const av = a.active ? 1 : 0;
    const bv = b.active ? 1 : 0;
    if (av !== bv) return bv - av;
    return (a.totalChf || 999999) - (b.totalChf || 999999);
  });

  normalizeListingImageFields(merged.filter((x) => !isStub(x)));

  const visibleActive = merged.filter((x) => !isStub(x) && x.active && x.display !== false);
  const visibleRemoved = merged.filter((x) => !isStub(x) && !x.active && x.display !== false && x.isRemoved);
  const visibleAll = merged.filter((x) => !isStub(x) && x.display !== false);

  // Archive images only while flats are still visible/active.
  completeUnit({
    type: 'source:done',
    source: 'Tri et déduplication',
    kind: 'phase',
    phase: 'dedupe',
    message: 'Tri et déduplication terminés'
  });
  emitStructuredProgress({
    type: 'source:start',
    source: 'Images et sauvegarde',
    kind: 'phase',
    phase: 'saving',
    message: 'Images et sauvegarde'
  });
  await localizeVisibleListingImages(visibleActive, config);

  const matching = visibleActive;
  const newListings = matching.filter((x) => x.isNew || !prevIds.has(String(x.id)));

  const latest = {
    generatedAt: now,
    totalCount: visibleActive.length,
    removedCount: visibleRemoved.length,
    matchingCount: matching.length,
    newCount: newListings.length,
    newListings,
    matching,
    all: visibleAll
  };

  // Slim discarded entries to compact stubs (id, dedupKey, filterReason,
  // timestamps). Existing stubs are passed through unchanged. Then drop
  // stubs older than 90 days so tracker.json stays bounded.
  let newlyStubbed = 0;
  const persisted = [];
  for (const entry of merged) {
    if (isStub(entry)) {
      persisted.push(entry);
      continue;
    }
    if (entry.isRemoved === true || entry.display === false) {
      const stub = toDiscardedStub(entry);
      if (stub) {
        persisted.push(stub);
        newlyStubbed += 1;
      }
      continue;
    }
    persisted.push(entry);
  }

  const STUB_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - STUB_TTL_MS;
  const isExpiredStub = (entry) => {
    if (!isStub(entry)) return false;
    const newest = entry.removedAt || entry.lastSeenAt || entry.firstSeenAt;
    if (!newest) return false; // no timestamp → keep, can't reason about age
    const ts = Date.parse(newest);
    return Number.isFinite(ts) && ts < cutoff;
  };
  const prunedListings = persisted.filter((entry) => !isExpiredStub(entry));
  const prunedCount = persisted.length - prunedListings.length;
  const finalStubCount = prunedListings.filter(isStub).length;
  const fullCount = prunedListings.length - finalStubCount;

  console.log(
    `Tracker: ${prunedListings.length} entries (${fullCount} full + ${finalStubCount} stubs; ${newlyStubbed} stubbed this scan; pruned ${prunedCount} stubs > 90 days)`
  );

  const newTracker = {
    ...tracker,
    updatedAt: now,
    criteria: config,
    statuses: STATUSES,
    statusWorkflowVersion: STATUS_WORKFLOW_VERSION,
    listings: prunedListings
  };

  await fs.writeFile(GEOCODE_CACHE_PATH, JSON.stringify(geocodeCache, null, 2));
  await fs.writeFile(ROUTE_CACHE_PATH, JSON.stringify(routeCache, null, 2));
  await fs.writeFile(TRACKER_PATH, JSON.stringify(newTracker, null, 2));
  await fs.writeFile(LATEST_PATH, JSON.stringify(latest, null, 2));
  completeUnit({
    type: 'source:done',
    source: 'Images et sauvegarde',
    kind: 'phase',
    phase: 'saving',
    message: 'Images et sauvegarde terminées'
  });

  console.log(makeSummary(latest));
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
