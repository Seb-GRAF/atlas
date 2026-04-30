# Commute Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute and display apartment-to-work commute by public transport and car, including an Atlas-style public transport route timeline.

**Architecture:** Add a focused commute helper module under `scripts/lib/` for parsing transport responses, cache metadata, and listing field normalization. Wire the scraper to compute commute fields for displayed active listings, then extend the React Atlas UI to show compact commute chips in rows and detailed public transport legs in detail panels.

**Tech Stack:** Node.js ESM, built-in `node:test`, native `fetch`, JSON file caches, React 19, TypeScript, Vitest, Vite.

---

## File Structure

- Create `scripts/lib/commute.mjs`: pure commute helpers shared by the scraper and tests. It owns duration parsing, next-Monday arrival policy, route cache metadata, transport section normalization, and listing field assignment.
- Create `scripts/lib/commute.test.mjs`: Node built-in tests for parsing, route-leg normalization, cache metadata, and failure field behavior.
- Modify `scripts/scrape-immobilier.mjs`: import helpers, compute commute fields in the main visible-listing merge, preserve commute values for existing listings instead of clearing them, and write `route-cache.json`.
- Modify `scripts/recompute-distances.mjs`: replace the placeholder public transport path with the shared helpers so the manual recompute script produces the same fields as the scraper.
- Modify `dashboard-ui/src/api/schemas.ts`: allow structured commute fields from the API.
- Modify `dashboard-ui/src/atlas/types.ts`: add typed commute route fields.
- Modify `dashboard-ui/src/atlas/data/adapt.ts`: adapt API commute data into Atlas listings.
- Create `dashboard-ui/src/atlas/screens/CommuteChips.tsx`: compact Atlas-style `PT` and `CAR` chips for rows.
- Create `dashboard-ui/src/atlas/screens/CommuteTimeline.tsx`: detailed public transport route line for detail surfaces.
- Modify `dashboard-ui/src/atlas/screens/ListingRow.tsx`: render commute chips in desktop rows.
- Modify `dashboard-ui/src/atlas/screens/mobile/MobileListRow.tsx`: render commute chips in mobile rows.
- Modify `dashboard-ui/src/atlas/screens/DetailPanel.tsx`: render route timeline in desktop detail panel.
- Modify `dashboard-ui/src/atlas/screens/mobile/MobileDetailSheet.tsx`: render route timeline in mobile detail sheet.

## Task 1: Shared Commute Helpers

**Files:**
- Create: `scripts/lib/commute.mjs`
- Create: `scripts/lib/commute.test.mjs`

- [ ] **Step 1: Write failing helper tests**

