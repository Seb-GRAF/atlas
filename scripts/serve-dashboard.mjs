#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_DIR = path.join(ROOT, 'dashboard');
const DASHBOARD_DIST_DIR = path.join(DASHBOARD_DIR, 'dist');
const LEGACY_DATA_DIR = path.join(ROOT, 'data');
const PROFILES_DATA_DIR = path.join(LEGACY_DATA_DIR, 'profiles');
const SCRAPE_SCRIPT = path.join(ROOT, 'scripts', 'scrape-immobilier.mjs');

const PORT = Number(process.env.PORT || 8787);
const DEFAULT_PROFILE = sanitizeProfileValue(process.env.APARTMENT_PROFILE || process.env.APART_PROFILE || 'vaud-3-pieces');
const scanJobs = new Map();
const scanAllJobs = new Map();
const STATUS_WORKFLOW_VERSION = 2;
const GEO_ADMIN_SEARCH_URL = process.env.GEO_ADMIN_SEARCH_URL || 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const MAP_GEOCODE_ON_STATE = process.env.MAP_GEOCODE_ON_STATE !== '0';
const MAP_GEOCODE_BATCH_LIMIT = Math.max(0, Number(process.env.MAP_GEOCODE_BATCH_LIMIT || 12));
const DEFAULT_STATUSES = [
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
const SCRAPER_PROGRESS_PREFIX = '__SCAN_PROGRESS__';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml'
};

function sanitizeProfileValue(value, fallback = 'vaud-3-pieces') {
  const clean = String(value || fallback).trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(clean) ? clean : fallback;
}

function sanitizeProfile(value = DEFAULT_PROFILE) {
  return sanitizeProfileValue(value, DEFAULT_PROFILE);
}

function profilePaths(profile) {
  const dataDir = path.join(PROFILES_DATA_DIR, profile);
  return {
    profile,
    dataDir,
    configPath: path.join(dataDir, 'watch-config.json'),
    trackerPath: path.join(dataDir, 'tracker.json'),
    latestPath: path.join(dataDir, 'latest-listings.json'),
    geocodeCachePath: path.join(dataDir, 'geocode-cache.json'),
    routeCachePath: path.join(dataDir, 'route-cache.json')
  };
}

