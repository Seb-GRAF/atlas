export const TRANSIT_POLICY = {
  datePolicy: 'next-monday',
  arrivalTime: '08:00',
  cachePolicyKey: 'arrival-next-monday-0800',
  label: 'Arrivée 08:00'
};

export function toDurationMinutesOrNull(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n));
}

export function formatMinutesText(value) {
  const minutes = toDurationMinutesOrNull(value);
  return minutes == null ? '' : `${minutes} min`;
}

export function parseTransportDurationToMinutes(duration = '') {
  const m = String(duration || '').match(/(\d{2})d(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;

  const days = Number(m[1]);
  const hours = Number(m[2]);
  const mins = Number(m[3]);
  const secs = Number(m[4]);
  if (![days, hours, mins, secs].every(Number.isFinite)) return null;

  const total = days * 24 * 60 + hours * 60 + mins + Math.round(secs / 60);
  return total > 0 ? total : null;
}

export function minutesBetweenIso(start, end) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.max(1, Math.round((b - a) / 60000));
}

function formatLocalDateIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveNextMondayDateIso(referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const day = now.getDay();
  const delta = (1 - day + 7) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + delta);
  return formatLocalDateIso(monday);
}

export function resolveTransitReference(referenceDate = new Date()) {
  return {
    ...TRANSIT_POLICY,
    date: resolveNextMondayDateIso(referenceDate)
  };
}

export function normalizeAddressKey(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildTransitCacheKey(from, to) {
  return `transit:${TRANSIT_POLICY.cachePolicyKey}:${normalizeAddressKey(from)}->${normalizeAddressKey(to)}`;
}

export function buildDriveCacheKey(fromCoords, toCoords) {
  const one = `${Number(fromCoords.lat).toFixed(5)},${Number(fromCoords.lon).toFixed(5)}`;
  const two = `${Number(toCoords.lat).toFixed(5)},${Number(toCoords.lon).toFixed(5)}`;
  return `drive:${one}->${two}`;
}

export function isCacheFresh(entry, ttlMs) {
  if (!entry || !entry.updatedAt) return false;
  const t = new Date(entry.updatedAt).getTime();
  return Number.isFinite(t) && Date.now() - t <= ttlMs;
}

export function getCachedRoute(routeCache, key, ttlMs) {
  const entry = routeCache?.[key];
  if (!entry) return { hasValue: false, fresh: false, entry: null, minutes: null, route: null };
  const minutes = toDurationMinutesOrNull(entry.minutes);
  return {
    hasValue: minutes != null || entry.route != null,
    fresh: isCacheFresh(entry, ttlMs),
    entry,
    minutes,
    route: entry.route || null
  };
}

export function setCachedRoute(routeCache, key, value) {
  routeCache[key] = {
    minutes: toDurationMinutesOrNull(value?.minutes),
    route: value?.route || null,
    status: value?.status || 'ok',
    updatedAt: new Date().toISOString()
  };
}

function stationName(stop) {
  return String(stop?.station?.name || '').trim();
}

function stopDeparture(stop) {
  return stop?.departure || stop?.arrival || null;
}

function stopArrival(stop) {
  return stop?.arrival || stop?.departure || null;
}

function normalizeLineLabel(category = '', number = '') {
  const cat = String(category || '').trim().toUpperCase();
  const line = String(number || '').trim();
  if (!cat && !line) return 'PT';
  if (!line) return cat;
  if (cat === 'M') return line.toUpperCase();
  return `${cat}${line}`;
}

export function normalizeTransitConnection(connection, transitRef) {
  if (!connection || typeof connection !== 'object') return null;

  const legs = [];
  for (const section of Array.isArray(connection.sections) ? connection.sections : []) {
    const departureAt = stopDeparture(section.departure);
    const arrivalAt = stopArrival(section.arrival);
    const from = stationName(section.departure);
    const to = stationName(section.arrival);

    if (section.journey) {
      const mode = String(section.journey.category || '').trim().toUpperCase();
      const line = String(section.journey.number || '').trim();
      legs.push({
        type: 'transit',
        mode,
        line,
        label: normalizeLineLabel(mode, line),
        direction: String(section.journey.to || '').trim(),
        from,
        to,
        departureAt,
        arrivalAt,
        minutes: minutesBetweenIso(departureAt, arrivalAt)
      });
      continue;
    }

    if (section.walk) {
      const walkSeconds = Number(section.walk.duration);
      const walkMinutes = Number.isFinite(walkSeconds) && walkSeconds > 0
        ? Math.max(1, Math.round(walkSeconds / 60))
        : minutesBetweenIso(departureAt, arrivalAt);
      legs.push({
        type: 'walk',
        mode: 'walk',
        line: '',
        label: 'WALK',
        direction: '',
        from,
        to,
        departureAt,
        arrivalAt,
        minutes: walkMinutes
      });
    }
  }

  return {
    date: transitRef.date,
    arrivalTime: transitRef.arrivalTime,
    departureAt: connection.from?.departure || legs[0]?.departureAt || null,
    arrivalAt: connection.to?.arrival || legs[legs.length - 1]?.arrivalAt || null,
    products: Array.isArray(connection.products) ? connection.products.filter(Boolean).map(String) : [],
    legs
  };
}

export function clearCommuteFields(item) {
  item.distanceKm = null;
  item.distanceText = '';
  item.distanceComputed = false;
  item.distanceFromWorkAddress = '';
  item.driveMinutes = null;
  item.driveText = '';
  item.driveRouteStatus = 'missing-address';
  item.transitMinutes = null;
  item.transitText = '';
  item.transitRouteStatus = 'missing-address';
  item.transitRouteLabel = TRANSIT_POLICY.label;
  item.transitRouteComputedAt = null;
  item.transitRoute = null;
  item.commuteWarnings = [];
}

export function setCommuteFailureFields(item, status, message) {
  item.transitRouteStatus = status;
  item.transitRouteLabel = TRANSIT_POLICY.label;
  item.transitRouteComputedAt = new Date().toISOString();
  item.transitRoute = null;
  item.transitMinutes = null;
  item.transitText = '';
  item.commuteWarnings = message ? [message] : [];
}

export function setCommuteSuccessFields(item, result) {
  const distanceKm = Number(result.distanceKm);
  const driveMinutes = toDurationMinutesOrNull(result.driveMinutes);
  const transitMinutes = toDurationMinutesOrNull(result.transitMinutes);

  item.distanceKm = Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(1)) : null;
  item.distanceText = item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : '';
  item.distanceComputed = item.distanceKm != null;
  item.distanceFromWorkAddress = result.workAddress || '';

  item.driveMinutes = driveMinutes;
  item.driveText = formatMinutesText(driveMinutes);
  item.driveRouteStatus = driveMinutes == null ? 'route-failed' : 'ok';

  item.transitMinutes = transitMinutes;
  item.transitText = formatMinutesText(transitMinutes);
  item.transitRouteStatus = transitMinutes == null ? 'route-failed' : 'ok';
  item.transitRouteLabel = TRANSIT_POLICY.label;
  item.transitRouteComputedAt = new Date().toISOString();
  item.transitRoute = result.transitRoute || null;
  item.commuteWarnings = [];
}
