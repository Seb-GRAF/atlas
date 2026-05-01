# Facebook Marketplace Regions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Facebook Marketplace scraping automatically handle any profile's locations without per-town query spam and without relying on the account's current global Marketplace location filter.

**Architecture:** Add a small region-planning layer that geocodes missing profile area coordinates, clusters nearby areas into a few Marketplace regions, and resolves each region through the logged-in Facebook UI into a verified location-scoped search URL. The scraper will run one broad query per resolved region, throttle between region searches, and fail loudly when Facebook cannot verify the expected active region.

**Tech Stack:** Node.js ESM, Playwright Chromium, existing `watch-config.json` profile data, existing geo.admin.ch geocoding helpers, existing `node:test` tests.

---

## File Structure

- Modify `scripts/lib/facebook-marketplace.mjs`
  - Keep the scraper entry point.
  - Replace area-template fanout with resolved Marketplace region searches.
  - Add Playwright flow for automatic Facebook location resolution.
  - Add fail-loud active-location verification before extracting cards.

- Create `scripts/lib/facebook-marketplace-regions.mjs`
  - Pure helpers for area coordinate normalization, distance calculations, automatic clustering, region radius selection, and search URL construction.
  - No Playwright in this file.

- Create `scripts/lib/facebook-marketplace-regions.test.mjs`
  - Unit tests for clustering and URL construction.

- Modify `scripts/lib/facebook-marketplace.test.mjs`
  - Unit tests for URL generation behavior that belongs in the scraper module.
  - Tests that old `searchUrl` and `searchUrls` remain supported.

- Modify `scripts/lib/geocode.mjs`
  - Export a municipality geocoding helper or add a thin wrapper that resolves an area label with `origins=gg25`.
  - Reuse the same cache object shape as existing address geocoding.

- Modify `scripts/lib/geocode.test.mjs`
  - Tests for municipality area geocoding and cache behavior.

- Modify `scripts/scrape-immobilier.mjs`
  - Pass the profile's geocode cache into the Facebook scraper so missing area coordinates can be filled without adding a new cache file.

- Modify `data/profiles/vaud-3-pieces/watch-config.json`
  - Remove per-area Facebook `queryTemplates`.
  - Keep source enabled and rely on automatic region planning.

## Behavior Contract

- A profile with many nearby areas produces one Marketplace region.
- A profile with far-apart areas produces multiple Marketplace regions.
- Each region runs one broad query, defaulting to `louer appartement`.
- Price/date/sort filters come from `facebookMarketplace` config first, then from profile filters.
- The browser may interact with Facebook after login, but the user only performs the login step.
- The scraper never trusts the global account location silently. It verifies the visible active Marketplace location after setting or loading each region.
- If Facebook blocks, hides the location picker, or shows a mismatched active region, the scan fails with a clear `FB_MARKETPLACE_*` error.
- Cached region URLs are reused only after verification.

## Task 1: Pure Region Clustering

**Files:**
- Create: `scripts/lib/facebook-marketplace-regions.mjs`
- Create: `scripts/lib/facebook-marketplace-regions.test.mjs`

- [ ] **Step 1: Write failing clustering tests**

Add `scripts/lib/facebook-marketplace-regions.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMarketplaceSearchUrl,
  clusterMarketplaceAreas,
  distanceKm,
  marketplaceRegionKey,
  normalizeMarketplaceAreaPoint
} from './facebook-marketplace-regions.mjs';

test('distanceKm measures Swiss city distances closely enough for clustering', () => {
  const lausanne = { lat: 46.5197, lon: 6.6323 };
  const pully = { lat: 46.5103, lon: 6.6618 };
  const zurich = { lat: 47.3769, lon: 8.5417 };

  assert.ok(distanceKm(lausanne, pully) < 4);
  assert.ok(distanceKm(lausanne, zurich) > 170);
});

test('normalizeMarketplaceAreaPoint accepts finite profile coordinates only', () => {
  assert.deepEqual(
    normalizeMarketplaceAreaPoint({ label: 'Pully', slug: 'pully', lat: 46.5103, lon: 6.6618 }),
    { label: 'Pully', slug: 'pully', canton: '', lat: 46.5103, lon: 6.6618 }
  );

  assert.equal(normalizeMarketplaceAreaPoint({ label: 'Broken', lat: null, lon: 6.6 }), null);
  assert.equal(normalizeMarketplaceAreaPoint({ label: '', lat: 46.5, lon: 6.6 }), null);
});

test('clusterMarketplaceAreas groups nearby Vaud towns and separates far towns', () => {
  const areas = [
    { label: 'Saint-Sulpice VD', slug: 'saint-sulpice-vd', canton: 'vaud', lat: 46.5110, lon: 6.5583 },
    { label: 'Pully', slug: 'pully', canton: 'vaud', lat: 46.5103, lon: 6.6618 },
    { label: 'Lausanne', slug: 'lausanne', canton: 'vaud', lat: 46.5197, lon: 6.6323 },
    { label: 'Morges', slug: 'morges', canton: 'vaud', lat: 46.5090, lon: 6.4980 },
    { label: 'Cugy VD', slug: 'cugy-vd', canton: 'vaud', lat: 46.5865, lon: 6.6411 },
    { label: 'Epalinges', slug: 'epalinges', canton: 'vaud', lat: 46.5484, lon: 6.6684 },
    { label: 'Bulle', slug: 'bulle', canton: 'fribourg', lat: 46.6170, lon: 7.0570 },
    { label: 'Zurich', slug: 'zurich', canton: 'zurich', lat: 47.3769, lon: 8.5417 }
  ];

  const regions = clusterMarketplaceAreas(areas, { clusterDistanceKm: 25, minRadiusKm: 10, maxRadiusKm: 30 });

  assert.equal(regions.length, 3);
  assert.deepEqual(
    regions.map((region) => region.memberLabels),
    [
      ['Saint-Sulpice VD', 'Pully', 'Lausanne', 'Morges', 'Cugy VD', 'Epalinges'],
      ['Bulle'],
      ['Zurich']
    ]
  );
  assert.equal(regions[0].label, 'Lausanne area');
  assert.ok(regions[0].radiusKm >= 15);
  assert.equal(regions[1].radiusKm, 10);
  assert.equal(regions[2].radiusKm, 10);
});

test('marketplaceRegionKey is stable for cache keys', () => {
  assert.equal(
    marketplaceRegionKey({ label: 'Lausanne area', center: { lat: 46.5197, lon: 6.6323 }, radiusKm: 20 }),
    'lausanne-area:46.51970,6.63230:20'
  );
});

test('buildMarketplaceSearchUrl uses region location path and configured filters', () => {
  const url = buildMarketplaceSearchUrl({
    facebookLocation: '108211865877609',
    query: 'louer appartement',
    minPrice: 1500,
    maxPrice: 2300,
    daysSinceListed: 2,
    sortBy: 'creation_time_descend',
    exact: false
  });

  assert.equal(
    url,
    'https://www.facebook.com/marketplace/108211865877609/search/?query=louer+appartement&minPrice=1500&maxPrice=2300&daysSinceListed=2&sortBy=creation_time_descend&exact=false'
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/lib/facebook-marketplace-regions.test.mjs
```