const LEGACY_FILES = {
  configPath: path.join(LEGACY_DATA_DIR, 'watch-config.json'),
  trackerPath: path.join(LEGACY_DATA_DIR, 'tracker.json'),
  latestPath: path.join(LEGACY_DATA_DIR, 'latest-listings.json'),
  geocodeCachePath: path.join(LEGACY_DATA_DIR, 'geocode-cache.json'),
  routeCachePath: path.join(LEGACY_DATA_DIR, 'route-cache.json')
};

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function toFinitePoint(value) {
  if (!value || typeof value !== 'object') return null;
  const lat = Number(value.lat);
  const lon = Number(value.lon ?? value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
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

  if (addressRaw) return [addressRaw, 'Suisse'].filter(Boolean).join(', ');
  if (area) return [area, 'Suisse'].filter(Boolean).join(', ');
  return '';
}

function buildSwissAddressSearchText(item) {
  const addressRaw = sanitizeAddressPart(item.address || '');
  if (!addressRaw) return '';

  const parts = addressRaw.split(',').map((part) => part.trim()).filter(Boolean);
  const area = sanitizeAddressPart(item.area || '');
  if (parts.length > 1 && normalizeLocationText(parts[0]) === normalizeLocationText(area)) {
    return [...parts.slice(1), parts[0]].join(', ');
  }

  return addressRaw.replace(/,\s*Suisse\s*$/i, '').trim();
}

function normalizeLocationText(value = '') {
  return sanitizeAddressPart(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isPostalCityPart(value = '') {
  return /^\d{4,5}\s+\D+$/i.test(sanitizeAddressPart(value));
}

function hasStreetSignal(value = '') {
  const text = normalizeLocationText(value);
  if (!text) return false;
  if (/\b(contactez|agence|adresse|demande)\b/.test(text)) return false;
  if (/\b\d+[a-z]?\b/.test(text)) return true;
  return /\b(rue|route|rte|avenue|av|chemin|chem|ch|boulevard|bd|place|passage|impasse|quai|sentier|allee|montee|promenade)\b/.test(text);
}

function inferMapPrecision(item) {
  const addressRaw = sanitizeAddressPart(item.address || '');
  if (!addressRaw) return 'area';

  const area = normalizeLocationText(item.area || '');
  const candidates = addressRaw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => normalizeLocationText(part) !== area)
    .filter((part) => !isPostalCityPart(part));

  return candidates.some(hasStreetSignal) ? 'address' : 'area';
}

async function fetchGeoAdminPoint(searchText) {
  if (!searchText) return null;
  const url = new URL(GEO_ADMIN_SEARCH_URL);
  url.searchParams.set('searchText', searchText);
  url.searchParams.set('type', 'locations');
  url.searchParams.set('origins', 'address');
  url.searchParams.set('limit', '1');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`geo.admin.ch ${res.status}`);

  const payload = await res.json();
  const result = Array.isArray(payload?.results) ? payload.results[0] : null;
  const point = toFinitePoint(result?.attrs);
  return point ? { ...point, searchText } : null;
}

async function hydrateMissingStreetGeocodes(tracker, geocodeCache, geocodeCachePath) {
  if (!MAP_GEOCODE_ON_STATE || MAP_GEOCODE_BATCH_LIMIT <= 0 || !geocodeCache || typeof geocodeCache !== 'object') return false;
  const listings = Array.isArray(tracker?.listings) ? tracker.listings : [];
  let updated = false;
  let remaining = MAP_GEOCODE_BATCH_LIMIT;

  const candidates = listings
    .filter((item) => item && item.display !== false && !item.isRemoved && inferMapPrecision(item) === 'address')
    .filter((item) => !getCachedPoint(geocodeCache, buildListingAddressQuery(item)))
    .sort((a, b) => {
      const aTriage = normalizeStatus(a.status) === 'À trier' ? 0 : 1;
      const bTriage = normalizeStatus(b.status) === 'À trier' ? 0 : 1;
      return aTriage - bTriage;
    });

  for (const item of candidates) {
    if (remaining <= 0) break;
    remaining -= 1;

    const cacheKey = buildListingAddressQuery(item).toLowerCase();
    const searchText = buildSwissAddressSearchText(item);
    if (!cacheKey || !searchText) continue;

    try {
      const point = await fetchGeoAdminPoint(searchText);
      if (!point) continue;
      geocodeCache[cacheKey] = { lat: point.lat, lon: point.lon };
      updated = true;
    } catch {
      // Keep the visible approximate fallback when exact Swiss geocoding is unavailable.
    }
  }

  if (updated) {
    await fs.writeFile(geocodeCachePath, JSON.stringify(geocodeCache, null, 2));
  }
  return updated;
}

function getCachedPoint(cache, query) {
  if (!query || !cache || typeof cache !== 'object') return null;
  const key = String(query).toLowerCase();
  return toFinitePoint(cache[key]);
}

function isAreaLevelCacheKey(key, area) {
  const cleanKey = String(key || '').replace(/,\s*suisse\s*$/i, '').trim();
  const normalizedKey = normalizeLocationText(cleanKey);
  return normalizedKey === area || isPostalCityPart(cleanKey);
}

function getAreaFallbackPoint(cache, item) {
  if (!cache || typeof cache !== 'object') return null;

  const area = normalizeLocationText(item.area || '');
  if (!area) return null;

  const candidates = [];
  for (const [key, value] of Object.entries(cache)) {
    const normalizedKey = normalizeLocationText(key);
    if (!normalizedKey.endsWith(`${area} suisse`)) continue;

    const point = toFinitePoint(value);
    if (point) candidates.push({ ...point, query: key, areaLevel: isAreaLevelCacheKey(key, area) });
  }

  return candidates.find((candidate) => candidate.areaLevel) || candidates[0] || null;
}

function enrichStateWithMap(tracker, config, geocodeCache) {
  const warnings = [];
  const listings = Array.isArray(tracker?.listings) ? tracker.listings : [];
  let listingsWithCoordinates = 0;
  let listingsMissingCoordinates = 0;

  const enrichListing = (item, count = false) => {
    const directPoint = toFinitePoint(item.mapLocation) || toFinitePoint(item.location) || toFinitePoint(item.coordinates);
    if (directPoint) {
      const query = item.mapLocation?.query || buildListingAddressQuery(item);
      item.mapLocation = {
        lat: directPoint.lat,
        lon: directPoint.lon,
        query,
        source: 'listing',
        precision: ['address', 'area'].includes(item.mapLocation?.precision) ? item.mapLocation.precision : inferMapPrecision(item)
      };
      if (count) listingsWithCoordinates += 1;
      return;
    }

    const query = buildListingAddressQuery(item);
    const cachedPoint = getCachedPoint(geocodeCache, query);
    if (cachedPoint) {
      item.mapLocation = {
        lat: cachedPoint.lat,
        lon: cachedPoint.lon,
        query,
        source: 'geocode-cache',
        precision: inferMapPrecision(item)
      };
      if (count) listingsWithCoordinates += 1;
      return;
    }

    const fallbackPoint = getAreaFallbackPoint(geocodeCache, item);
    if (fallbackPoint) {
      item.mapLocation = {
        lat: fallbackPoint.lat,
        lon: fallbackPoint.lon,
        query: fallbackPoint.query,
        source: 'geocode-cache',
        precision: 'area'
      };
      if (count) listingsWithCoordinates += 1;
      return;
    }

    delete item.mapLocation;
    if (count) listingsMissingCoordinates += 1;
  };

  for (const item of listings) {
    enrichListing(item, true);
  }

  const workplaceAddress = config?.preferences?.workplaceAddress || null;
  const workplacePoint = getCachedPoint(geocodeCache, workplaceAddress);
  const workplace = workplaceAddress && workplacePoint
    ? { address: workplaceAddress, lat: workplacePoint.lat, lon: workplacePoint.lon }
    : null;

  if (listingsMissingCoordinates > 0) {
    warnings.push(`${listingsMissingCoordinates} annonce${listingsMissingCoordinates > 1 ? 's' : ''} sans coordonnées en cache.`);
  }
  if (workplaceAddress && !workplace) {
    warnings.push("Adresse de travail sans coordonnées en cache.");
  }

  return {
    workplace,
    listingsWithCoordinates,
    listingsMissingCoordinates,
    warnings
  };
}

function enrichLatestWithMap(latest, geocodeCache) {
  if (!latest || typeof latest !== 'object') return;
  for (const arr of [latest.all, latest.matching, latest.newListings]) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const query = buildListingAddressQuery(item);
      const cachedPoint = getCachedPoint(geocodeCache, query);
      if (cachedPoint) {
        item.mapLocation = {
          lat: cachedPoint.lat,
          lon: cachedPoint.lon,
          query,
          source: 'geocode-cache',
          precision: inferMapPrecision(item)
        };
      } else {
        const fallbackPoint = getAreaFallbackPoint(geocodeCache, item);
        if (fallbackPoint) {
          item.mapLocation = {
            lat: fallbackPoint.lat,
            lon: fallbackPoint.lon,
            query: fallbackPoint.query,
            source: 'geocode-cache',
            precision: 'area'
          };
        } else {
          delete item.mapLocation;
        }
      }
    }
  }
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

