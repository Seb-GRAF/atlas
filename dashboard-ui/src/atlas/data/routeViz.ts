import type { CommuteLeg, RouteOverlay, RouteOverlayLeg, TransitRoute } from '../types';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OSRM = 'https://router.project-osrm.org/route/v1';
const NOMINATIM_THROTTLE_MS = 1100;

const GEO_PREFIX = 'flat:geo:';
const OSRM_PREFIX = 'flat:osrm:';

type LngLat = [number, number]; // [lng, lat]

function normalizeKey(s: string): string {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage full or disabled — non-fatal.
  }
}

let geocodeQueue: Promise<unknown> = Promise.resolve();
function throttledGeocode(name: string): Promise<LngLat | null> {
  const run = async (): Promise<LngLat | null> => {
    const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(json) || json.length === 0) return null;
    const lat = Number(json[0].lat);
    const lon = Number(json[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return [lon, lat];
  };
  const next = geocodeQueue.then(async () => {
    const result = await run();
    await new Promise((r) => setTimeout(r, NOMINATIM_THROTTLE_MS));
    return result;
  });
  geocodeQueue = next.catch(() => null);
  return next;
}

async function geocodeStop(name: string): Promise<LngLat | null> {
  const key = GEO_PREFIX + normalizeKey(name);
  const cached = readSession<LngLat | null>(key);
  if (cached !== null) return cached;
  try {
    const point = await throttledGeocode(name);
    writeSession(key, point);
    return point;
  } catch {
    return null;
  }
}

async function osrmRoute(
  from: LngLat,
  to: LngLat,
  profile: 'foot' | 'driving'
): Promise<LngLat[] | null> {
  const key = `${OSRM_PREFIX}${profile}:${from[0].toFixed(5)},${from[1].toFixed(5)}->${to[0].toFixed(5)},${to[1].toFixed(5)}`;
  const cached = readSession<LngLat[] | null>(key);
  if (cached !== null) return cached;
  try {
    const url = `${OSRM}/${profile}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) {
      writeSession(key, null);
      return null;
    }
    const json = (await res.json()) as { routes?: Array<{ geometry?: { coordinates?: LngLat[] } }> };
    const coords = json.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      writeSession(key, null);
      return null;
    }
    writeSession(key, coords);
    return coords;
  } catch {
    return null;
  }
}

export function colorForLeg(leg: CommuteLeg): string {
  if (leg.type === 'walk') return '#8a8377';
  const mode = String(leg.mode || '').toUpperCase();
  if (mode === 'B') return '#2c7be5';
  if (mode === 'S') return '#2bb673';
  if (mode === 'M') return '#f08c2e';
  if (mode === 'IC' || mode === 'IR' || mode === 'RE' || mode === 'EC' || mode === 'ICE') return '#d64545';
  if (mode === 'T') return '#9b59b6';
  return '#c0623a';
}

function expandBounds(
  bounds: [[number, number], [number, number]] | null,
  point: LngLat
): [[number, number], [number, number]] {
  if (!bounds) return [[point[0], point[1]], [point[0], point[1]]];
  const [[w, s], [e, n]] = bounds;
  return [
    [Math.min(w, point[0]), Math.min(s, point[1])],
    [Math.max(e, point[0]), Math.max(n, point[1])]
  ];
}

// Resolve the geometry for a single leg.
// Priority order:
//   1. Walk legs with backend endpoints → call OSRM `foot` for sidewalk geometry.
//   2. Transit legs with backend coords → use them directly (passList polyline).
//   3. Anything missing coords → geocode by stop name (legacy fallback).
async function resolveLegCoords(
  leg: CommuteLeg,
  isFirstLeg: boolean,
  listingCoords: LngLat | null
): Promise<{ coords: LngLat[]; failed: boolean }> {
  const backendCoords = Array.isArray(leg.coords) ? leg.coords : [];

  if (leg.type === 'transit') {
    if (backendCoords.length >= 2) {
      // Transit leg already has the station-by-station polyline. No network.
      return { coords: backendCoords, failed: false };
    }
    // Legacy data without coords: geocode endpoints and connect with OSRM
    // driving (rough road approximation for buses; rails aren't routable).
    const from = await geocodeStop(leg.from);
    const to = await geocodeStop(leg.to);
    if (!from || !to) return { coords: from && to ? [from, to] : (from ? [from] : to ? [to] : []), failed: true };
    const polyline = await osrmRoute(from, to, 'driving');
    return polyline && polyline.length >= 2
      ? { coords: polyline, failed: false }
      : { coords: [from, to], failed: true };
  }

  // Walk leg: pick endpoints (prefer backend, fall back to geocode/listing)
  // and ask OSRM for the sidewalk geometry.
  let from: LngLat | null = backendCoords[0] ?? null;
  let to: LngLat | null = backendCoords[backendCoords.length - 1] ?? null;
  if (!from && leg.from) from = await geocodeStop(leg.from);
  if (!to && leg.to) to = await geocodeStop(leg.to);
  if (!from && isFirstLeg && listingCoords) from = listingCoords;

  if (!from || !to) {
    return { coords: from && to ? [from, to] : from ? [from] : to ? [to] : [], failed: true };
  }
  const polyline = await osrmRoute(from, to, 'foot');
  return polyline && polyline.length >= 2
    ? { coords: polyline, failed: false }
    : { coords: [from, to], failed: true };
}

export async function buildTransitRouteOverlay(
  listingId: string,
  transitRoute: TransitRoute,
  listingCoords?: { lat: number; lon: number } | null
): Promise<RouteOverlay> {
  const listingPoint: LngLat | null =
    listingCoords && Number.isFinite(listingCoords.lat) && Number.isFinite(listingCoords.lon)
      ? [listingCoords.lon, listingCoords.lat]
      : null;

  // Resolve legs in parallel: transit legs are pure (no I/O when backend has
  // coords), walk legs hit OSRM independently. Compared to the old serial
  // Nominatim queue this turns ~7s into well under a second on fresh data.
  const resolved = await Promise.all(
    transitRoute.legs.map((leg, i) => resolveLegCoords(leg, i === 0, listingPoint))
  );

  const legs: RouteOverlayLeg[] = [];
  let bounds: [[number, number], [number, number]] | null = null;
  let failedCount = 0;

  for (let i = 0; i < transitRoute.legs.length; i++) {
    const leg = transitRoute.legs[i];
    const { coords, failed } = resolved[i];
    if (failed) failedCount++;
    for (const c of coords) bounds = expandBounds(bounds, c);

    legs.push({
      kind: leg.type,
      mode: leg.mode,
      label: leg.label || leg.line || leg.mode || (leg.type === 'walk' ? 'WALK' : 'PT'),
      color: colorForLeg(leg),
      coords,
      failed,
      fromName: leg.from,
      toName: leg.to,
      minutes: leg.minutes
    });
  }

  return {
    listingId,
    legs,
    bounds: bounds ?? [[0, 0], [0, 0]],
    failedCount
  };
}
