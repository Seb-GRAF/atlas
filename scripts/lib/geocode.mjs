const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GEO_ADMIN_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const GEO_ADMIN_PRIMARY_ORIGINS = 'address,gg25,zipcode';
const BROAD_SWISS_REGION_POINT = { lat: 47.0986213684082, lon: 7.954939365386963 };

let lastNominatimRequestAt = 0;

export function normalizeGeocodeKey(query = '') {
  return String(query || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function parsePoint(latValue, lonValue) {
  const lat = Number(latValue);
  const lon = Number(lonValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function parseNominatimPoint(payload) {
  if (!Array.isArray(payload) || !payload.length) return null;
  return parsePoint(payload[0]?.lat, payload[0]?.lon);
}

export function parseGeoAdminPoint(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  for (const result of results) {
    if (isBroadGeoAdminResult(result?.attrs)) continue;
    const point = parsePoint(result?.attrs?.lat, result?.attrs?.lon);
    if (point) return point;
  }
  return null;
}

export function parsePhotonPoint(payload) {
  const coords = payload?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords)) return null;
  return parsePoint(coords[1], coords[0]);
}

function buildNominatimUrl(query) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);
  return url.toString();
}

function buildGeoAdminUrl(query, origins = '') {
  const url = new URL(GEO_ADMIN_URL);
  url.searchParams.set('searchText', query);
  url.searchParams.set('type', 'locations');
  url.searchParams.set('limit', '1');
  if (origins) url.searchParams.set('origins', origins);
  return url.toString();
}

function isBroadGeoAdminResult(attrs) {
  const label = String(attrs?.label || '').toLowerCase();
  return label.includes('<i>main region</i>') || label.includes('plateau suisse');
}

function isKnownBadBroadRegionPoint(point) {
  if (!point) return false;
  return Math.abs(point.lat - BROAD_SWISS_REGION_POINT.lat) < 0.000001
    && Math.abs(point.lon - BROAD_SWISS_REGION_POINT.lon) < 0.000001;
}

function buildPhotonUrl(query) {
  const url = new URL(PHOTON_URL);
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);
  return url.toString();
}

async function throttleNominatim(sleep, now, minIntervalMs) {
  const elapsed = now() - lastNominatimRequestAt;
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }
}

export async function geocodeAddress(query, cache, options = {}) {
  const key = normalizeGeocodeKey(query);
  if (!key) return null;

  const warn = typeof options.warn === 'function' ? options.warn : console.warn;
  const cached = cache?.[key];
  if (cached && typeof cached === 'object') {
    const point = parsePoint(cached.lat, cached.lon);
    if (point && !isKnownBadBroadRegionPoint(point)) return point;
    if (point) warn(`WARN geocode ignoring stale broad-region cached point for "${query}"`);
  }

  const fetchJson = options.fetchJson;
  if (typeof fetchJson !== 'function') {
    throw new Error('geocodeAddress requires options.fetchJson');
  }

  const sleep = typeof options.sleep === 'function'
    ? options.sleep
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const minNominatimIntervalMs = Number.isFinite(Number(options.minNominatimIntervalMs))
    ? Number(options.minNominatimIntervalMs)
    : 1100;

  const attempts = [
    {
      name: 'geo.admin.ch',
      url: buildGeoAdminUrl(query, GEO_ADMIN_PRIMARY_ORIGINS),
      parse: parseGeoAdminPoint
    },
    {
      name: 'nominatim',
      url: buildNominatimUrl(query),
      parse: parseNominatimPoint,
      before: async () => throttleNominatim(sleep, now, minNominatimIntervalMs),
      after: () => {
        lastNominatimRequestAt = now();
      }
    },
    {
      name: 'geo.admin.ch',
      url: buildGeoAdminUrl(query),
      parse: parseGeoAdminPoint
    },
    {
      name: 'photon',
      url: buildPhotonUrl(query),
      parse: parsePhotonPoint
    }
  ];

  for (const attempt of attempts) {
    try {
      await attempt.before?.();
      const payload = await fetchJson(attempt.url);
      attempt.after?.();
      const point = attempt.parse(payload);
      if (point) {
        cache[key] = point;
        return point;
      }
    } catch (err) {
      warn(`WARN geocode ${attempt.name} failed for "${query}": ${err.message}`);
    }
  }

  cache[key] = null;
  return null;
}