function trackerNeedsStatusMigration(tracker) {
  return !tracker || Number(tracker.statusWorkflowVersion || 1) < STATUS_WORKFLOW_VERSION;
}

function migrateTrackerStatuses(tracker) {
  if (!tracker || typeof tracker !== 'object') return tracker;
  const legacy = trackerNeedsStatusMigration(tracker);
  const normalize = legacy ? normalizeLegacyStatus : normalizeStatus;

  if (Array.isArray(tracker.listings)) {
    for (const item of tracker.listings) {
      item.status = normalize(item.status);
    }
  }

  tracker.statuses = mergeStatuses(tracker.statuses, normalize);
  tracker.statusWorkflowVersion = STATUS_WORKFLOW_VERSION;
  return tracker;
}

function mergeStatuses(statuses = [], normalize = normalizeStatus) {
  return [...new Set([...DEFAULT_STATUSES, ...(Array.isArray(statuses) ? statuses.map(normalize) : [])])];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function makeDefaultConfig(profile, base = null) {
  if (base && typeof base === 'object') {
    // Use existing config as template (backward compat for ensureProfileStorage)
    const copy = JSON.parse(JSON.stringify(base));
    if (copy.filters && typeof copy.filters === 'object') {
      delete copy.filters.maxPearlTotalChf;
      delete copy.filters.pearl;
    }
    return copy;
  }

  // Generic default config for new profiles
  return {
    name: profile.charAt(0).toUpperCase() + profile.slice(1),
    shortTitle: profile.charAt(0).toUpperCase() + profile.slice(1),
    areas: [{ slug: profile, label: profile.charAt(0).toUpperCase() + profile.slice(1) }],
    pagesPerArea: 2,
    sources: {
      immobilier: true,
      flatfox: true,
      naef: true,
      bernardNicod: true,
      retraitesListings: true,
      retraitesProjets: true,
      anibis: false
    },
    flatfox: { maxPagesPerArea: 3, recheckKnownIdsLimit: 20 },
    filters: {
      maxTotalChf: 1400,
      maxTotalHardChf: 1550,
      minRoomsPreferred: 2,
      minSurfaceM2Preferred: 0,
      excludedObjectTypeKeywords: ['chambre', 'colocation', 'wg'],
      missingScansBeforeRemoved: 2,
      maxPublishedAgeDays: null
    },
    preferences: {
      workplaceAddress: null
    }
  };
}

function stripRetiredBudgetBypassFilters(filters = {}) {
  const clean = { ...(filters || {}) };
  delete clean.maxPearlTotalChf;
  delete clean.pearl;
  return clean;
}

function stripRetiredListingFields(state) {
  if (!state || typeof state !== 'object') return;
  const lists = [
    state.listings,
    state.all,
    state.matching,
    state.newListings
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      delete item.isPearl;
      delete item.score;
      delete item.scoreBreakdown;
      delete item.scoreTooltip;
    }
  }
}