Expected: FAIL with `Cannot find module './facebook-marketplace-regions.mjs'`.

- [ ] **Step 3: Implement pure region helpers**

Create `scripts/lib/facebook-marketplace-regions.mjs`:

```js
const FACEBOOK_BASE_URL = 'https://www.facebook.com';

function normalizeSlug(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMarketplaceAreaPoint(area = {}) {
  const label = String(area?.label || '').trim();
  const lat = finiteNumber(area?.lat);
  const lon = finiteNumber(area?.lon);
  if (!label || lat == null || lon == null) return null;
  return {
    label,
    slug: String(area?.slug || normalizeSlug(label)).trim(),
    canton: String(area?.canton || '').trim(),
    lat,
    lon
  };
}

export function distanceKm(a = {}, b = {}) {
  const lat1 = finiteNumber(a.lat);
  const lon1 = finiteNumber(a.lon);
  const lat2 = finiteNumber(b.lat);
  const lon2 = finiteNumber(b.lon);
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;

  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function centroid(points) {
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lon = points.reduce((sum, point) => sum + point.lon, 0) / points.length;
  return { lat, lon };
}

function chooseCenter(points) {
  const center = centroid(points);
  return [...points].sort((a, b) => distanceKm(a, center) - distanceKm(b, center))[0];
}

function radiusFor(points, center, options) {
  const minRadiusKm = Math.max(1, Number(options.minRadiusKm ?? 10));
  const maxRadiusKm = Math.max(minRadiusKm, Number(options.maxRadiusKm ?? 30));
  const paddingKm = Math.max(0, Number(options.radiusPaddingKm ?? 3));
  const furthest = points.reduce((max, point) => Math.max(max, distanceKm(center, point)), 0);
  return Math.min(maxRadiusKm, Math.max(minRadiusKm, Math.ceil(furthest + paddingKm)));
}

export function clusterMarketplaceAreas(areas = [], options = {}) {
  const points = areas.map(normalizeMarketplaceAreaPoint).filter(Boolean);
  const clusterDistanceKm = Math.max(1, Number(options.clusterDistanceKm ?? 25));
  const clusters = [];

  for (const point of points) {
    const match = clusters.find((cluster) => (
      cluster.points.some((existing) => distanceKm(existing, point) <= clusterDistanceKm)
    ));
    if (match) match.points.push(point);
    else clusters.push({ points: [point] });
  }

  return clusters.map((cluster) => {
    const centerPoint = chooseCenter(cluster.points);
    const radiusKm = radiusFor(cluster.points, centerPoint, options);
    return {
      key: marketplaceRegionKey({ label: centerPoint.label, center: centerPoint, radiusKm }),
      label: cluster.points.length > 1 ? `${centerPoint.label} area` : centerPoint.label,
      center: { lat: centerPoint.lat, lon: centerPoint.lon },
      centerLabel: centerPoint.label,
      radiusKm,
      memberLabels: cluster.points.map((point) => point.label),
      members: cluster.points
    };
  });
}

export function marketplaceRegionKey(region = {}) {
  const label = normalizeSlug(region.label || region.centerLabel || 'region');
  const lat = finiteNumber(region.center?.lat);
  const lon = finiteNumber(region.center?.lon);
  const radius = Math.trunc(Number(region.radiusKm) || 0);
  return `${label}:${lat?.toFixed(5) || '0.00000'},${lon?.toFixed(5) || '0.00000'}:${radius}`;
}

export function buildMarketplaceSearchUrl(options = {}) {
  const location = String(options.facebookLocation || '').trim();
  if (!location) throw new Error('facebookLocation is required');

  const url = new URL(`/marketplace/${encodeURIComponent(location)}/search/`, FACEBOOK_BASE_URL);
  const query = String(options.query || 'louer appartement').trim();
  if (query) url.searchParams.set('query', query);

  const minPrice = Number(options.minPrice);
  const maxPrice = Number(options.maxPrice);
  const daysSinceListed = Number(options.daysSinceListed);
  const sortBy = String(options.sortBy || 'creation_time_descend').trim();
  const exact = options.exact === true ? 'true' : 'false';

  if (Number.isFinite(minPrice) && minPrice > 0) url.searchParams.set('minPrice', String(Math.trunc(minPrice)));
  if (Number.isFinite(maxPrice) && maxPrice > 0) url.searchParams.set('maxPrice', String(Math.trunc(maxPrice)));
  if (Number.isFinite(daysSinceListed) && daysSinceListed > 0) {
    url.searchParams.set('daysSinceListed', String(Math.trunc(daysSinceListed)));
  }
  if (sortBy) url.searchParams.set('sortBy', sortBy);
  url.searchParams.set('exact', exact);

  return url.toString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --test scripts/lib/facebook-marketplace-regions.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/lib/facebook-marketplace-regions.mjs scripts/lib/facebook-marketplace-regions.test.mjs
git commit -m "feat: add marketplace region clustering"
```

