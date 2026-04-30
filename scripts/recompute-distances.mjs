#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import {
  buildDriveCacheKey,
  buildTransitCacheKey,
  clearCommuteFields,
  formatMinutesText,
  getCachedRoute,
  normalizeTransitConnection,
  parseTransportDurationToMinutes,
  resolveTransitReference,
  setCachedRoute,
  setCommuteFailureFields,
  setCommuteSuccessFields
} from './lib/commute.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function sanitizeProfile(value = 'fribourg') {
  const clean = String(value || 'fribourg').trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(clean) ? clean : 'fribourg';
}

function parseProfileFromArgv(argv = process.argv.slice(2)) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || '');
    if (arg.startsWith('--profile=')) return arg.slice('--profile='.length);
    if (arg === '--profile') return argv[i + 1] || 'fribourg';
  }
  return null;
}

const PROFILE = sanitizeProfile(process.env.APART_PROFILE || parseProfileFromArgv() || 'fribourg');
const DATA_DIR = path.join(ROOT, 'data', 'profiles', PROFILE);
const CONFIG_PATH = path.join(DATA_DIR, 'watch-config.json');
const TRACKER_PATH = path.join(DATA_DIR, 'tracker.json');
const GEOCODE_CACHE_PATH = path.join(DATA_DIR, 'geocode-cache.json');
const ROUTE_CACHE_PATH = path.join(DATA_DIR, 'route-cache.json');
const TRAVEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

async function readJsonSafe(p, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(p, data) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2));
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'apartment-search/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

async function geocodeAddress(query, cache) {
  const key = query.toLowerCase().trim();
  if (cache[key]) return cache[key];
  
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const results = await httpsGet(url);
  if (results?.[0]) {
    const point = { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
    cache[key] = point;
    return point;
  }
  cache[key] = null;
  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildListingAddressQuery(listing) {
  const addressRaw = String(listing.address || '').trim();
  const area = String(listing.area || '').trim();
  if (addressRaw) return [addressRaw, 'Suisse'].join(', ');
  if (area) return [area, 'Suisse'].join(', ');
  return '';
}

async function fetchDrivingMinutes(workCoords, listingCoords, routeCache) {
  if (!workCoords || !listingCoords) return { minutes: null, status: 'missing-address' };

  const key = buildDriveCacheKey(listingCoords, workCoords);
  const cached = getCachedRoute(routeCache, key, TRAVEL_CACHE_TTL_MS);
  if (cached.fresh && cached.minutes != null) {
    return { minutes: cached.minutes, status: 'ok' };
  }

  try {
    const payload = await httpsGet(
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

async function fetchTransitRoute(workAddress, listingAddress, routeCache) {
  if (!workAddress || !listingAddress) {
    return { minutes: null, route: null, status: 'missing-address' };
  }

  const transitRef = resolveTransitReference();
  const key = buildTransitCacheKey(listingAddress, workAddress);
  const cached = getCachedRoute(routeCache, key, TRAVEL_CACHE_TTL_MS);
  if (cached.fresh && cached.minutes != null) {
    return { minutes: cached.minutes, route: cached.route, status: 'ok' };
  }

  try {
    const url = new URL('https://transport.opendata.ch/v1/connections');
    url.searchParams.set('limit', '1');
    url.searchParams.set('from', listingAddress);
    url.searchParams.set('to', workAddress);
    url.searchParams.set('date', transitRef.date);
    url.searchParams.set('time', transitRef.arrivalTime);
    url.searchParams.set('isArrivalTime', '1');

    const payload = await httpsGet(url.toString());
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

async function main() {
  console.log(`Recomputing distances for profile: ${PROFILE}`);
  
  const config = await readJsonSafe(CONFIG_PATH, {});
  const tracker = await readJsonSafe(TRACKER_PATH, { listings: [] });
  const geocodeCache = await readJsonSafe(GEOCODE_CACHE_PATH, {});
  const routeCache = await readJsonSafe(ROUTE_CACHE_PATH, {});
  
  const workAddress = config.preferences?.workplaceAddress || 'Rue Etraz 4, 1003 Lausanne, Suisse';
  console.log(`Workplace: ${workAddress}`);
  console.log(`Commute direction: Apartment -> Work (Monday arrival 8h)`);
  
  const workCoords = await geocodeAddress(workAddress, geocodeCache);
  if (!workCoords) {
    console.error('Could not geocode workplace address');
    return;
  }
  console.log(`Work coords: ${workCoords.lat}, ${workCoords.lon}`);
  
  let updated = 0;
  for (const listing of tracker.listings) {
    const listingAddress = buildListingAddressQuery(listing);
    if (!listingAddress) {
      clearCommuteFields(listing);
      setCommuteFailureFields(listing, 'missing-address', 'Trajet indisponible: adresse manquante.');
      listing.distanceFromWorkAddress = workAddress;
      console.log(`  Skip ${listing.id}: missing address`);
      continue;
    }

    const listingCoords = await geocodeAddress(listingAddress, geocodeCache);
    if (!listingCoords) {
      clearCommuteFields(listing);
      setCommuteFailureFields(listing, 'geocode-failed', 'Trajet indisponible: adresse non géocodée.');
      listing.distanceFromWorkAddress = workAddress;
      console.log(`  Skip ${listing.id}: could not geocode "${listingAddress}"`);
      continue;
    }
    
    const distanceKm = haversineKm(workCoords.lat, workCoords.lon, listingCoords.lat, listingCoords.lon);
    const drive = await fetchDrivingMinutes(workCoords, listingCoords, routeCache);
    const transit = await fetchTransitRoute(workAddress, listingAddress, routeCache);

    setCommuteSuccessFields(listing, {
      workAddress,
      distanceKm,
      driveMinutes: drive.minutes,
      transitMinutes: transit.minutes,
      transitRoute: transit.route,
      driveStatus: drive.status,
      transitStatus: transit.status
    });
    listing.commuteWarnings = [
      drive.status === 'cached-stale' ? 'Temps voiture issu du cache.' : '',
      transit.status === 'cached-stale' ? 'Trajet public issu du cache.' : '',
      drive.status === 'route-failed' ? 'Temps voiture indisponible.' : '',
      transit.status === 'route-failed' ? 'Transport public indisponible.' : ''
    ].filter(Boolean);

    console.log(`  ${listing.id}: ${listing.distanceKm} km, ${formatMinutesText(drive.minutes) || '?'} drive`);
    updated++;
    
    // Small delay to be nice to APIs
    await new Promise(r => setTimeout(r, 200));
  }
  
  await writeJson(TRACKER_PATH, tracker);
  await writeJson(GEOCODE_CACHE_PATH, geocodeCache);
  await writeJson(ROUTE_CACHE_PATH, routeCache);
  
  console.log(`\nDone! Updated ${updated}/${tracker.listings.length} listings`);
}

main().catch(console.error);