async function ensureProfileStorage(profile) {
  const paths = profilePaths(profile);

  await fs.mkdir(PROFILES_DATA_DIR, { recursive: true });
  await fs.mkdir(paths.dataDir, { recursive: true });

  if (profile === 'vevey') {
    for (const key of Object.keys(LEGACY_FILES)) {
      const target = paths[key];
      const legacy = LEGACY_FILES[key];
      if (!(await fileExists(target)) && (await fileExists(legacy))) {
        await fs.copyFile(legacy, target);
      }
    }
  }

  if (!(await fileExists(paths.configPath))) {
    const veveyConfig = await readJsonSafe(path.join(PROFILES_DATA_DIR, 'vevey', 'watch-config.json'), null);
    const legacyConfig = await readJsonSafe(LEGACY_FILES.configPath, null);
    const baseConfig = veveyConfig || legacyConfig || null;
    const cfg = makeDefaultConfig(profile, baseConfig);
    await fs.writeFile(paths.configPath, JSON.stringify(cfg, null, 2));
  }

  return paths;
}

function getProfileFromRequest(u) {
  return sanitizeProfile(u.searchParams.get('profile') || DEFAULT_PROFILE);
}

async function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': MIME['.json'] });
  res.end(body);
}

async function serveFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

async function serveSpaIndex(res) {
  const indexPath = path.join(DASHBOARD_DIST_DIR, 'index.html');
  if (await fileExists(indexPath)) return serveFile(res, indexPath);
  return serveFile(res, path.join(DASHBOARD_DIR, 'index.html'));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function updateStatus(profile, id, status, notes, options = {}) {
  const paths = await ensureProfileStorage(profile);
  const tracker = await readJsonSafe(paths.trackerPath, null);
  if (!tracker || !Array.isArray(tracker.listings)) return false;
  migrateTrackerStatuses(tracker);

  const item = tracker.listings.find((x) => String(x.id) === String(id));
  if (!item) return false;

  if (status) item.status = normalizeStatus(status);
  if (typeof notes === 'string') item.notes = notes;
  if (options.reopen) {
    item.active = true;
    item.isRemoved = false;
    item.removedAt = null;
    item.missingCount = 0;
    item.display = true;
  }
  item.updatedAt = new Date().toISOString();

  tracker.updatedAt = new Date().toISOString();
  await fs.writeFile(paths.trackerPath, JSON.stringify(tracker, null, 2));
  return true;
}

async function togglePin(profile, id) {
  const paths = await ensureProfileStorage(profile);
  const tracker = await readJsonSafe(paths.trackerPath, null);
  if (!tracker || !Array.isArray(tracker.listings)) return null;

  const item = tracker.listings.find((x) => String(x.id) === String(id));
  if (!item) return null;

  item.pinned = !item.pinned;
  item.updatedAt = new Date().toISOString();
  tracker.updatedAt = new Date().toISOString();
  await fs.writeFile(paths.trackerPath, JSON.stringify(tracker, null, 2));

  // Also update latest-listings.json so the dashboard reflects the change immediately
  const latest = await readJsonSafe(paths.latestPath, null);
  if (latest) {
    for (const arr of [latest.all, latest.matching, latest.newListings]) {
      if (!Array.isArray(arr)) continue;
      const found = arr.find((x) => String(x.id) === String(id));
      if (found) found.pinned = item.pinned;
    }
    await fs.writeFile(paths.latestPath, JSON.stringify(latest, null, 2));
  }

  return item.pinned;
}

async function deleteListing(profile, id) {
  const paths = await ensureProfileStorage(profile);
  const tracker = await readJsonSafe(paths.trackerPath, null);
  if (!tracker || !Array.isArray(tracker.listings)) return false;

  const before = tracker.listings.length;
  tracker.listings = tracker.listings.filter((x) => String(x.id) !== String(id));
  if (tracker.listings.length === before) return false;

  tracker.updatedAt = new Date().toISOString();
  await fs.writeFile(paths.trackerPath, JSON.stringify(tracker, null, 2));

  const latest = await readJsonSafe(paths.latestPath, null);
  if (latest && Array.isArray(latest.all)) {
    latest.all = latest.all.filter((x) => String(x.id) !== String(id));
    latest.matching = (latest.matching || []).filter((x) => String(x.id) !== String(id));
    latest.newListings = (latest.newListings || []).filter((x) => String(x.id) !== String(id));
    latest.totalCount = (latest.all || []).filter((x) => !x.isRemoved).length;
    latest.removedCount = (latest.all || []).filter((x) => x.isRemoved).length;
    latest.matchingCount = latest.matching.length;
    latest.newCount = latest.newListings.length;
    await fs.writeFile(paths.latestPath, JSON.stringify(latest, null, 2));
  }

  return true;
}

async function runScan(profile, onProgress = null, onChild = null) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRAPE_SCRIPT, `--profile=${profile}`], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: onProgress
        ? { ...process.env, SCAN_PROGRESS: '1' }
        : process.env
    });

    if (onChild) onChild(child);

    let out = '';
    let err = '';
    let stdoutBuffer = '';
    const appendStdoutLine = (line) => {
      if (!line) return;
      if (line.startsWith(SCRAPER_PROGRESS_PREFIX)) {
        try {
          const progress = JSON.parse(line.slice(SCRAPER_PROGRESS_PREFIX.length));
          if (onProgress) onProgress(progress);
        } catch (parseErr) {
          err += `${parseErr.message}\n`;
        }
        return;
      }
      out += `${line}\n`;
    };

    child.stdout.on('data', (d) => {
      stdoutBuffer += d.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) appendStdoutLine(line);
    });
    child.stderr.on('data', (d) => (err += d.toString()));

    child.on('close', (code, signal) => {
      appendStdoutLine(stdoutBuffer);
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        const cancelErr = new Error('Scan annulé');
        cancelErr.cancelled = true;
        reject(cancelErr);
        return;
      }
      if (code === 0) resolve(out.trim());
      else reject(new Error(err || out || `Scan failed (${code})`));
    });
  });
}