Create `scripts/lib/commute.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTransitCacheKey,
  clearCommuteFields,
  formatMinutesText,
  normalizeTransitConnection,
  parseTransportDurationToMinutes,
  resolveNextMondayDateIso,
  setCommuteFailureFields,
  setCommuteSuccessFields
} from './commute.mjs';

test('parseTransportDurationToMinutes parses Swiss transport durations', () => {
  assert.equal(parseTransportDurationToMinutes('00d00:35:00'), 35);
  assert.equal(parseTransportDurationToMinutes('00d01:02:31'), 63);
  assert.equal(parseTransportDurationToMinutes('01d02:03:00'), 1563);
  assert.equal(parseTransportDurationToMinutes(''), null);
  assert.equal(parseTransportDurationToMinutes('invalid'), null);
});

test('resolveNextMondayDateIso returns same day for Monday and next Monday for Tuesday', () => {
  assert.equal(resolveNextMondayDateIso(new Date('2026-05-04T10:00:00+02:00')), '2026-05-04');
  assert.equal(resolveNextMondayDateIso(new Date('2026-05-05T10:00:00+02:00')), '2026-05-11');
});

test('buildTransitCacheKey includes arrival policy and normalized addresses', () => {
  assert.equal(
    buildTransitCacheKey('Rue A 1, Suisse', 'Rue B 2, Suisse'),
    'transit:arrival-next-monday-0800:rue a 1, suisse->rue b 2, suisse'
  );
});

test('normalizeTransitConnection converts walk and transport sections into route legs', () => {
  const connection = {
    duration: '00d00:35:00',
    products: ['RE33', 'm2'],
    from: { departure: '2026-05-04T07:09:00+0200' },
    to: { arrival: '2026-05-04T07:44:00+0200' },
    sections: [
      {
        journey: null,
        walk: { duration: 300 },
        departure: { station: { name: 'Vevey VD, Av. de la Gare' }, departure: '2026-05-04T07:09:00+0200' },
        arrival: { station: { name: 'Vevey' }, arrival: '2026-05-04T07:14:00+0200' }
      },
      {
        journey: { category: 'RE', number: '33', to: 'Annemasse' },
        walk: null,
        departure: { station: { name: 'Vevey' }, departure: '2026-05-04T07:14:00+0200' },
        arrival: { station: { name: 'Lausanne' }, arrival: '2026-05-04T07:29:00+0200' }
      },
      {
        journey: { category: 'M', number: 'm2', to: 'Lausanne Sallaz' },
        walk: null,
        departure: { station: { name: 'Lausanne, gare' }, departure: '2026-05-04T07:35:00+0200' },
        arrival: { station: { name: 'Lausanne, Bessières' }, arrival: '2026-05-04T07:39:00+0200' }
      }
    ]
  };

  assert.deepEqual(normalizeTransitConnection(connection, { date: '2026-05-04', arrivalTime: '08:00' }), {
    date: '2026-05-04',
    arrivalTime: '08:00',
    departureAt: '2026-05-04T07:09:00+0200',
    arrivalAt: '2026-05-04T07:44:00+0200',
    products: ['RE33', 'm2'],
    legs: [
      {
        type: 'walk',
        mode: 'walk',
        line: '',
        label: 'WALK',
        direction: '',
        from: 'Vevey VD, Av. de la Gare',
        to: 'Vevey',
        departureAt: '2026-05-04T07:09:00+0200',
        arrivalAt: '2026-05-04T07:14:00+0200',
        minutes: 5
      },
      {
        type: 'transit',
        mode: 'RE',
        line: '33',
        label: 'RE33',
        direction: 'Annemasse',
        from: 'Vevey',
        to: 'Lausanne',
        departureAt: '2026-05-04T07:14:00+0200',
        arrivalAt: '2026-05-04T07:29:00+0200',
        minutes: 15
      },
      {
        type: 'transit',
        mode: 'M',
        line: 'm2',
        label: 'M2',
        direction: 'Lausanne Sallaz',
        from: 'Lausanne, gare',
        to: 'Lausanne, Bessières',
        departureAt: '2026-05-04T07:35:00+0200',
        arrivalAt: '2026-05-04T07:39:00+0200',
        minutes: 4
      }
    ]
  });
});

test('setCommuteSuccessFields writes compatibility and structured fields', () => {
  const listing = {};
  setCommuteSuccessFields(listing, {
    workAddress: 'Rue Etraz 4, Lausanne',
    distanceKm: 12.4,
    driveMinutes: 31,
    transitMinutes: 42,
    transitRoute: {
      date: '2026-05-04',
      arrivalTime: '08:00',
      departureAt: '2026-05-04T07:09:00+0200',
      arrivalAt: '2026-05-04T07:44:00+0200',
      products: ['RE33'],
      legs: []
    }
  });

  assert.equal(listing.distanceText, '12.4 km');
  assert.equal(listing.driveText, '31 min');
  assert.equal(listing.transitText, '42 min');
  assert.equal(listing.driveRouteStatus, 'ok');
  assert.equal(listing.transitRouteStatus, 'ok');
  assert.deepEqual(listing.commuteWarnings, []);
});

test('setCommuteFailureFields is visible and clearCommuteFields resets old values', () => {
  const listing = { driveText: '31 min', transitText: '42 min', commuteWarnings: [] };
  setCommuteFailureFields(listing, 'route-failed', 'Transport public indisponible');
  assert.equal(listing.transitRouteStatus, 'route-failed');
  assert.deepEqual(listing.commuteWarnings, ['Transport public indisponible']);

  clearCommuteFields(listing);
  assert.equal(listing.driveText, '');
  assert.equal(listing.transitText, '');
  assert.equal(listing.transitRouteStatus, 'missing-address');
});

test('formatMinutesText only formats finite positive minutes', () => {
  assert.equal(formatMinutesText(31), '31 min');
  assert.equal(formatMinutesText(0), '');
  assert.equal(formatMinutesText(null), '');
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
node --test scripts/lib/commute.test.mjs
```

