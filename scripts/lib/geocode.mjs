const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
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

// Cache key for reverse lookups: round to ~10m resolution so tiny floating-
// point variations from different sources collapse to the same entry.
export function buildReverseGeocodeKey(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return '';
  return `rev:${latNum.toFixed(5)},${lonNum.toFixed(5)}`;
}

export function parseNominatimReverse(payload) {
  if (!payload || typeof payload !== 'object' || payload.error) return null;
  const a = payload.address || {};
  const houseNumber = String(a.house_number || '').trim();
  const road = String(a.road || a.pedestrian || a.footway || '').trim();
  const postal = String(a.postcode || '').trim();
  const city = String(a.city || a.town || a.village || a.municipality || a.suburb || '').trim();
  const street = [road, houseNumber].filter(Boolean).join(' ');
  if (!street && !city) return null;
  const fullAddress = [street, [postal, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    address: fullAddress,
    street,
    city,
    postal,
    displayName: String(payload.display_name || '')
  };
}

function buildNominatimReverseUrl(lat, lon, lang = 'fr') {
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  if (lang) url.searchParams.set('accept-language', lang);
  return url.toString();
}

// Reverse-geocode a (lat, lon) pair into a Swiss-style postal address. Uses
// the same cache file as forward geocoding (a separate `rev:lat,lon` key
// space). Honors Nominatim's 1-req/sec policy via shared throttle.
export async function reverseGeocode(lat, lon, cache, options = {}) {
  const key = buildReverseGeocodeKey(lat, lon);
  if (!key) return null;

  if (cache && Object.prototype.hasOwnProperty.call(cache, key)) {
    return cache[key]; // may be null (cached miss) or a result object
  }

  const fetchJson = options.fetchJson;
  if (typeof fetchJson !== 'function') {
    throw new Error('reverseGeocode requires options.fetchJson');
  }
  const warn = typeof options.warn === 'function' ? options.warn : console.warn;
  const sleep = typeof options.sleep === 'function'
    ? options.sleep
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const minIntervalMs = Number.isFinite(Number(options.minNominatimIntervalMs))
    ? Number(options.minNominatimIntervalMs)
    : 1100;

  await throttleNominatim(sleep, now, minIntervalMs);

  try {
    const payload = await fetchJson(buildNominatimReverseUrl(lat, lon, options.lang || 'fr'));
    lastNominatimRequestAt = now();
    const parsed = parseNominatimReverse(payload);
    cache[key] = parsed;
    return parsed;
  } catch (err) {
    warn(`WARN reverse-geocode ${lat},${lon} failed: ${err.message}`);
    cache[key] = null;
    return null;
  }
}