function killScanChild(child) {
  if (!child || child.killed || child.exitCode != null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    // ignore — process likely already exited
  }
  setTimeout(() => {
    if (!child.killed && child.exitCode == null) {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }, 3000).unref();
}

function createScanJob(profile) {
  const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    status: 'running',
    profile,
    total: 0,
    done: 0,
    currentStep: 'Préparation du scan',
    startedAt: new Date().toISOString(),
    cancelled: false,
    child: null
  };
  scanJobs.set(jobId, job);

  (async () => {
    try {
      await ensureProfileStorage(profile);
      const summary = await runScan(
        profile,
        (progress) => {
          job.total = Number(progress.total || job.total || 0);
          job.done = Number(progress.done || 0);
          job.currentStep = String(progress.currentStep || job.currentStep || '');
          job.updatedAt = progress.at || new Date().toISOString();
        },
        (child) => {
          job.child = child;
          if (job.cancelled) killScanChild(child);
        }
      );
      const newCount = await readProfileNewCount(profile);
      job.status = 'done';
      job.summary = summary;
      job.newCount = newCount;
      job.done = job.total || job.done;
      job.currentStep = 'Scan terminé';
      job.finishedAt = new Date().toISOString();
    } catch (err) {
      if (job.cancelled || err.cancelled) {
        job.status = 'cancelled';
        job.currentStep = 'Scan annulé';
      } else {
        job.status = 'error';
        job.error = err.message;
        job.currentStep = 'Scan interrompu';
      }
      job.finishedAt = new Date().toISOString();
    } finally {
      job.child = null;
    }

    setTimeout(() => scanJobs.delete(jobId), 10 * 60 * 1000);
  })();

  return { jobId, job };
}

function isIsoToday(value) {
  if (!value) return false;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return false;
  const today = new Date();
  return d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
}

async function readProfileNewCount(profile) {
  const latest = await readJsonSafe(profilePaths(profile).latestPath, {});
  const items = Array.isArray(latest.newListings) ? latest.newListings : [];
  return items.filter((item) => isIsoToday(item.firstSeenAt)).length;
}

async function listProfiles() {
  try {
    const entries = await fs.readdir(PROFILES_DATA_DIR, { withFileTypes: true });
    const profiles = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const configPath = path.join(PROFILES_DATA_DIR, entry.name, 'watch-config.json');
      const cfg = await readJsonSafe(configPath, null);
      if (!cfg) continue;
      const areas = (cfg.areas || []).map((a) => a.label).join(' · ');
      const shortTitle = cfg.shortTitle || entry.name.charAt(0).toUpperCase() + entry.name.slice(1);
      const trackerPath = path.join(PROFILES_DATA_DIR, entry.name, 'tracker.json');
      const latestPath = path.join(PROFILES_DATA_DIR, entry.name, 'latest-listings.json');
      const tracker = await readJsonSafe(trackerPath, { listings: [] });
      const latest = await readJsonSafe(latestPath, {});
      const listingsCount = (tracker.listings || []).filter((x) => !x.isRemoved).length;
      profiles.push({
        slug: entry.name,
        name: cfg.name || entry.name,
        shortTitle,
        label: `Profil – ${shortTitle}`,
        areas,
        listingsCount,
        maxRent: cfg.filters?.maxTotalChf ?? null,
        lastScanAt: latest.generatedAt || null
      });
    }
    profiles.sort((a, b) => a.slug.localeCompare(b.slug));
    return profiles;
  } catch {
    return [];
  }
}