Expected: FAIL with an import error because `scripts/lib/commute.mjs` does not exist.

- [ ] **Step 3: Implement helper module**

Create `scripts/lib/commute.mjs`:

```js
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

export function resolveNextMondayDateIso(referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const day = now.getDay();
  const delta = (1 - day + 7) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + delta);
  return monday.toISOString().slice(0, 10);
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
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```bash
node --test scripts/lib/commute.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit helper module**

```bash
git add scripts/lib/commute.mjs scripts/lib/commute.test.mjs
git commit -m "feat: add commute route helpers"
```

## Task 2: Scraper Commute Computation

**Files:**
- Modify: `scripts/scrape-immobilier.mjs`
- Test: `scripts/lib/commute.test.mjs`

- [ ] **Step 1: Add scraper import**

At the top of `scripts/scrape-immobilier.mjs`, after the existing imports, add:

```js
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
  setCommuteSuccessFields,
  toDurationMinutesOrNull
} from './lib/commute.mjs';
```

- [ ] **Step 2: Remove duplicate local helper definitions**

In `scripts/scrape-immobilier.mjs`, delete these local functions because the imported module now owns them:

```js
function clearDistanceFields(item) { ... }
function getCachedRouteMinutes(routeCache, key) { ... }
function setCachedRouteMinutes(routeCache, key, minutes) { ... }
function parseTransportDurationToMinutes(duration = '') { ... }
function buildCoordRouteKey(prefix, a, b) { ... }
function buildAddressRouteKey(prefix, from, to) { ... }
function resolveNextMondayDateIso(referenceDate = new Date()) { ... }
function resolveTransitReference() { ... }
```

If `toDurationMinutesOrNull` already exists locally, keep the local function name only if it is used outside commute fields; otherwise remove it and use the imported helper.

- [ ] **Step 3: Replace `fetchDrivingMinutes()` implementation**

Replace the existing `fetchDrivingMinutes(workCoords, listingCoords, routeCache)` body with:

```js
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
```

- [ ] **Step 4: Replace `fetchTransitMinutes()` with structured route fetch**

Replace the existing `fetchTransitMinutes(workAddress, listingAddress, routeCache)` function with:

```js
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
```

- [ ] **Step 5: Add commute computation function**

After `computeDistanceFromWork()`, add:

```js
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
    fetchTransitRoute(workAddress, distance.listingAddress, routeCache)
  ]);

  setCommuteSuccessFields(item, {
    workAddress,
    distanceKm: distance.distanceKm,
    driveMinutes: drive.minutes,
    transitMinutes: transit.minutes,
    transitRoute: transit.route
  });

  item.driveRouteStatus = drive.status;
  item.transitRouteStatus = transit.status;

  const warnings = [];
  if (drive.status === 'cached-stale') warnings.push('Temps voiture issu du cache.');
  if (drive.status === 'route-failed') warnings.push('Temps voiture indisponible.');
  if (transit.status === 'cached-stale') warnings.push('Trajet public issu du cache.');
  if (transit.status === 'route-failed') warnings.push('Transport public indisponible.');
  item.commuteWarnings = warnings;
}
```

- [ ] **Step 6: Load route cache and work coordinates in `main()`**

Near the existing tracker/cache reads in `main()`, add:

