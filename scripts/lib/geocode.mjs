const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GEO_ADMIN_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const PHOTON_URL = 'https://photon.komoot.io/api/';

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
  const result = Array.isArray(payload?.results) ? payload.results[0] : null;
  return parsePoint(result?.attrs?.lat, result?.attrs?.lon);
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

function buildGeoAdminUrl(query) {
  const url = new URL(GEO_ADMIN_URL);
  url.searchParams.set('searchText', query);
  url.searchParams.set('type', 'locations');
  url.searchParams.set('limit', '1');
  return url.toString();
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

  const cached = cache?.[key];
  if (cached && typeof cached === 'object') {
    const point = parsePoint(cached.lat, cached.lon);
    if (point) return point;
  }

  const fetchJson = options.fetchJson;
  if (typeof fetchJson !== 'function') {
    throw new Error('geocodeAddress requires options.fetchJson');
  }

  const warn = typeof options.warn === 'function' ? options.warn : console.warn;
  const sleep = typeof options.sleep === 'function'
    ? options.sleep
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const minNominatimIntervalMs = Number.isFinite(Number(options.minNominatimIntervalMs))
    ? Number(options.minNominatimIntervalMs)
    : 1100;

  const attempts = [
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