## Task 2: Municipality Coordinate Resolution

**Files:**
- Modify: `scripts/lib/geocode.mjs`
- Modify: `scripts/lib/geocode.test.mjs`

- [ ] **Step 1: Write failing municipality geocode tests**

Append to `scripts/lib/geocode.test.mjs`:

```js
import { geocodeMunicipality } from './geocode.mjs';

test('geocodeMunicipality resolves Swiss municipality coordinates with gg25 origin', async () => {
  const requested = [];
  const cache = {};

  const point = await geocodeMunicipality('Pully', cache, {
    fetchJson: async (url) => {
      requested.push(url);
      assert.equal(new URL(url).searchParams.get('origins'), 'gg25');
      return {
        results: [
          {
            attrs: {
              label: '<b>Pully</b>',
              lat: 46.5103,
              lon: 6.6618
            }
          }
        ]
      };
    }
  });

  assert.deepEqual(point, { lat: 46.5103, lon: 6.6618 });
  assert.equal(requested.length, 1);
  assert.deepEqual(cache['municipality:pully'], point);
});

test('geocodeMunicipality returns null and warns when no coordinate is available', async () => {
  const warnings = [];
  const point = await geocodeMunicipality('Unknown Place', {}, {
    warn: (message) => warnings.push(message),
    fetchJson: async () => ({ results: [] })
  });

  assert.equal(point, null);
  assert.deepEqual(warnings, ['WARN municipality geocode failed for "Unknown Place"']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/lib/geocode.test.mjs
```

Expected: FAIL with `does not provide an export named 'geocodeMunicipality'`.

- [ ] **Step 3: Implement `geocodeMunicipality`**

In `scripts/lib/geocode.mjs`, export this function near the existing `geocodeAddress` export and reuse existing helper names where available:

```js
export async function geocodeMunicipality(label, cache = {}, options = {}) {
  const clean = String(label || '').trim();
  if (!clean) return null;

  const key = `municipality:${normalizeKey(clean)}`;
  const cached = parsePoint(cache[key]?.lat ?? cache[key]?.x ?? cache[key]?.latitude, cache[key]?.lon ?? cache[key]?.y ?? cache[key]?.longitude);
  if (cached) return cached;

  const fetchJson = options.fetchJson || defaultFetchJson;
  const warn = typeof options.warn === 'function' ? options.warn : () => {};
  const url = buildGeoAdminUrl(clean, 'gg25');
  const payload = await fetchJson(url);
  const result = Array.isArray(payload?.results) ? payload.results[0] : null;
  const point = parsePoint(result?.attrs?.lat, result?.attrs?.lon);

  if (!point) {
    warn(`WARN municipality geocode failed for "${clean}"`);
    return null;
  }

  cache[key] = point;
  return point;
}
```

If `normalizeKey`, `parsePoint`, `buildGeoAdminUrl`, or `defaultFetchJson` are private with compatible names, keep them private and call them directly. If a helper name differs, use the existing equivalent in `scripts/lib/geocode.mjs`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --test scripts/lib/geocode.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/lib/geocode.mjs scripts/lib/geocode.test.mjs
git commit -m "feat: resolve municipality coordinates for scans"
```

## Task 3: Facebook Region Search Planning

**Files:**
- Modify: `scripts/lib/facebook-marketplace.mjs`
- Modify: `scripts/lib/facebook-marketplace.test.mjs`

- [ ] **Step 1: Write failing tests for configured URL compatibility and automatic region plans**

Modify the import in `scripts/lib/facebook-marketplace.test.mjs`:

```js
import {
  buildMarketplaceSearchUrls,
  buildMarketplaceSearchPlan,
  detectFacebookAccessProblem,
  explainMarketplaceCard,
  facebookMarketplaceAccessMessage,
  normalizeMarketplaceCard,
  parseMarketplacePrice,
  parseMarketplaceRooms,
  parseMarketplaceSurface,
  renderMarketplaceDebugHtml,
  scrapeFacebookMarketplaceListings
} from './facebook-marketplace.mjs';
```

Add tests:

```js
test('buildMarketplaceSearchUrls accepts legacy singular searchUrl before generated region searches', () => {
  const urls = buildMarketplaceSearchUrls({
    areas: [{ label: 'Lausanne', lat: 46.5197, lon: 6.6323 }],
    facebookMarketplace: {
      searchUrl: 'https://www.facebook.com/marketplace/108211865877609/search/?query=louer%20appartement',
      queryTemplates: ['appartement a louer {area}']
    }
  });

  assert.deepEqual(urls, [
    'https://www.facebook.com/marketplace/108211865877609/search/?query=louer%20appartement'
  ]);
});