```js
const geocodeCache = await readJsonSafe(GEOCODE_CACHE_PATH, {});
const routeCache = await readJsonSafe(ROUTE_CACHE_PATH, {});
const workAddress = config.preferences?.workplaceAddress || config.preferences?.workAddress || DEFAULT_WORK_ADDRESS;
const workCoords = await geocodeAddress(workAddress, geocodeCache);
if (!workCoords) {
  console.error(`WARN commute: could not geocode workplace "${workAddress}"`);
}
```

Do not add a silent default for a missing profile work address beyond `DEFAULT_WORK_ADDRESS`; the warning above is the visible failure signal.

- [ ] **Step 7: Compute commute before merging new/existing listings**

In the loop over `dedup.values()`, replace both calls to `clearDistanceFields(item)` with:

```js
await computeCommuteFromWork(item, workAddress, workCoords, geocodeCache, routeCache);
```

For non-displayed items, the new function clears fields and stores a visible failure status.

- [ ] **Step 8: Preserve computed commute fields during merge**

In the existing-listing `merged.push({ ...existing, ...item, ... })` object, delete the reset block:

```js
distanceKm: null,
distanceText: '',
driveMinutes: null,
driveText: '',
transitMinutes: null,
transitText: '',
distanceComputed: false,
distanceFromWorkAddress: '',
```

Replace it with:

```js
distanceKm: item.distanceComputed ? item.distanceKm : null,
distanceText: item.distanceComputed ? item.distanceText || '' : '',
driveMinutes: toDurationMinutesOrNull(item.driveMinutes),
driveText: formatMinutesText(item.driveMinutes),
driveRouteStatus: item.driveRouteStatus || 'missing-address',
transitMinutes: toDurationMinutesOrNull(item.transitMinutes),
transitText: formatMinutesText(item.transitMinutes),
transitRouteStatus: item.transitRouteStatus || 'missing-address',
transitRouteLabel: item.transitRouteLabel || 'Arrivée 08:00',
transitRouteComputedAt: item.transitRouteComputedAt || null,
transitRoute: item.transitRoute || null,
commuteWarnings: Array.isArray(item.commuteWarnings) ? item.commuteWarnings : [],
distanceComputed: !!item.distanceComputed,
distanceFromWorkAddress: item.distanceFromWorkAddress || workAddress,
```

- [ ] **Step 9: Write geocode and route caches**

Before writing `TRACKER_PATH` and `LATEST_PATH`, add:

```js
await fs.writeFile(GEOCODE_CACHE_PATH, JSON.stringify(geocodeCache, null, 2));
await fs.writeFile(ROUTE_CACHE_PATH, JSON.stringify(routeCache, null, 2));
```

- [ ] **Step 10: Run helper tests and a syntax check**

Run:

```bash
node --test scripts/lib/commute.test.mjs
node --check scripts/scrape-immobilier.mjs
```

Expected: both commands pass.

- [ ] **Step 11: Commit scraper wiring**

```bash
git add scripts/scrape-immobilier.mjs scripts/lib/commute.mjs scripts/lib/commute.test.mjs
git commit -m "feat: compute commute routes during scan"
```

## Task 3: Recompute Script Parity

**Files:**
- Modify: `scripts/recompute-distances.mjs`

- [ ] **Step 1: Import shared commute helpers**

Add after imports:

```js
import {
  buildDriveCacheKey,
  buildTransitCacheKey,
  formatMinutesText,
  getCachedRoute,
  normalizeTransitConnection,
  parseTransportDurationToMinutes,
  resolveTransitReference,
  setCachedRoute,
  setCommuteSuccessFields
} from './lib/commute.mjs';
```

Add near constants:

```js
const TRAVEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
```

- [ ] **Step 2: Replace manual car and transit helpers**

Replace `fetchDrivingMinutes()` and `fetchTransitMinutes()` in `scripts/recompute-distances.mjs` with:

```js
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
```

Use this call shape in the loop:

```js
const drive = await fetchDrivingMinutes(workCoords, listingCoords, routeCache);
const transit = await fetchTransitRoute(workAddress, addr + ', Suisse', routeCache);
```

