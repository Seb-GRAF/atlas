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

export function formatTransitLocation(point, fallbackAddress = '') {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `${lat.toFixed(6)},${lon.toFixed(6)}`;
  }
  return String(fallbackAddress || '').trim();
}

export function buildTransitLocationCacheKey(fromPoint, fromFallback, toPoint, toFallback) {
  return buildTransitCacheKey(
    formatTransitLocation(fromPoint, fromFallback),
    formatTransitLocation(toPoint, toFallback)
  );
}

function formatCoordinatePoint(point) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Invalid route coordinates');
  }
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

export function buildDriveCacheKey(fromCoords, toCoords) {
  const one = formatCoordinatePoint(fromCoords);
  const two = formatCoordinatePoint(toCoords);
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

function validLngLat(point) {
  if (!Array.isArray(point) || point.length < 2) return null;
  const lng = Number(point[0]);
  const lat = Number(point[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  // Reject the literal {0, 0} sentinel — opendata.ch occasionally returns
  // placeholder zero coordinates for stations without geocoding, and pulling
  // them through expands route bounds to span Switzerland → Gulf of Guinea.
  if (lng === 0 && lat === 0) return null;
  return [lng, lat];
}

function validLngLats(coords) {
  if (!Array.isArray(coords)) return [];
  return coords.map(validLngLat).filter(Boolean);
}

function listingLngLat(coords) {
  const lat = Number(coords?.lat);
  const lon = Number(coords?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lon, lat];
}

function colorForTransitRouteLeg(leg) {
  if (leg?.type === 'walk') return '#8a8377';
  const mode = String(leg?.mode || '').toUpperCase();
  const line = String(leg?.line || leg?.label || '').toUpperCase();
  if (mode === 'M' && line === 'M2') return '#e91e63';
  if (mode === 'B') return '#2c7be5';
  if (mode === 'S') return '#2bb673';
  if (mode === 'M') return '#f08c2e';
  if (mode === 'IC' || mode === 'IR' || mode === 'RE' || mode === 'EC' || mode === 'ICE') return '#d64545';
  if (mode === 'T') return '#9b59b6';
  return '#c0623a';
}

function expandLngLatBounds(bounds, point) {
  if (!bounds) return [[point[0], point[1]], [point[0], point[1]]];
  const [[w, s], [e, n]] = bounds;
  return [
    [Math.min(w, point[0]), Math.min(s, point[1])],
    [Math.max(e, point[0]), Math.max(n, point[1])]
  ];
}

function routeLegLabel(leg) {
  return leg?.label || leg?.line || leg?.mode || (leg?.type === 'walk' ? 'WALK' : 'PT');
}

async function resolveWalkOverlayCoords(leg, isFirstLeg, isLastLeg, listingPoint, workplacePoint, resolveFootRoute) {
  const endpoints = validLngLats(leg?.coords);
  let from = endpoints[0] || null;
  let to = endpoints.length >= 2 ? endpoints[endpoints.length - 1] : null;

  if (endpoints.length === 1 && isFirstLeg && listingPoint) {
    // First walk usually starts at the listing — opendata.ch returns no
    // station coord for an address, so we got just the destination stop.
    from = listingPoint;
    to = endpoints[0];
  } else if (endpoints.length === 1 && isLastLeg && workplacePoint) {
    // Last walk usually ends at the workplace — same address-based gap.
    from = endpoints[0];
    to = workplacePoint;
  } else if (!from && isFirstLeg && listingPoint) {
    from = listingPoint;
  } else if (!to && isLastLeg && workplacePoint) {
    to = workplacePoint;
  }

  const fallback = [];
  if (from) fallback.push(from);
  if (to) fallback.push(to);

  if (!from || !to || typeof resolveFootRoute !== 'function') {
    return { coords: fallback.length > 0 ? fallback : endpoints, failed: true };
  }

  try {
    const resolved = validLngLats(await resolveFootRoute(from, to));
    if (resolved.length >= 2) return { coords: resolved, failed: false };
  } catch {
    // The overlay remains drawable with endpoint fallback, but visibly failed.
  }

  return { coords: fallback, failed: true };
}

export async function buildTransitRouteOverlay(route, options = {}) {
  const listingPoint = listingLngLat(options.listingCoords);
  const workplacePoint = listingLngLat(options.workplaceCoords);
  const sourceLegs = Array.isArray(route?.legs) ? route.legs : [];
  const legs = [];
  let bounds = null;
  let failedCount = 0;

  for (let i = 0; i < sourceLegs.length; i++) {
    const leg = sourceLegs[i];
    const isWalk = leg?.type === 'walk';
    const resolved = isWalk
      ? await resolveWalkOverlayCoords(
          leg,
          i === 0,
          i === sourceLegs.length - 1,
          listingPoint,
          workplacePoint,
          options.resolveFootRoute
        )
      : (() => {
          const coords = validLngLats(leg?.coords);
          return { coords, failed: coords.length < 2 };
        })();

    if (resolved.failed) failedCount++;
    for (const point of resolved.coords) bounds = expandLngLatBounds(bounds, point);

    legs.push({
      kind: leg?.type,
      mode: leg?.mode,
      label: routeLegLabel(leg),
      color: colorForTransitRouteLeg(leg),
      coords: resolved.coords,
      failed: resolved.failed,
      fromName: leg?.from,
      toName: leg?.to,
      minutes: leg?.minutes
    });
  }

  return {
    listingId: options.listingId,
    legs,
    bounds: bounds || [[0, 0], [0, 0]],
    failedCount
  };
}

function stationName(stop) {
  return String(stop?.station?.name || '').trim();
}

// transport.opendata.ch encodes coordinates as { x: latitude, y: longitude }
// (geo-flipped from typical GIS). Normalize here to a standard [lng, lat]
// tuple so downstream code never has to think about it. Returns null when
// either component is missing or non-finite (address-based searches often
// have no station coord on the first/last hop).
function stationLngLat(station) {
  const co = station?.coordinate;
  if (!co) return null;
  const lat = Number(co.x);
  const lng = Number(co.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Same {0, 0} guard as validLngLat — opendata.ch returns this for stations
  // it could not geocode and we don't want it polluting the route bounds.
  if (lat === 0 && lng === 0) return null;
  return [lng, lat];
}

function passListLngLats(passList) {
  if (!Array.isArray(passList)) return [];
  const out = [];
  for (const stop of passList) {
    const point = stationLngLat(stop?.station);
    if (point) out.push(point);
  }
  return out;
}

function pointsEqual(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
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
    const fromCoord = stationLngLat(section.departure?.station);
    const toCoord = stationLngLat(section.arrival?.station);

    if (section.journey) {
      const mode = String(section.journey.category || '').trim().toUpperCase();
      const line = String(section.journey.number || '').trim();
      // Build the transit polyline from the journey's passList so the
      // dashboard can draw the actual station-by-station path without
      // calling Nominatim/OSRM at view time. Pad with the section
      // endpoints if passList is empty or missing edges.
      const inner = passListLngLats(section.journey.passList);
      const coords = [];
      if (fromCoord && (inner.length === 0 || !pointsEqual(inner[0], fromCoord))) {
        coords.push(fromCoord);
      }
      for (const p of inner) coords.push(p);
      if (toCoord && (coords.length === 0 || !pointsEqual(coords[coords.length - 1], toCoord))) {
        coords.push(toCoord);
      }
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
        minutes: minutesBetweenIso(departureAt, arrivalAt),
        coords
      });
      continue;
    }

    if (section.walk) {
      const walkSeconds = Number(section.walk.duration);
      const walkMinutes = Number.isFinite(walkSeconds) && walkSeconds > 0
        ? Math.max(1, Math.round(walkSeconds / 60))
        : minutesBetweenIso(departureAt, arrivalAt);
      // Walk legs only carry endpoint coords; the dashboard uses them as
      // OSRM `foot` input for sidewalk geometry. Either endpoint may be
      // null (address-based searches).
      const coords = [fromCoord, toCoord].filter(Boolean);
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
        minutes: walkMinutes,
        coords
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
  item.transitRouteOverlay = null;
  item.commuteWarnings = [];
}

export function clearedCommuteFields() {
  const item = {};
  clearCommuteFields(item);
  return item;
}

export function setCommuteFailureFields(item, status, message) {
  item.driveMinutes = null;
  item.driveText = '';
  item.driveRouteStatus = status;
  item.transitRouteStatus = status;
  item.transitRouteLabel = TRANSIT_POLICY.label;
  item.transitRouteComputedAt = new Date().toISOString();
  item.transitRoute = null;
  item.transitRouteOverlay = null;
  item.transitMinutes = null;
  item.transitText = '';
  item.commuteWarnings = message ? [message] : [];
}

function projectCommuteFields(source, { visible, workAddress: fallbackWorkAddress }) {
  if (!visible) return clearedCommuteFields();

  return {
    distanceKm: source.distanceComputed ? source.distanceKm : null,
    distanceText: source.distanceComputed ? source.distanceText || '' : '',
    driveMinutes: toDurationMinutesOrNull(source.driveMinutes),
    driveText: formatMinutesText(source.driveMinutes),
    driveRouteStatus: source.driveRouteStatus || 'missing-address',
    transitMinutes: toDurationMinutesOrNull(source.transitMinutes),
    transitText: formatMinutesText(source.transitMinutes),
    transitRouteStatus: source.transitRouteStatus || 'missing-address',
    transitRouteLabel: source.transitRouteLabel || TRANSIT_POLICY.label,
    transitRouteComputedAt: source.transitRouteComputedAt || null,
    transitRoute: source.transitRoute || null,
    transitRouteOverlay: source.transitRouteOverlay || null,
    commuteWarnings: Array.isArray(source.commuteWarnings) ? source.commuteWarnings : [],
    distanceComputed: !!source.distanceComputed,
    distanceFromWorkAddress: source.distanceFromWorkAddress || fallbackWorkAddress
  };
}

function failureCommuteFields(status, message, workAddress) {
  const item = clearedCommuteFields();
  setCommuteFailureFields(item, status, message);
  item.distanceFromWorkAddress = workAddress || '';
  return item;
}

export function projectRetainedCommuteFields(source, { visible, workAddress, workCoords }) {
  if (!visible) return clearedCommuteFields();

  if (!workCoords) {
    return failureCommuteFields(
      'geocode-failed',
      `Trajet indisponible: adresse de travail non géocodée (${workAddress || 'adresse manquante'}).`,
      workAddress
    );
  }

  const storedWorkAddress = source.distanceFromWorkAddress || '';
  if (normalizeAddressKey(storedWorkAddress) !== normalizeAddressKey(workAddress)) {
    return failureCommuteFields(
      'route-failed',
      "Trajet à recalculer pour l'adresse de travail actuelle.",
      workAddress
    );
  }

  return projectCommuteFields(source, { visible, workAddress });
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
  item.driveRouteStatus = result.driveStatus || (driveMinutes == null ? 'route-failed' : 'ok');

  item.transitMinutes = transitMinutes;
  item.transitText = formatMinutesText(transitMinutes);
  item.transitRouteStatus = result.transitStatus || (transitMinutes == null ? 'route-failed' : 'ok');
  item.transitRouteLabel = TRANSIT_POLICY.label;
  item.transitRouteComputedAt = new Date().toISOString();
  item.transitRoute = result.transitRoute || null;
  item.transitRouteOverlay = result.transitRouteOverlay || null;
  item.commuteWarnings = [];
}

export const CLOSED_COMMUTE_STATUSES = new Set(['Accepté', 'Écartée', 'Refus régie']);

export function shouldRecomputeListingCommute(listing) {
  if (!listing || listing.isRemoved) return false;
  // Stubs are slimmed historical entries; they have no address to geocode.
  if (listing.isStub === true) return false;
  return !CLOSED_COMMUTE_STATUSES.has(String(listing.status || '').trim());
}