test('buildMarketplaceSearchPlan uses configured searchRegions without per-area template fanout', () => {
  const plan = buildMarketplaceSearchPlan({
    areas: [
      { label: 'Lausanne', slug: 'lausanne', lat: 46.5197, lon: 6.6323 },
      { label: 'Pully', slug: 'pully', lat: 46.5103, lon: 6.6618 }
    ],
    filters: { minTotalChf: 1500, maxTotalHardChf: 2300 },
    facebookMarketplace: {
      query: 'louer appartement',
      daysSinceListed: 2,
      searchRegions: [
        {
          label: 'Lausanne area',
          facebookLocation: '108211865877609',
          radiusKm: 20,
          memberLabels: ['Lausanne', 'Pully']
        }
      ],
      queryTemplates: ['appartement a louer {area}']
    }
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].label, 'Lausanne area');
  assert.equal(plan[0].memberLabels.join(','), 'Lausanne,Pully');
  assert.match(plan[0].url, /\/marketplace\/108211865877609\/search\//);
  assert.match(plan[0].url, /query=louer\+appartement/);
  assert.match(plan[0].url, /minPrice=1500/);
  assert.match(plan[0].url, /maxPrice=2300/);
  assert.match(plan[0].url, /daysSinceListed=2/);
});

test('buildMarketplaceSearchPlan clusters profile areas when no explicit search regions exist', () => {
  const plan = buildMarketplaceSearchPlan({
    areas: [
      { label: 'Lausanne', slug: 'lausanne', lat: 46.5197, lon: 6.6323 },
      { label: 'Pully', slug: 'pully', lat: 46.5103, lon: 6.6618 },
      { label: 'Zurich', slug: 'zurich', lat: 47.3769, lon: 8.5417 }
    ],
    filters: { minTotalChf: 1500, maxTotalHardChf: 2300 },
    facebookMarketplace: {
      resolvedRegions: {
        'lausanne-area:46.51970,6.63230:10': { facebookLocation: '108211865877609', verifiedAt: '2026-05-01T10:00:00.000Z' },
        'zurich:47.37690,8.54170:10': { facebookLocation: 'zurich', verifiedAt: '2026-05-01T10:00:00.000Z' }
      }
    }
  });

  assert.equal(plan.length, 2);
  assert.deepEqual(plan.map((entry) => entry.label), ['Lausanne area', 'Zurich']);
  assert.match(plan[0].url, /\/marketplace\/108211865877609\/search\//);
  assert.match(plan[1].url, /\/marketplace\/zurich\/search\//);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/lib/facebook-marketplace.test.mjs
```

Expected: FAIL with `does not provide an export named 'buildMarketplaceSearchPlan'`.

- [ ] **Step 3: Implement search planning**

In `scripts/lib/facebook-marketplace.mjs`, import the pure helpers:

```js
import {
  buildMarketplaceSearchUrl,
  clusterMarketplaceAreas,
  marketplaceRegionKey
} from './facebook-marketplace-regions.mjs';
```

Replace the existing `buildMarketplaceSearchUrls` body with:

```js
export function buildMarketplaceSearchPlan(config = {}) {
  const fb = marketplaceConfig(config);
  const legacyUrls = uniqueStrings([fb.searchUrl, ...(fb.searchUrls || [])])
    .map((url) => toAbsoluteFacebookUrl(url))
    .filter(Boolean)
    .map((url, index) => ({
      key: `configured:${index + 1}`,
      label: `Configured ${index + 1}`,
      memberLabels: [],
      radiusKm: null,
      url,
      needsResolution: false,
      expectedLocationLabel: ''
    }));

  if (legacyUrls.length) return legacyUrls;

  const configuredRegions = Array.isArray(fb.searchRegions) ? fb.searchRegions : [];
  const regions = configuredRegions.length
    ? configuredRegions.map((region) => ({
      key: marketplaceRegionKey(region),
      label: String(region.label || region.centerLabel || 'Marketplace region').trim(),
      center: region.center || null,
      centerLabel: String(region.centerLabel || region.label || '').trim(),
      radiusKm: Number(region.radiusKm) || 10,
      memberLabels: Array.isArray(region.memberLabels) ? region.memberLabels : [],
      facebookLocation: String(region.facebookLocation || '').trim()
    }))
    : clusterMarketplaceAreas(config.areas || [], fb);

  const resolvedRegions = fb.resolvedRegions && typeof fb.resolvedRegions === 'object' ? fb.resolvedRegions : {};
  const query = String(fb.query || 'louer appartement').trim();
  const minPrice = Number(fb.minPrice ?? config?.filters?.minTotalChf ?? 0);
  const maxPrice = Number(fb.maxPrice ?? config?.filters?.maxTotalHardChf ?? config?.filters?.maxTotalChf ?? 0);
  const daysSinceListed = Number(fb.daysSinceListed ?? 2);
  const sortBy = String(fb.sortBy || 'creation_time_descend').trim();

  return regions.map((region) => {
    const resolved = resolvedRegions[region.key] || {};
    const facebookLocation = region.facebookLocation || String(resolved.facebookLocation || '').trim();
    return {
      ...region,
      query,
      minPrice,
      maxPrice,
      daysSinceListed,
      sortBy,
      needsResolution: !facebookLocation,
      expectedLocationLabel: region.centerLabel || region.label,
      facebookLocation,
      url: facebookLocation
        ? buildMarketplaceSearchUrl({ facebookLocation, query, minPrice, maxPrice, daysSinceListed, sortBy, exact: false })
        : ''
    };
  });
}

export function buildMarketplaceSearchUrls(config = {}) {
  return buildMarketplaceSearchPlan(config)
    .filter((entry) => entry.url)
    .map((entry) => entry.url);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --test scripts/lib/facebook-marketplace-regions.test.mjs scripts/lib/facebook-marketplace.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/lib/facebook-marketplace.mjs scripts/lib/facebook-marketplace.test.mjs
git commit -m "feat: plan facebook marketplace region searches"
```

## Task 4: Automatic Facebook Location Resolution

**Files:**
- Modify: `scripts/lib/facebook-marketplace.mjs`
- Modify: `scripts/lib/facebook-marketplace.test.mjs`

- [ ] **Step 1: Write failing tests for active-location parsing and mismatch errors**

Add these exports to the existing import in `scripts/lib/facebook-marketplace.test.mjs`:

```js
  assertMarketplaceActiveLocation,
  extractMarketplaceLocationLabelFromText
```

Add tests:

```js
test('extractMarketplaceLocationLabelFromText reads French Marketplace radius labels', () => {
  assert.equal(
    extractMarketplaceLocationLabelFromText('Filtres\nPully · Dans un rayon de 10 km\nPrix\nCHF 1,500 à CHF 2,300'),
    'Pully'
  );
  assert.equal(
    extractMarketplaceLocationLabelFromText('Filters\nZurich · Within 20 kilometres\nPrice'),
    'Zurich'
  );
});

test('assertMarketplaceActiveLocation fails loudly on wrong global Marketplace location', () => {
  assert.doesNotThrow(() => assertMarketplaceActiveLocation('Filtres\nPully · Dans un rayon de 10 km', 'Pully'));

  assert.throws(
    () => assertMarketplaceActiveLocation('Filtres\nPully · Dans un rayon de 10 km', 'Bulle'),
    /FB_MARKETPLACE_LOCATION_MISMATCH/
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/lib/facebook-marketplace.test.mjs
```

Expected: FAIL with missing exports.

- [ ] **Step 3: Implement location label parsing and mismatch assertion**

Add to `scripts/lib/facebook-marketplace.mjs`:

```js
export function extractMarketplaceLocationLabelFromText(text = '') {
  const lines = String(text || '')
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(.+?)\s*[·-]\s*(?:dans un rayon de|within)\s+\d+/i);
    if (match?.[1]) return normalizeText(match[1]);
  }
  return '';
}

function normalizeLocationComparable(value = '') {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(vd|fr|zh|ge|vs|ne|be|ju|ti|ag|lu|sg|tg|zg|sz|ow|nw|ur|gl|gr|ai|ar|sh|so|bs|bl)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function assertMarketplaceActiveLocation(pageText = '', expectedLabel = '') {
  const expected = normalizeLocationComparable(expectedLabel);
  if (!expected) return;

  const actualLabel = extractMarketplaceLocationLabelFromText(pageText);
  const actual = normalizeLocationComparable(actualLabel);
  if (actual && (actual.includes(expected) || expected.includes(actual))) return;

  throw sourceError(
    'FB_MARKETPLACE_LOCATION_MISMATCH',
    `Expected Facebook Marketplace location "${expectedLabel}", but active filter was "${actualLabel || 'unknown'}"`
  );
}
```

- [ ] **Step 4: Implement Playwright region resolution**

In `scripts/lib/facebook-marketplace.mjs`, add:

```js
async function resolveMarketplaceRegionInBrowser(page, region, config = {}) {
  const timeout = navigationTimeoutMs(config);
  const label = region.expectedLocationLabel || region.centerLabel || region.label;
  if (!label) {
    throw sourceError('FB_MARKETPLACE_LOCATION_REQUIRED', 'Cannot resolve Facebook Marketplace region without a label');
  }

  await page.goto(`${FACEBOOK_BASE_URL}/marketplace/`, { waitUntil: 'domcontentloaded', timeout });
  const beforeText = await page.locator('body').innerText({ timeout: Math.min(timeout, 10000) }).catch(() => '');
  const problem = detectFacebookAccessProblem(beforeText, page.url());
  if (problem) throw sourceError(problem, facebookMarketplaceAccessMessage(problem, page.url()));

  const locationButtons = [
    page.getByRole('button', { name: /lieu|location|emplacement/i }),
    page.getByText(/dans un rayon de|within \d+/i).first()
  ];

  let opened = false;
  for (const locator of locationButtons) {
    try {
      await locator.click({ timeout: 5000 });
      opened = true;
      break;
    } catch {}
  }
  if (!opened) {
    throw sourceError('FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND', `Could not open Facebook Marketplace location picker for "${label}"`);
  }

  const input = page.getByRole('textbox').filter({ hasText: /.*/ }).first();
  await input.fill(label, { timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);

  const radius = Number(region.radiusKm || 10);
  const radiusInput = page.getByRole('spinbutton').first();
  await radiusInput.fill(String(Math.trunc(radius))).catch(() => {});

  const applyButton = page.getByRole('button', { name: /appliquer|apply|mettre a jour|update/i }).first();
  await applyButton.click({ timeout: 10000 }).catch(async () => page.keyboard.press('Enter'));
  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
  await page.waitForTimeout(1500);

  const afterText = await page.locator('body').innerText({ timeout: Math.min(timeout, 10000) }).catch(() => '');
  assertMarketplaceActiveLocation(afterText, label);

  const current = new URL(page.url());
  const parts = current.pathname.split('/').filter(Boolean);
  const marketplaceIndex = parts.indexOf('marketplace');
  const facebookLocation = marketplaceIndex >= 0 && parts[marketplaceIndex + 1] && parts[marketplaceIndex + 1] !== 'search'
    ? parts[marketplaceIndex + 1]
    : '';

  if (!facebookLocation) {
    throw sourceError('FB_MARKETPLACE_LOCATION_ID_MISSING', `Facebook did not expose a Marketplace location path for "${label}"`);
  }

  return {
    facebookLocation,
    verifiedAt: new Date().toISOString(),
    label,
    radiusKm: Math.trunc(radius)
  };
}
```

This Playwright flow is intentionally fail-loud. If Facebook changes labels or hides controls, it must throw one of the `FB_MARKETPLACE_*` errors instead of scraping from the wrong global location.

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
node --test scripts/lib/facebook-marketplace.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add scripts/lib/facebook-marketplace.mjs scripts/lib/facebook-marketplace.test.mjs
git commit -m "feat: verify facebook marketplace location"
```

## Task 5: Resolve Missing Area Coordinates Before Facebook Scan

**Files:**
- Modify: `scripts/lib/facebook-marketplace.mjs`
- Modify: `scripts/scrape-immobilier.mjs`
- Modify: `scripts/lib/facebook-marketplace.test.mjs`

- [ ] **Step 1: Write failing tests for coordinate hydration**

In `scripts/lib/facebook-marketplace.test.mjs`, add `hydrateMarketplaceAreaCoordinates` to the import and append:

```js
test('hydrateMarketplaceAreaCoordinates geocodes areas missing coordinates', async () => {
  const cache = {};
  const areas = await hydrateMarketplaceAreaCoordinates(
    [
      { label: 'Pully', slug: 'pully', canton: 'vaud' },
      { label: 'Lausanne', slug: 'lausanne', canton: 'vaud', lat: 46.5197, lon: 6.6323 }
    ],
    cache,
    {
      geocodeMunicipality: async (label, nextCache) => {
        assert.equal(label, 'Pully');
        assert.equal(nextCache, cache);
        return { lat: 46.5103, lon: 6.6618 };
      }
    }
  );

  assert.deepEqual(areas, [
    { label: 'Pully', slug: 'pully', canton: 'vaud', lat: 46.5103, lon: 6.6618 },
    { label: 'Lausanne', slug: 'lausanne', canton: 'vaud', lat: 46.5197, lon: 6.6323 }
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/lib/facebook-marketplace.test.mjs
```

Expected: FAIL with missing export.

- [ ] **Step 3: Implement coordinate hydration**

In `scripts/lib/facebook-marketplace.mjs`, import:

```js
import { geocodeMunicipality } from './geocode.mjs';
```

Add:

```js
function hasAreaPoint(area = {}) {
  return Number.isFinite(Number(area.lat)) && Number.isFinite(Number(area.lon));
}

export async function hydrateMarketplaceAreaCoordinates(areas = [], cache = {}, options = {}) {
  const resolver = options.geocodeMunicipality || geocodeMunicipality;
  const out = [];

  for (const area of Array.isArray(areas) ? areas : []) {
    if (hasAreaPoint(area)) {
      out.push(area);
      continue;
    }

    const point = await resolver(area?.label, cache, options);
    if (!point) {
      throw sourceError('FB_MARKETPLACE_AREA_COORDINATES_MISSING', `Cannot resolve coordinates for Facebook Marketplace area "${area?.label || ''}"`);
    }

    out.push({ ...area, lat: point.lat, lon: point.lon });
  }

  return out;
}
```

- [ ] **Step 4: Pass geocode cache into Facebook scraper**

In `scripts/scrape-immobilier.mjs`, locate the Facebook task:

```js
run: () => scrapeFacebookMarketplaceListings({
  ...config,
  facebookMarketplace: {
    ...(config.facebookMarketplace || {}),
    debugDir: config.facebookMarketplace?.debugDir || path.join(DATA_DIR, 'debug')
  }
})
```

Change it to include the loaded geocode cache object if it is named `geocodeCache` in scope:

```js
run: () => scrapeFacebookMarketplaceListings({
  ...config,
  geocodeCache,
  facebookMarketplace: {
    ...(config.facebookMarketplace || {}),
    debugDir: config.facebookMarketplace?.debugDir || path.join(DATA_DIR, 'debug')
  }
})
```

If the cache variable has a different local name, use that existing variable. Do not create a second cache file.

- [ ] **Step 5: Hydrate areas before planning**

In `scrapeWithPlaywright(config = {})`, before building the search plan, replace:

```js
const urls = buildMarketplaceSearchUrls(config);
```

with:

```js
const hydratedAreas = await hydrateMarketplaceAreaCoordinates(config.areas || [], config.geocodeCache || {});
const nextConfig = { ...config, areas: hydratedAreas };
const searchPlan = buildMarketplaceSearchPlan(nextConfig);
const urls = searchPlan.filter((entry) => entry.url).map((entry) => entry.url);
```

Update later references that need search metadata to use `searchPlan[urlIndex]`.

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
node --test scripts/lib/geocode.test.mjs scripts/lib/facebook-marketplace-regions.test.mjs scripts/lib/facebook-marketplace.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add scripts/lib/facebook-marketplace.mjs scripts/lib/facebook-marketplace.test.mjs scripts/scrape-immobilier.mjs
git commit -m "feat: hydrate marketplace area coordinates"
```

## Task 6: Integrate Region Resolution Into Scraping

**Files:**
- Modify: `scripts/lib/facebook-marketplace.mjs`
- Modify: `scripts/lib/facebook-marketplace.test.mjs`

- [ ] **Step 1: Write failing test for unresolved regions failing before scraping**

Append to `scripts/lib/facebook-marketplace.test.mjs`:

```js
test('buildMarketplaceSearchUrls returns no URL for unresolved automatic regions', () => {
  const urls = buildMarketplaceSearchUrls({
    areas: [{ label: 'Bulle', slug: 'bulle', lat: 46.6170, lon: 7.0570 }],
    facebookMarketplace: {}
  });

  assert.deepEqual(urls, []);
});
```

- [ ] **Step 2: Run tests to verify they pass or fail for the right reason**

Run:

```bash
node --test scripts/lib/facebook-marketplace.test.mjs
```

Expected: PASS if Task 3 already made unresolved plans URL-less. If it fails because a text query URL is generated, remove the legacy query-template fallback from automatic planning.

- [ ] **Step 3: Resolve missing regions in the browser**

In `scrapeWithPlaywright(config = {})`, after creating `searchPlan` and after opening the Playwright page, add:

```js
for (const entry of searchPlan) {
  if (!entry.needsResolution) continue;
  const resolved = await resolveMarketplaceRegionInBrowser(page, entry, nextConfig);
  entry.facebookLocation = resolved.facebookLocation;
  entry.url = buildMarketplaceSearchUrl({
    facebookLocation: resolved.facebookLocation,
    query: entry.query,
    minPrice: entry.minPrice,
    maxPrice: entry.maxPrice,
    daysSinceListed: entry.daysSinceListed,
    sortBy: entry.sortBy,
    exact: false
  });
  entry.needsResolution = false;
  entry.resolved = resolved;
}

const unresolved = searchPlan.filter((entry) => !entry.url);
if (unresolved.length) {
  throw sourceError(
    'FB_MARKETPLACE_REGIONS_UNRESOLVED',
    `Could not resolve Facebook Marketplace regions: ${unresolved.map((entry) => entry.label).join(', ')}`
  );
}
```

- [ ] **Step 4: Verify active location before card extraction**

Inside the `for (let urlIndex = 0; urlIndex < urls.length; urlIndex += 1)` loop, after reading `initialText` and checking `initialProblem`, add:

```js
const expectedLocation = searchPlan[urlIndex]?.expectedLocationLabel || '';
assertMarketplaceActiveLocation(initialText, expectedLocation);
```

For legacy configured `searchUrl` entries, `expectedLocationLabel` is empty, so no assertion runs.

- [ ] **Step 5: Include region metadata in debug trace**

In `createMarketplaceDebugTrace`, add these fields per search:

```js
regionLabel: searchPlan?.[index]?.label || '',
expectedLocationLabel: searchPlan?.[index]?.expectedLocationLabel || '',
memberLabels: searchPlan?.[index]?.memberLabels || [],
radiusKm: searchPlan?.[index]?.radiusKm ?? null,
needsResolution: searchPlan?.[index]?.needsResolution === true
```

Change the function signature to accept `searchPlan`:

```js
function createMarketplaceDebugTrace(config = {}, urls = [], searchPlan = [])
```

Pass `searchPlan` at the call site.

- [ ] **Step 6: Run tests**

Run:

```bash
node --test scripts/lib/facebook-marketplace-regions.test.mjs scripts/lib/facebook-marketplace.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add scripts/lib/facebook-marketplace.mjs scripts/lib/facebook-marketplace.test.mjs
git commit -m "feat: resolve facebook marketplace regions"
```

## Task 7: Throttle Region Searches

**Files:**
- Modify: `scripts/lib/facebook-marketplace.mjs`
- Modify: `scripts/lib/facebook-marketplace.test.mjs`

- [ ] **Step 1: Write failing tests for throttle config parsing**

Add `marketplaceThrottleDelayMs` to the import and append:

```js
test('marketplaceThrottleDelayMs uses configured min and max jitter bounds', () => {
  assert.equal(
    marketplaceThrottleDelayMs({ facebookMarketplace: { throttleMinMs: 20000, throttleMaxMs: 45000 } }, 0),
    0
  );

  const delay = marketplaceThrottleDelayMs(
    { facebookMarketplace: { throttleMinMs: 20000, throttleMaxMs: 45000 } },
    1,
    () => 0.5
  );

  assert.equal(delay, 32500);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/lib/facebook-marketplace.test.mjs
```

Expected: FAIL with missing export.

- [ ] **Step 3: Implement throttle delay helper**

Add:

```js
export function marketplaceThrottleDelayMs(config = {}, urlIndex = 0, random = Math.random) {
  if (urlIndex <= 0) return 0;
  const fb = marketplaceConfig(config);
  const min = Math.max(0, Number(fb.throttleMinMs ?? process.env.FACEBOOK_MARKETPLACE_THROTTLE_MIN_MS ?? 20000));
  const max = Math.max(min, Number(fb.throttleMaxMs ?? process.env.FACEBOOK_MARKETPLACE_THROTTLE_MAX_MS ?? 45000));
  return Math.round(min + (max - min) * random());
}
```

- [ ] **Step 4: Use throttle before each region after the first**

Inside the URL loop in `scrapeWithPlaywright`, before `page.goto(url, ...)`, add:

```js
const throttleMs = marketplaceThrottleDelayMs(nextConfig, urlIndex);
if (throttleMs > 0) {
  if (debugSearch) debugSearch.throttleMs = throttleMs;
  await page.waitForTimeout(throttleMs);
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test scripts/lib/facebook-marketplace.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add scripts/lib/facebook-marketplace.mjs scripts/lib/facebook-marketplace.test.mjs
git commit -m "feat: throttle facebook marketplace region scans"
```

## Task 8: Profile Config Cleanup and Full Verification

**Files:**
- Modify: `data/profiles/vaud-3-pieces/watch-config.json`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Clean the Vaud profile Facebook config**

Change `data/profiles/vaud-3-pieces/watch-config.json` from per-area templates to generic automatic region settings:

```json
"facebookMarketplace": {
  "query": "louer appartement",
  "daysSinceListed": 2,
  "sortBy": "creation_time_descend",
  "exact": false,
  "clusterDistanceKm": 25,
  "minRadiusKm": 10,
  "maxRadiusKm": 30,
  "throttleMinMs": 20000,
  "throttleMaxMs": 45000,
  "maxScrollsPerSearch": 4,
  "maxListingsPerSearch": 60
}
```

Keep the existing source enablement:

```json
"facebookMarketplace": true
```

inside `sources`.

- [ ] **Step 2: Document throttle env vars**

In `.env.example`, add:

```bash
FACEBOOK_MARKETPLACE_THROTTLE_MIN_MS=20000
FACEBOOK_MARKETPLACE_THROTTLE_MAX_MS=45000
```

- [ ] **Step 3: Document automatic region behavior**

In `README.md`, add a short Facebook Marketplace section:

```md
### Facebook Marketplace

Facebook Marketplace is experimental and requires a local logged-in browser profile. Run `FACEBOOK_MARKETPLACE_HEADLESS=false npm run facebook:login` once, then scans can run headlessly.

Marketplace searches are region-based, not town-query based. The scraper clusters selected profile zones by distance, resolves each cluster through Facebook's location picker, verifies the active Marketplace location, and runs one broad query per cluster. If Facebook shows a different active location than expected, the scan fails instead of scraping the wrong region.
```

- [ ] **Step 4: Run focused Node tests**

Run:

```bash
node --test scripts/lib/geocode.test.mjs scripts/lib/facebook-marketplace-regions.test.mjs scripts/lib/facebook-marketplace.test.mjs scripts/lib/dedup.test.mjs scripts/lib/scan-progress.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run UI and build checks**

Run:

```bash
npm run test:ui
npm run build:ui
```

Expected: PASS.

- [ ] **Step 6: Manual browser verification**

Run:

```bash
FACEBOOK_MARKETPLACE_HEADLESS=false npm run facebook:login
FACEBOOK_MARKETPLACE_HEADLESS=false FACEBOOK_MARKETPLACE_DEBUG=true npm run scan -- --profile=vaud-3-pieces
```

Expected result:

- The debug report lists a small number of region searches, not one search per town.
- Each region has an expected location label.
- Each loaded Facebook page shows the expected active location.
- If Facebook cannot set or verify a region, the scan exits with a clear `FB_MARKETPLACE_*` error.

- [ ] **Step 7: Commit**

Run:

```bash
git add data/profiles/vaud-3-pieces/watch-config.json .env.example README.md
git commit -m "docs: explain facebook marketplace regions"
```

## Risks and Guardrails

- Facebook's UI can change. The location resolver must fail loudly with `FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND` or `FB_MARKETPLACE_LOCATION_MISMATCH`.
- Facebook may store location globally. The scraper must verify active location on every region search, even when using a cached location path.
- Old profiles may lack area coordinates. The scraper must hydrate them through geo.admin.ch or fail before browsing Facebook.
- The automatic resolver may be too brittle in headless mode. The manual verification command runs headed first so failures are visible during rollout.
- Do not add proxy services, paid scraping providers, or hidden fallback searches.

## Self-Review

- Spec coverage: The plan covers automatic clustering, no user interaction beyond login, region-scoped URLs, global-location verification, geocode fallback, throttling, and fail-loud behavior.
- Placeholder scan: No placeholder markers remain. The only conditional instruction is to use existing helper names when their exact private names differ in `geocode.mjs`; the required public behavior and test are explicit.
- Type consistency: Region objects consistently use `key`, `label`, `centerLabel`, `radiusKm`, `memberLabels`, `facebookLocation`, `url`, `needsResolution`, and `expectedLocationLabel`.