- [ ] **Step 3: Replace direct field assignment**

Replace the direct `listing.distanceKm = ...` block with:

```js
setCommuteSuccessFields(listing, {
  workAddress,
  distanceKm,
  driveMinutes: drive.minutes,
  transitMinutes: transit.minutes,
  transitRoute: transit.route
});
listing.driveRouteStatus = drive.status;
listing.transitRouteStatus = transit.status;
listing.commuteWarnings = [
  drive.status === 'cached-stale' ? 'Temps voiture issu du cache.' : '',
  transit.status === 'cached-stale' ? 'Trajet public issu du cache.' : '',
  drive.status === 'route-failed' ? 'Temps voiture indisponible.' : '',
  transit.status === 'route-failed' ? 'Transport public indisponible.' : ''
].filter(Boolean);
```

- [ ] **Step 4: Verify script syntax**

Run:

```bash
node --check scripts/recompute-distances.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit recompute parity**

```bash
git add scripts/recompute-distances.mjs
git commit -m "fix: align distance recompute with commute routes"
```

## Task 4: API Schema and Atlas Types

**Files:**
- Modify: `dashboard-ui/src/api/schemas.ts`
- Modify: `dashboard-ui/src/atlas/types.ts`
- Modify: `dashboard-ui/src/atlas/data/adapt.ts`

- [ ] **Step 1: Extend API schema**

In `dashboard-ui/src/api/schemas.ts`, add this schema near `ListingSchema`:

```ts
const CommuteLegSchema = z.object({
  type: z.enum(['walk', 'transit']),
  mode: z.string(),
  line: z.string(),
  label: z.string(),
  direction: z.string(),
  from: z.string(),
  to: z.string(),
  departureAt: z.string().nullable(),
  arrivalAt: z.string().nullable(),
  minutes: z.number().nullable()
});

const TransitRouteSchema = z.object({
  date: z.string(),
  arrivalTime: z.string(),
  departureAt: z.string().nullable(),
  arrivalAt: z.string().nullable(),
  products: z.array(z.string()),
  legs: z.array(CommuteLegSchema)
});
```

Inside `ListingSchema`, add:

```ts
driveRouteStatus: z.string().nullable().optional(),
transitRouteStatus: z.string().nullable().optional(),
transitRouteLabel: z.string().nullable().optional(),
transitRouteComputedAt: z.string().nullable().optional(),
transitRoute: TransitRouteSchema.nullable().optional(),
commuteWarnings: z.array(z.string()).optional(),
```

- [ ] **Step 2: Extend Atlas types**

In `dashboard-ui/src/atlas/types.ts`, add before `AtlasListing`:

```ts
export type CommuteRouteStatus =
  | 'ok'
  | 'missing-address'
  | 'geocode-failed'
  | 'route-failed'
  | 'cached-stale'
  | string;

export type CommuteLeg = {
  type: 'walk' | 'transit';
  mode: string;
  line: string;
  label: string;
  direction: string;
  from: string;
  to: string;
  departureAt: string | null;
  arrivalAt: string | null;
  minutes: number | null;
};