function buildConfigFromPayload(payload, base = null) {
  const existing = base && typeof base === 'object' ? JSON.parse(JSON.stringify(base)) : {};
  const shortTitle = String(payload.shortTitle || '').trim();
  const areas = Array.isArray(payload.areas) ? payload.areas.map((a) => {
    const entry = {
      slug: String(a.slug || '').trim(),
      label: String(a.label || '').trim()
    };
    if (a.canton) entry.canton = String(a.canton).trim().toLowerCase();
    if (a.lat != null) entry.lat = Number(a.lat);
    if (a.lon != null) entry.lon = Number(a.lon);
    return entry;
  }).filter((a) => a.slug && a.label) : [];

  const filters = payload.filters || {};
  const sources = payload.sources || {};
  const preferences = payload.preferences || {};
  const existingFilters = stripRetiredBudgetBypassFilters(existing.filters || {});

  const maxPublishedAgeRaw = filters.maxPublishedAgeDays;
  const maxPublishedAgeDays =
    maxPublishedAgeRaw === null || maxPublishedAgeRaw === undefined || maxPublishedAgeRaw === ''
      ? null
      : Number(maxPublishedAgeRaw);

  return {
    ...existing,
    name: shortTitle,
    shortTitle,
    areas,
    pagesPerArea: Math.max(1, Number(existing.pagesPerArea || 2)),
    sources: {
      ...(existing.sources || {}),
      immobilier: sources.immobilier !== false,
      flatfox: sources.flatfox !== false,
      naef: sources.naef !== false,
      bernardNicod: sources.bernardNicod !== false,
      retraitesListings: sources.retraitesListings !== false,
      retraitesProjets: sources.retraitesProjets !== false,
      anibis: !!sources.anibis
    },
    flatfox: {
      maxPagesPerArea: 3,
      recheckKnownIdsLimit: 20,
      ...(existing.flatfox || {})
    },
    filters: {
      ...existingFilters,
      minTotalChf: Number(filters.minTotalChf) || 0,
      maxTotalChf: Number(filters.maxTotalChf) || 1400,
      maxTotalHardChf: Number(filters.maxTotalHardChf) || 1550,
      minRoomsPreferred: Number(filters.minRoomsPreferred) || 2,
      maxRoomsPreferred:
        filters.maxRoomsPreferred == null || filters.maxRoomsPreferred === ''
          ? null
          : Number(filters.maxRoomsPreferred),
      minSurfaceM2Preferred: Number(filters.minSurfaceM2Preferred) || 0,
      allowMissingSurface: filters.allowMissingSurface !== false,
      excludedObjectTypeKeywords: Array.isArray(filters.excludedObjectTypeKeywords) && filters.excludedObjectTypeKeywords.length
        ? filters.excludedObjectTypeKeywords.map((x) => String(x).trim()).filter(Boolean)
        : ['chambre', 'colocation', 'wg'],
      missingScansBeforeRemoved: Math.max(1, Number(filters.missingScansBeforeRemoved) || 2),
      maxPublishedAgeDays: Number.isFinite(maxPublishedAgeDays) && maxPublishedAgeDays > 0
        ? maxPublishedAgeDays
        : null
    },
    preferences: {
      ...(existing.preferences || {}),
      workplaceAddress: preferences.workplaceAddress || null
    }
  };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);

  if (req.method === 'GET' && u.pathname === '/api/profiles') {
    const profiles = await listProfiles();
    return sendJson(res, 200, { profiles });
  }

  if (req.method === 'GET' && u.pathname === '/api/profile/detail') {
    const slug = sanitizeProfile(u.searchParams.get('profile') || '');
    const configPath = path.join(PROFILES_DATA_DIR, slug, 'watch-config.json');
    const cfg = await readJsonSafe(configPath, null);
    if (!cfg) return sendJson(res, 404, { ok: false, error: 'Profil introuvable' });
    return sendJson(res, 200, {
      ok: true,
      profile: {
        slug,
        shortTitle: cfg.shortTitle || slug,
        areas: cfg.areas || [],
        sources: cfg.sources || {},
        filters: stripRetiredBudgetBypassFilters(cfg.filters || {}),
        preferences: cfg.preferences || {}
      }
    });
  }

  if (req.method === 'POST' && u.pathname === '/api/profile/create') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      const slug = sanitizeProfile(payload.slug || '');
      if (!slug) return sendJson(res, 400, { ok: false, error: 'Slug invalide' });

      const profileDir = path.join(PROFILES_DATA_DIR, slug);
      if (await fileExists(path.join(profileDir, 'watch-config.json'))) {
        return sendJson(res, 409, { ok: false, error: 'Ce profil existe déjà' });
      }

      await fs.mkdir(profileDir, { recursive: true });
      const cfg = buildConfigFromPayload(payload);
      await fs.writeFile(path.join(profileDir, 'watch-config.json'), JSON.stringify(cfg, null, 2));
      await fs.writeFile(
        path.join(profileDir, 'tracker.json'),
        JSON.stringify(
          { listings: [], statuses: DEFAULT_STATUSES, statusWorkflowVersion: STATUS_WORKFLOW_VERSION, updatedAt: new Date().toISOString() },
          null,
          2
        )
      );
      return sendJson(res, 201, { ok: true, slug });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && u.pathname === '/api/profile/update') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      const slug = sanitizeProfile(payload.slug || '');
      if (!slug) return sendJson(res, 400, { ok: false, error: 'Slug invalide' });

      const configPath = path.join(PROFILES_DATA_DIR, slug, 'watch-config.json');
      if (!(await fileExists(configPath))) {
        return sendJson(res, 404, { ok: false, error: 'Profil introuvable' });
      }

      const existingConfig = await readJsonSafe(configPath, null);
      const cfg = buildConfigFromPayload(payload, existingConfig);
      await fs.writeFile(configPath, JSON.stringify(cfg, null, 2));
      return sendJson(res, 200, { ok: true, slug });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && u.pathname === '/api/profile/delete') {
    try {
      const raw = await readBody(req);
      const { slug } = JSON.parse(raw || '{}');
      const clean = sanitizeProfile(slug || '');
      if (!clean) return sendJson(res, 400, { ok: false, error: 'Slug invalide' });

      const profileDir = path.join(PROFILES_DATA_DIR, clean);
      if (!(await fileExists(path.join(profileDir, 'watch-config.json')))) {
        return sendJson(res, 404, { ok: false, error: 'Profil introuvable' });
      }

      await fs.rm(profileDir, { recursive: true, force: true });
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && u.pathname === '/api/state') {
    const profile = getProfileFromRequest(u);
    const paths = await ensureProfileStorage(profile);

    const [tracker, latest, config, geocodeCache] = await Promise.all([
      readJsonSafe(paths.trackerPath, { listings: [], statuses: [] }),
      readJsonSafe(paths.latestPath, { all: [], matching: [], generatedAt: null, newCount: 0 }),
      readJsonSafe(paths.configPath, { areas: [] }),
      readJsonSafe(paths.geocodeCachePath, {})
    ]);

    const writeMigratedTracker = trackerNeedsStatusMigration(tracker);
    migrateTrackerStatuses(tracker);
    if (writeMigratedTracker) {
      tracker.updatedAt = new Date().toISOString();
      await fs.writeFile(paths.trackerPath, JSON.stringify(tracker, null, 2));
    }

    // Filter newListings to only today's entries to avoid stale counts
    const today = new Date();
    latest.newListings = (latest.newListings || []).filter((x) => {
      if (!x.firstSeenAt) return false;
      const d = new Date(x.firstSeenAt);
      return d.getFullYear() === today.getFullYear()
        && d.getMonth() === today.getMonth()
        && d.getDate() === today.getDate();
    });
    latest.newCount = latest.newListings.length;

    const areas = (config?.areas || []).map((a) => a?.label).filter(Boolean).join(' · ');
    tracker.statuses = mergeStatuses(tracker.statuses);
    if (tracker.criteria?.filters) tracker.criteria.filters = stripRetiredBudgetBypassFilters(tracker.criteria.filters);
    stripRetiredListingFields(tracker);
    stripRetiredListingFields(latest);
    await hydrateMissingStreetGeocodes(tracker, geocodeCache, paths.geocodeCachePath);
    const map = enrichStateWithMap(tracker, config, geocodeCache);
    enrichLatestWithMap(latest, geocodeCache);

    return sendJson(res, 200, { profile, tracker, latest, areas, filters: config?.filters || {}, map });
  }

  if (req.method === 'POST' && u.pathname === '/api/update-status') {
    const profile = getProfileFromRequest(u);

    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const ok = await updateStatus(profile, body.id, body.status, body.notes, { reopen: body.reopen === true });
      return sendJson(res, ok ? 200 : 404, { ok });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && u.pathname === '/api/run-scan') {
    const profile = getProfileFromRequest(u);

    try {
      await ensureProfileStorage(profile);
      const summary = await runScan(profile);
      return sendJson(res, 200, { ok: true, summary });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && u.pathname === '/api/run-scan-job') {
    const profile = getProfileFromRequest(u);

    try {
      const { jobId, job } = createScanJob(profile);
      return sendJson(res, 202, { ok: true, jobId, total: job.total, done: job.done, currentStep: job.currentStep, startedAt: job.startedAt });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && u.pathname === '/api/scan-status') {
    const jobId = u.searchParams.get('jobId') || '';
    const job = scanJobs.get(jobId);
    if (!job) return sendJson(res, 404, { ok: false, error: 'Job not found' });
    const { child: _child, ...publicJob } = job;
    return sendJson(res, 200, { ok: true, ...publicJob });
  }

  if (req.method === 'POST' && u.pathname === '/api/scan-cancel') {
    const jobId = u.searchParams.get('jobId') || '';
    const job = scanJobs.get(jobId);
    if (!job) return sendJson(res, 404, { ok: false, error: 'Job not found' });
    if (job.status !== 'running') return sendJson(res, 200, { ok: true, status: job.status });
    job.cancelled = true;
    if (job.child) killScanChild(job.child);
    return sendJson(res, 200, { ok: true, status: 'cancelling' });
  }

  if (req.method === 'POST' && u.pathname === '/api/run-scan-all') {
    // Return immediately, run scans in background
    const profiles = await listProfiles();
    const slugs = profiles.map((p) => p.slug);
    const jobId = Date.now().toString(36);

    scanAllJobs.set(jobId, {
      status: 'running',
      total: slugs.length,
      done: 0,
      results: [],
      startedAt: new Date().toISOString(),
      cancelled: false,
      child: null
    });

    (async () => {
      const job = scanAllJobs.get(jobId);
      for (const slug of slugs) {
        if (job.cancelled) break;
        try {
          await ensureProfileStorage(slug);
          const summary = await runScan(slug, null, (child) => {
            job.child = child;
            if (job.cancelled) killScanChild(child);
          });
          const newCount = await readProfileNewCount(slug);
          job.results.push({ slug, ok: true, summary, newCount });
        } catch (err) {
          if (job.cancelled || err.cancelled) {
            job.results.push({ slug, ok: false, error: 'Scan annulé', cancelled: true });
          } else {
            job.results.push({ slug, ok: false, error: err.message });
          }
        }
        job.child = null;
        job.done += 1;
      }
      job.status = job.cancelled ? 'cancelled' : 'done';
      job.finishedAt = new Date().toISOString();
      // Clean up old jobs after 10 minutes
      setTimeout(() => scanAllJobs.delete(jobId), 10 * 60 * 1000);
    })();

    return sendJson(res, 202, { ok: true, jobId, total: slugs.length });
  }

  if (req.method === 'GET' && u.pathname === '/api/scan-all-status') {
    const jobId = u.searchParams.get('jobId') || '';
    const job = scanAllJobs.get(jobId);
    if (!job) return sendJson(res, 404, { ok: false, error: 'Job not found' });
    const { child: _child, ...publicJob } = job;
    return sendJson(res, 200, { ok: true, ...publicJob });
  }

  if (req.method === 'POST' && u.pathname === '/api/scan-all-cancel') {
    const jobId = u.searchParams.get('jobId') || '';
    const job = scanAllJobs.get(jobId);
    if (!job) return sendJson(res, 404, { ok: false, error: 'Job not found' });
    if (job.status !== 'running') return sendJson(res, 200, { ok: true, status: job.status });
    job.cancelled = true;
    if (job.child) killScanChild(job.child);
    return sendJson(res, 200, { ok: true, status: 'cancelling' });
  }

  if (req.method === 'POST' && u.pathname === '/api/toggle-pin') {
    const profile = getProfileFromRequest(u);

    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const pinned = await togglePin(profile, body.id);
      if (pinned === null) return sendJson(res, 404, { ok: false });
      return sendJson(res, 200, { ok: true, pinned });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'POST' && u.pathname === '/api/delete-listing') {
    const profile = getProfileFromRequest(u);

    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const ok = await deleteListing(profile, body.id);
      return sendJson(res, ok ? 200 : 404, { ok });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === 'GET' && u.pathname === '/') {
    await ensureProfileStorage(DEFAULT_PROFILE);
    return serveSpaIndex(res);
  }

  if (req.method === 'GET' && (u.pathname === '/dashboard' || u.pathname === '/dashboard/')) {
    res.writeHead(302, { location: '/' });
    return res.end();
  }

  const rootProfileMatch = u.pathname.match(/^\/([a-z0-9-]+)\/?$/i);
  if (req.method === 'GET' && rootProfileMatch && !['api', 'dashboard', 'data'].includes(rootProfileMatch[1])) {
    res.writeHead(302, { location: '/' });
    return res.end();
  }

  const profileTrailingSlashMatch = u.pathname.match(/^\/([a-z0-9-]+)\/dashboard\/$/i);
  if (req.method === 'GET' && profileTrailingSlashMatch) {
    res.writeHead(302, { location: '/' });
    return res.end();
  }

  if (req.method === 'GET' && u.pathname.startsWith('/assets/')) {
    return serveFile(res, path.join(DASHBOARD_DIST_DIR, u.pathname.replace(/^\//, '')));
  }

  if (req.method === 'GET' && u.pathname.startsWith('/dashboard/')) {
    const relative = u.pathname.replace('/dashboard/', '') || 'index.html';
    return serveFile(res, path.join(DASHBOARD_DIR, relative));
  }

  const profileAssetMatch = u.pathname.match(/^\/([a-z0-9-]+)\/(app\.js|styles\.css)$/i);
  if (req.method === 'GET' && profileAssetMatch) {
    return serveFile(res, path.join(DASHBOARD_DIR, profileAssetMatch[2]));
  }

  const dashboardMatch = u.pathname.match(/^\/([a-z0-9-]+)\/dashboard(?:\/(.*))?$/i);
  if (req.method === 'GET' && dashboardMatch) {
    const relative = dashboardMatch[2] || 'index.html';

    if (relative === 'index.html') {
      res.writeHead(302, { location: '/' });
      return res.end();
    }

    return serveFile(res, path.join(DASHBOARD_DIR, relative));
  }

  if (req.method === 'GET' && u.pathname.startsWith('/data/')) {
    const relative = u.pathname.replace('/data/', '');
    return serveFile(res, path.join(LEGACY_DATA_DIR, relative));
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Dashboard local prêt: http://localhost:${PORT}/`);
});