export type TransitRoute = {
  date: string;
  arrivalTime: string;
  departureAt: string | null;
  arrivalAt: string | null;
  products: string[];
  legs: CommuteLeg[];
};
```

Inside `AtlasListing`, add:

```ts
driveMinutes: number | null;
transitMinutes: number | null;
driveRouteStatus: CommuteRouteStatus | null;
transitRouteStatus: CommuteRouteStatus | null;
transitRouteLabel: string | null;
transitRouteComputedAt: string | null;
transitRoute: TransitRoute | null;
commuteWarnings: string[];
```

- [ ] **Step 3: Adapt commute fields**

In `dashboard-ui/src/atlas/data/adapt.ts`, add these fields to the object returned by `adaptListing()`:

```ts
driveMinutes: item.driveMinutes ?? null,
transitMinutes: item.transitMinutes ?? null,
driveRouteStatus: item.driveRouteStatus ?? null,
transitRouteStatus: item.transitRouteStatus ?? null,
transitRouteLabel: item.transitRouteLabel ?? null,
transitRouteComputedAt: item.transitRouteComputedAt ?? null,
transitRoute: item.transitRoute ?? null,
commuteWarnings: Array.isArray(item.commuteWarnings) ? item.commuteWarnings : [],
```

- [ ] **Step 4: Run UI tests**

Run:

```bash
npm run test:ui
```

Expected: PASS.

- [ ] **Step 5: Commit schema and type changes**

```bash
git add dashboard-ui/src/api/schemas.ts dashboard-ui/src/atlas/types.ts dashboard-ui/src/atlas/data/adapt.ts
git commit -m "feat: add commute route data to atlas types"
```

## Task 5: Compact Commute Chips

**Files:**
- Create: `dashboard-ui/src/atlas/screens/CommuteChips.tsx`
- Modify: `dashboard-ui/src/atlas/screens/ListingRow.tsx`
- Modify: `dashboard-ui/src/atlas/screens/mobile/MobileListRow.tsx`

- [ ] **Step 1: Create `CommuteChips` component**

Create `dashboard-ui/src/atlas/screens/CommuteChips.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { Icons, Mono } from '../components';
import type { AtlasListing } from '../types';

type CommuteChipsProps = {
  listing: Pick<
    AtlasListing,
    'transitText' | 'driveText' | 'transitRouteStatus' | 'driveRouteStatus'
  >;
  compact?: boolean;
  style?: CSSProperties;
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 24,
  padding: '3px 7px',
  borderRadius: 8,
  background: 'var(--atlas-paper-2)',
  color: 'var(--atlas-ink)',
  boxShadow: '0 0 0 1px var(--atlas-line)',
  whiteSpace: 'nowrap'
};

function chipTone(status: string | null | undefined, hasText: boolean): CSSProperties {
  if (status === 'cached-stale') return { color: 'var(--atlas-ember)' };
  if (!hasText || status === 'route-failed' || status === 'missing-address' || status === 'geocode-failed') {
    return { color: 'var(--atlas-ink-3)' };
  }
  return {};
}

export function CommuteChips({ listing, compact = false, style }: CommuteChipsProps) {
  const transitValue = listing.transitText || 'n/a';
  const driveValue = listing.driveText || 'n/a';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        minWidth: 0,
        ...style
      }}
    >
      <span style={{ ...chipStyle, ...chipTone(listing.transitRouteStatus, !!listing.transitText) }}>
        <Icons.Train size={compact ? 11 : 12} stroke={1.8} />
        <Mono style={{ fontSize: compact ? 11 : 12, fontWeight: 500 }}>PT {transitValue}</Mono>
      </span>
      <span style={{ ...chipStyle, ...chipTone(listing.driveRouteStatus, !!listing.driveText) }}>
        <Icons.Drive size={compact ? 11 : 12} stroke={1.8} />
        <Mono style={{ fontSize: compact ? 11 : 12, fontWeight: 500 }}>CAR {driveValue}</Mono>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Render chips in desktop rows**

In `dashboard-ui/src/atlas/screens/ListingRow.tsx`, import:

```tsx
import { CommuteChips } from './CommuteChips';
```

Change the `meta` array to remove `listing.transitText`:

```tsx
const meta = [
  listing.rooms != null ? `${listing.rooms} pces` : null,
  listing.surfaceM2 != null ? `${listing.surfaceM2} m²` : null
]
  .filter(Boolean)
  .join(' · ');
```

After the meta `<div>`, add:

```tsx
<CommuteChips listing={listing} compact style={{ marginTop: 3 }} />
```

- [ ] **Step 3: Render chips in mobile rows**

In `dashboard-ui/src/atlas/screens/mobile/MobileListRow.tsx`, import:

```tsx
import { CommuteChips } from '../CommuteChips';
```

Add this component below the existing metadata line that shows rooms/surface/price:

```tsx
<CommuteChips listing={listing} compact style={{ marginTop: 6 }} />
```

- [ ] **Step 4: Run UI tests and build**

Run:

```bash
npm run test:ui
npm run build:ui
```

Expected: both pass.

- [ ] **Step 5: Commit row chips**

```bash
git add dashboard-ui/src/atlas/screens/CommuteChips.tsx dashboard-ui/src/atlas/screens/ListingRow.tsx dashboard-ui/src/atlas/screens/mobile/MobileListRow.tsx
git commit -m "feat: show commute chips in atlas rows"
```

## Task 6: Detail Route Timeline

**Files:**
- Create: `dashboard-ui/src/atlas/screens/CommuteTimeline.tsx`
- Modify: `dashboard-ui/src/atlas/screens/DetailPanel.tsx`
- Modify: `dashboard-ui/src/atlas/screens/mobile/MobileDetailSheet.tsx`

- [ ] **Step 1: Create route timeline component**

Create `dashboard-ui/src/atlas/screens/CommuteTimeline.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { Hairline, Icons, Mono } from '../components';
import type { AtlasListing, CommuteLeg } from '../types';

type CommuteTimelineProps = {
  listing: AtlasListing;
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

function legColor(leg: CommuteLeg): string {
  if (leg.type === 'walk') return '#a79d8f';
  if (leg.mode === 'M') return '#4f7f90';
  if (leg.mode === 'BUS') return '#7b6541';
  if (leg.mode === 'TRAM') return '#6d7487';
  return '#5d7a61';
}

function legIcon(leg: CommuteLeg) {
  return leg.type === 'walk' ? <Icons.Walk size={12} stroke={1.8} /> : <Icons.Train size={12} stroke={1.8} />;
}

function statusText(status: string | null): string | null {
  if (status === 'cached-stale') return 'Donnée issue du cache';
  if (status === 'route-failed') return 'Trajet indisponible';
  if (status === 'missing-address') return 'Adresse manquante';
  if (status === 'geocode-failed') return 'Adresse non géocodée';
  return null;
}

export function CommuteTimeline({ listing }: CommuteTimelineProps) {
  const route = listing.transitRoute;
  const status = statusText(listing.transitRouteStatus);

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'var(--atlas-paper-2)',
        borderRadius: 12,
        padding: 12,
        boxShadow: '0 0 0 1px var(--atlas-line)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Trajet</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icons.Train size={13} stroke={1.8} />
              <Mono style={{ fontSize: 15, fontWeight: 500 }}>{listing.transitText || 'n/a'}</Mono>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icons.Drive size={13} stroke={1.8} />
              <Mono style={{ fontSize: 15, fontWeight: 500 }}>{listing.driveText || 'n/a'}</Mono>
            </span>
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--atlas-ink-3)' }}>
          {listing.transitRouteLabel || 'Arrivée 08:00'}
        </span>
      </div>

      {status ? (
        <div style={{ fontSize: 12.5, color: 'var(--atlas-ember)' }}>{status}</div>
      ) : null}

      {listing.commuteWarnings.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {listing.commuteWarnings.map((warning) => (
            <div key={warning} style={{ fontSize: 12, color: 'var(--atlas-ember)' }}>
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      {route?.legs?.length ? (
        <>
          <Hairline />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {route.legs.map((leg, index) => (
              <div
                key={`${leg.label}-${leg.from}-${leg.to}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '42px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  minWidth: 0
                }}
              >
                <span
                  style={{
                    height: 30,
                    borderRadius: 8,
                    background: 'var(--atlas-paper)',
                    color: legColor(leg),
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    boxShadow: '0 0 0 1px var(--atlas-line)'
                  }}
                  title={leg.label}
                >
                  {legIcon(leg)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ height: 4, background: legColor(leg), borderRadius: 999 }} />
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'baseline',
                      marginTop: 5,
                      minWidth: 0
                    }}
                  >
                    <Mono style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--atlas-ink)' }}>
                      {leg.label}
                    </Mono>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--atlas-ink-3)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {[leg.from, leg.to].filter(Boolean).join(' -> ')}
                    </span>
                  </div>
                </div>
                <Mono style={{ fontSize: 12, color: 'var(--atlas-ink)' }}>
                  {leg.minutes != null ? `${leg.minutes} min` : '—'}
                </Mono>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Render timeline in desktop detail panel**

In `dashboard-ui/src/atlas/screens/DetailPanel.tsx`, import:

```tsx
import { CommuteTimeline } from './CommuteTimeline';
```

Below the existing `StatGrid`, add:

```tsx
<CommuteTimeline listing={listing} />
```

- [ ] **Step 3: Render timeline in mobile detail sheet**

In `dashboard-ui/src/atlas/screens/mobile/MobileDetailSheet.tsx`, import:

```tsx
import { CommuteTimeline } from '../CommuteTimeline';
```

Below the existing `StatGrid`, add:

```tsx
<CommuteTimeline listing={view} />
```

- [ ] **Step 4: Run UI tests and build**

Run:

```bash
npm run test:ui
npm run build:ui
```

Expected: both pass.

- [ ] **Step 5: Commit route timeline**

```bash
git add dashboard-ui/src/atlas/screens/CommuteTimeline.tsx dashboard-ui/src/atlas/screens/DetailPanel.tsx dashboard-ui/src/atlas/screens/mobile/MobileDetailSheet.tsx
git commit -m "feat: show commute route timeline"
```

## Task 7: End-to-End Verification

**Files:**
- Modify if build changes generated assets: `dashboard/dist/index.html`, `dashboard/dist/assets/*`

- [ ] **Step 1: Run all local verification**

Run:

```bash
node --test scripts/lib/commute.test.mjs
node --check scripts/scrape-immobilier.mjs
node --check scripts/recompute-distances.mjs
npm run test:ui
npm run build:ui
```

Expected: all pass.

- [ ] **Step 2: Run a profile scan with route computation**

Run:

```bash
APART_PROFILE=vaud-3-pieces node scripts/scrape-immobilier.mjs
```

Expected:

- The scan completes.
- `data/profiles/vaud-3-pieces/route-cache.json` contains `drive:` and `transit:arrival-next-monday-0800:` entries.
- At least one displayed listing in `data/profiles/vaud-3-pieces/tracker.json` has `driveText`, `transitText`, and `transitRoute.legs`.
- If external APIs fail, listings contain `driveRouteStatus` or `transitRouteStatus` with a visible non-`ok` value.

- [ ] **Step 3: Start local dashboard**

Run:

```bash
npm run dev
```

Expected: dashboard is available at the printed local URL, normally `http://127.0.0.1:8787`.

- [ ] **Step 4: Browser verification**

Open the dashboard and verify:

- Desktop list rows show `PT` and `CAR` chips without emoji.
- Desktop detail panel shows public transport and car summary.
- Desktop detail panel shows route legs such as `WALK`, `RE33`, and `M2` when route data exists.
- Mobile list rows show compact chips without text overflow.
- Mobile detail sheet shows the same route timeline.
- Failure states show visible text such as `Trajet indisponible` or `Donnée issue du cache`.

- [ ] **Step 5: Stop local dashboard**

If the dev server was started in the foreground, press `Ctrl-C`.

If it was started as an exec session, stop that session before final response.

- [ ] **Step 6: Commit verification/build outputs**

If `npm run build:ui` changed `dashboard/dist`, include the generated assets in this commit:

```bash
git add dashboard/dist dashboard-ui scripts package.json package-lock.json
git commit -m "chore: build dashboard commute assets"
```

If no generated assets changed, skip this commit and record that in the final implementation notes.

## Self-Review Notes

- Spec coverage: helper parsing, scraper compute, route cache, schema/types, row chips, detail timeline, visible failures, and verification are covered by Tasks 1-7.
- Type consistency: `transitRoute`, `transitRouteStatus`, `driveRouteStatus`, and `commuteWarnings` are named consistently across scraper, schema, adapter, and UI tasks.
- Scope control: exact geographic transit polylines are excluded from this implementation; the plan implements the approved section timeline.
