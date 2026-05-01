import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMarketplaceSearchPlan,
  buildMarketplaceSearchUrls,
  assertMarketplaceActiveLocation,
  assertMarketplaceSearchPlanRadiusSupported,
  detectFacebookAccessProblem,
  explainMarketplaceCard,
  extractMarketplaceLocationLabelFromText,
  extractMarketplaceVisibleFilterText,
  facebookMarketplaceAccessMessage,
  finalizeResolvedMarketplaceRegion,
  hydrateMarketplaceAreaCoordinates,
  assertMarketplaceActiveRadius,
  marketplaceInteractionDelayMs,
  marketplaceThrottleDelayMs,
  marketplaceTextShowsRadius,
  normalizeMarketplaceCard,
  parseMarketplacePrice,
  parseMarketplaceRooms,
  parseMarketplaceSurface,
  prepareMarketplaceSearchConfig,
  renderMarketplaceDebugHtml,
  scrapeFacebookMarketplaceListings
} from './facebook-marketplace.mjs';
import { buildCrossSourceDedupKey, buildSurfacelessDedupKey } from './dedup.mjs';

test('parseMarketplacePrice extracts CHF totals', () => {
  assert.equal(parseMarketplacePrice("CHF 1'450"), 1450);
  assert.equal(parseMarketplacePrice('1 690 CHF'), 1690);
  assert.equal(parseMarketplacePrice('Gratuit'), null);
});

test('parseMarketplaceRooms extracts French room counts', () => {
  assert.equal(parseMarketplaceRooms('Appartement 2.5 pieces'), 2.5);
  assert.equal(parseMarketplaceRooms('3,5 pièces lumineux'), 3.5);
  assert.equal(parseMarketplaceRooms('Studio proche gare'), 1);
});

test('parseMarketplaceSurface extracts square meters', () => {
  assert.equal(parseMarketplaceSurface('65 m2'), 65);
  assert.equal(parseMarketplaceSurface('Appartement de 72 m²'), 72);
  assert.equal(parseMarketplaceSurface('surface inconnue'), null);
});

test('marketplaceThrottleDelayMs returns zero for the first search URL', () => {
  assert.equal(marketplaceThrottleDelayMs({}, 0, () => 1), 0);
});

test('marketplaceThrottleDelayMs returns configured midpoint delay', () => {
  assert.equal(
    marketplaceThrottleDelayMs(
      { facebookMarketplace: { throttleMinMs: 20000, throttleMaxMs: 45000 } },
      1,
      () => 0.5
    ),
    32500
  );
});

test('marketplaceThrottleDelayMs clamps max below min to min', () => {
  assert.equal(
    marketplaceThrottleDelayMs(
      { facebookMarketplace: { throttleMinMs: 45000, throttleMaxMs: 20000 } },
      1,
      () => 0.5
    ),
    45000
  );
});

test('marketplaceInteractionDelayMs returns configured jittered delay', () => {
  assert.equal(
    marketplaceInteractionDelayMs(
      { facebookMarketplace: { interactionMinMs: 900, interactionMaxMs: 2100 } },
      () => 0.25
    ),
    1200
  );
});

test('marketplaceTextShowsRadius detects Facebook radius summary text', () => {
  assert.equal(
    marketplaceTextShowsRadius('Filtres\nPrilly · Dans un rayon de 10 km', 10),
    true
  );
  assert.equal(
    marketplaceTextShowsRadius('Filters\nPrilly · Within 10 kilometers', 10),
    true
  );
  assert.equal(
    marketplaceTextShowsRadius('Filtres\nPrilly · Dans un rayon de 20 km', 10),
    false
  );
});

test('assertMarketplaceActiveRadius accepts matching summary and rejects mismatches', () => {
  assert.doesNotThrow(() => {
    assertMarketplaceActiveRadius('Filtres\nPrilly · Dans un rayon de 10 km', 10, 'Prilly');
  });

  assert.throws(
    () => assertMarketplaceActiveRadius('Filtres\nPrilly · Dans un rayon de 20 km', 10, 'Prilly'),
    /FB_MARKETPLACE_RADIUS_MISMATCH/
  );
});

test('buildMarketplaceSearchUrls accepts singular searchUrl and suppresses query fanout', () => {
  const urls = buildMarketplaceSearchUrls({
    areas: [{ label: 'Lausanne' }, { label: 'Vevey' }],
    facebookMarketplace: {
      queryTemplates: ['appartement a louer {area}'],
      searchUrl: 'https://www.facebook.com/marketplace/lausanne/propertyrentals'
    }
  });

  assert.deepEqual(urls, ['https://www.facebook.com/marketplace/lausanne/propertyrentals']);
});

test('buildMarketplaceSearchPlan builds configured Facebook location regions', () => {
  const plan = buildMarketplaceSearchPlan({
    filters: { minTotalChf: 1000, maxTotalChf: 2200 },
    facebookMarketplace: {
      exact: true,
      searchRegions: [
        {
          label: 'Lausanne region',
          center: { lat: 46.5197, lon: 6.6323 },
          centerLabel: 'Lausanne',
          radiusKm: 10,
          memberLabels: ['Lausanne', 'Pully'],
          facebookLocation: 'lausanne'
        }
      ]
    }
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].label, 'Lausanne region');
  assert.deepEqual(plan[0].memberLabels, ['Lausanne', 'Pully']);
  assert.equal(plan[0].needsResolution, false);
  assert.match(plan[0].url, /\/marketplace\/lausanne\/search\//);
  assert.match(plan[0].url, /query=louer\+appartement/);
  assert.match(plan[0].url, /minPrice=1000/);
  assert.match(plan[0].url, /maxPrice=2200/);
  assert.match(plan[0].url, /daysSinceListed=2/);
  assert.match(plan[0].url, /exact=true/);
});

test('buildMarketplaceSearchPlan uses resolved locations for automatic clustered regions', () => {
  const plan = buildMarketplaceSearchPlan({
    areas: [
      { label: 'Lausanne', lat: 46.5197, lon: 6.6323 },
      { label: 'Zurich', lat: 47.3769, lon: 8.5417 }
    ],
    filters: { minTotalChf: 900, maxTotalHardChf: 2500 },
    facebookMarketplace: {
      query: 'appartement',
      resolvedRegions: {
        'lausanne:46.51970,6.63230:10': { facebookLocation: 'lausanne' },
        'zurich:47.37690,8.54170:10': { facebookLocation: 'zurich' }
      }
    }
  });

  assert.equal(plan.length, 2);
  assert.deepEqual(plan.map((entry) => entry.memberLabels), [['Lausanne'], ['Zurich']]);
  assert.deepEqual(plan.map((entry) => entry.needsResolution), [false, false]);
  assert.match(plan[0].url, /\/marketplace\/lausanne\/search\//);
  assert.match(plan[0].url, /query=appartement/);
  assert.match(plan[0].url, /minPrice=900/);
  assert.match(plan[0].url, /maxPrice=2500/);
  assert.match(plan[1].url, /\/marketplace\/zurich\/search\//);
});

test('buildMarketplaceSearchPlan keeps automatic region display label separate from Facebook location label', () => {
  const plan = buildMarketplaceSearchPlan({
    areas: [
      { label: 'Lausanne', lat: 46.5197, lon: 6.6323 },
      { label: 'Pully', lat: 46.5103, lon: 6.6618 }
    ],
    facebookMarketplace: {}
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].label, 'Lausanne area');
  assert.equal(plan[0].centerLabel, 'Lausanne');
  assert.equal(plan[0].expectedLocationLabel, 'Lausanne');
  assert.deepEqual(plan[0].memberLabels, ['Lausanne', 'Pully']);
});

test('buildMarketplaceSearchUrls omits unresolved automatic regions', () => {
  const urls = buildMarketplaceSearchUrls({
    areas: [{ label: 'Lausanne', lat: 46.5197, lon: 6.6323 }],
    facebookMarketplace: {}
  });

  assert.deepEqual(urls, []);
});

test('hydrateMarketplaceAreaCoordinates geocodes areas missing coordinates', async () => {
  const cache = {};
  const areas = [
    { label: 'Pully' },
    { label: 'Lausanne', lat: 46.5197, lon: 6.6323 }
  ];

  const hydrated = await hydrateMarketplaceAreaCoordinates(areas, cache, {
    geocodeMunicipality: async (label, receivedCache) => {
      assert.equal(label, 'Pully');
      assert.equal(receivedCache, cache);
      return { lat: 46.5103, lon: 6.6618 };
    }
  });

  assert.deepEqual(hydrated, [
    { label: 'Pully', lat: 46.5103, lon: 6.6618 },
    { label: 'Lausanne', lat: 46.5197, lon: 6.6323 }
  ]);
  assert.equal(hydrated[1], areas[1]);
});

test('hydrateMarketplaceAreaCoordinates fails when coordinates cannot be resolved', async () => {
  await assert.rejects(
    () => hydrateMarketplaceAreaCoordinates(
      [{ label: 'Unknown Place' }],
      {},
      { geocodeMunicipality: async () => null }
    ),
    /FB_MARKETPLACE_AREA_COORDINATES_MISSING/
  );
});

test('prepareMarketplaceSearchConfig keeps configured URLs without geocoding legacy areas', async () => {
  let geocodeCalls = 0;
  const searchUrl = 'https://www.facebook.com/marketplace/lausanne/propertyrentals';

  const prepared = await prepareMarketplaceSearchConfig({
    areas: [{ label: 'Legacy Area' }],
    geocodeOptions: {
      geocodeMunicipality: async () => {
        geocodeCalls += 1;
        throw new Error('geocoder should not be called');
      }
    },
    facebookMarketplace: { searchUrl }
  });

  assert.equal(geocodeCalls, 0);
  assert.deepEqual(prepared.urls, [searchUrl]);
  assert.deepEqual(prepared.searchPlan.map((entry) => entry.url), [searchUrl]);
  assert.deepEqual(prepared.config.areas, [{ label: 'Legacy Area' }]);
});

test('prepareMarketplaceSearchConfig keeps unresolved automatic regions in the search plan', async () => {
  const prepared = await prepareMarketplaceSearchConfig({
    areas: [{ label: 'Pully', lat: 46.5103, lon: 6.6618 }],
    facebookMarketplace: {}
  });

  assert.deepEqual(prepared.urls, []);
  assert.equal(prepared.searchPlan.length, 1);
  assert.equal(prepared.searchPlan[0].label, 'Pully');
  assert.equal(prepared.searchPlan[0].expectedLocationLabel, 'Pully');
  assert.equal(prepared.searchPlan[0].needsResolution, true);
  assert.equal(prepared.searchPlan[0].url, '');
});

test('finalizeResolvedMarketplaceRegion fills location URL and clears resolution flag', () => {
  const entry = {
    label: 'Pully',
    query: 'appartement',
    minPrice: 1200,
    maxPrice: 2400,
    daysSinceListed: 3,
    sortBy: 'creation_time_descend',
    exact: true,
    needsResolution: true,
    url: '',
    expectedLocationLabel: 'Pully'
  };

  const finalized = finalizeResolvedMarketplaceRegion(entry, {
    facebookLocation: 'lausanne',
    expectedLocationLabel: 'Lausanne'
  });

  assert.notEqual(finalized, entry);
  assert.equal(entry.facebookLocation, undefined);
  assert.equal(entry.needsResolution, true);
  assert.equal(entry.url, '');
  assert.equal(finalized.facebookLocation, 'lausanne');
  assert.equal(finalized.needsResolution, false);
  assert.equal(finalized.expectedLocationLabel, 'Lausanne');
  assert.match(finalized.url, /\/marketplace\/lausanne\/search\//);
  assert.match(finalized.url, /query=appartement/);
  assert.match(finalized.url, /minPrice=1200/);
  assert.match(finalized.url, /maxPrice=2400/);
  assert.match(finalized.url, /daysSinceListed=3/);
  assert.match(finalized.url, /exact=true/);
});

test('finalizeResolvedMarketplaceRegion supports verified global Marketplace location', () => {
  const finalized = finalizeResolvedMarketplaceRegion({
    label: 'Prilly area',
    query: 'louer appartement',
    daysSinceListed: 2,
    needsResolution: true,
    url: '',
    expectedLocationLabel: 'Prilly'
  }, {
    useGlobalLocation: true,
    expectedLocationLabel: 'Prilly'
  });

  assert.equal(finalized.needsResolution, false);
  assert.equal(finalized.useGlobalLocation, true);
  assert.equal(finalized.facebookLocation, '');
  assert.match(finalized.url, /\/marketplace\/search\//);
  assert.match(finalized.url, /query=louer\+appartement/);
});

test('assertMarketplaceSearchPlanRadiusSupported rejects mixed positive radii', () => {
  assert.throws(
    () => assertMarketplaceSearchPlanRadiusSupported([
      { label: 'Lausanne', radiusKm: 10 },
      { label: 'Geneva', radiusKm: 20 },
      { label: 'Configured URL', radiusKm: null }
    ]),
    (err) => {
      assert.equal(err?.code, 'FB_MARKETPLACE_MIXED_RADIUS_UNSUPPORTED');
      assert.match(err?.message || '', /Lausanne.*10/);
      assert.match(err?.message || '', /Geneva.*20/);
      return true;
    }
  );
});

test('assertMarketplaceSearchPlanRadiusSupported rejects unresolved initial plans with mixed radii', async () => {
  const prepared = await prepareMarketplaceSearchConfig({
    facebookMarketplace: {
      searchRegions: [
        { label: 'Lausanne region', centerLabel: 'Lausanne', radiusKm: 10 },
        { label: 'Geneva region', centerLabel: 'Geneva', radiusKm: 20 }
      ]
    }
  });

  assert.deepEqual(prepared.searchPlan.map((entry) => entry.needsResolution), [true, true]);
  assert.deepEqual(prepared.searchPlan.map((entry) => entry.url), ['', '']);
  assert.throws(
    () => assertMarketplaceSearchPlanRadiusSupported(prepared.searchPlan),
    (err) => {
      assert.equal(err?.code, 'FB_MARKETPLACE_MIXED_RADIUS_UNSUPPORTED');
      assert.match(err?.message || '', /Lausanne region.*10/);
      assert.match(err?.message || '', /Geneva region.*20/);
      return true;
    }
  );
});

test('assertMarketplaceSearchPlanRadiusSupported allows same positive radii', () => {
  assert.doesNotThrow(() => assertMarketplaceSearchPlanRadiusSupported([
    { label: 'Lausanne', radiusKm: 10 },
    { label: 'Geneva', radiusKm: 10 },
    { label: 'Configured URL', radiusKm: null }
  ]));
});

test('normalizeMarketplaceCard maps card data to tracker listing shape', () => {
  const item = normalizeMarketplaceCard({
    url: '/marketplace/item/123456789/',
    title: 'Appartement 2.5 pieces, 65 m2',
    priceText: "CHF 1'450",
    locationText: 'Lausanne',
    imageUrls: ['https://example.test/photo.jpg'],
    scrapedAt: '2026-05-01T10:00:00.000Z'
  });

  assert.equal(item.id, 'facebook:123456789');
  assert.equal(item.sourceId, '123456789');
  assert.equal(item.url, 'https://www.facebook.com/marketplace/item/123456789/');
  assert.equal(item.source, 'Facebook Marketplace');
  assert.equal(item.listingStage, 'early_market');
  assert.equal(item.title, 'Appartement 2.5 pieces, 65 m2');
  assert.equal(item.area, 'Lausanne');
  assert.equal(item.address, 'Lausanne');
  assert.equal(item.totalChf, 1450);
  assert.equal(item.rooms, 2.5);
  assert.equal(item.surfaceM2, 65);
  assert.equal(item.dedupDisabled, true);
  assert.deepEqual(item.imageUrls, ['https://example.test/photo.jpg']);
});

test('normalizeMarketplaceCard ignores Facebook freshness labels when lines include title and city', () => {
  const item = normalizeMarketplaceCard({
    url: '/marketplace/item/940217408646449/',
    title: 'Annonce récente',
    priceText: '1 575 CHF',
    locationText: 'Reprise de bail',
    lines: [
      'Annonce récente',
      '1 575 CHF',
      'Reprise de bail',
      'Biel/Bienne, BE'
    ]
  });

  assert.equal(item.title, 'Reprise de bail');
  assert.equal(item.address, 'Biel/Bienne, BE');
  assert.equal(item.area, 'Biel/Bienne, BE');
});

test('normalizeMarketplaceCard rejects cards missing stable identity or price', () => {
  assert.equal(normalizeMarketplaceCard({ title: 'Appartement', priceText: 'CHF 1200' }), null);
  assert.equal(normalizeMarketplaceCard({ url: '/marketplace/item/123/', priceText: 'CHF 1200' }), null);
  assert.equal(normalizeMarketplaceCard({ url: '/marketplace/item/123/', title: 'Appartement' }), null);
});

test('explainMarketplaceCard keeps raw order and rejection reasons for debugging', () => {
  const accepted = explainMarketplaceCard(
    {
      order: 2,
      url: '/marketplace/item/123456789/',
      title: 'Appartement 2.5 pieces',
      priceText: "CHF 1'450",
      locationText: 'Lausanne',
      lines: ["CHF 1'450", 'Appartement 2.5 pieces', 'Lausanne']
    },
    { areaLabel: 'Lausanne', scrapedAt: '2026-05-01T10:00:00.000Z' }
  );
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.order, 2);
  assert.equal(accepted.normalized.totalChf, 1450);
  assert.equal(accepted.raw.priceText, "CHF 1'450");

  const rejected = explainMarketplaceCard(
    {
      order: 3,
      url: '/marketplace/item/987654321/',
      title: 'Appartement sans prix',
      priceText: '',
      lines: ['Appartement sans prix', 'Lausanne']
    },
    { areaLabel: 'Lausanne' }
  );
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.rejectReason, 'missing price');
  assert.equal(rejected.normalized, null);
});

test('detectFacebookAccessProblem reports login and blocked states', () => {
  assert.equal(
    detectFacebookAccessProblem('Connectez-vous a Facebook pour continuer', 'https://www.facebook.com/marketplace'),
    'FB_MARKETPLACE_LOGIN_REQUIRED'
  );
  assert.equal(
    detectFacebookAccessProblem("You're Temporarily Blocked", 'https://www.facebook.com/marketplace'),
    'FB_MARKETPLACE_BLOCKED'
  );
  assert.equal(detectFacebookAccessProblem('Marketplace listings', 'https://www.facebook.com/marketplace'), null);
});

test('extractMarketplaceLocationLabelFromText extracts French active location labels', () => {
  assert.equal(
    extractMarketplaceLocationLabelFromText('Filtres\nPully · Dans un rayon de 10 km\nPrix\nCHF 1,500 à CHF 2,300'),
    'Pully'
  );
});

test('extractMarketplaceLocationLabelFromText extracts split French filter summaries', () => {
  assert.equal(
    extractMarketplaceLocationLabelFromText('Filtres\nPrilly\nDans un rayon de 10 km\nPrix'),
    'Prilly'
  );
});

test('extractMarketplaceLocationLabelFromText extracts English active location labels', () => {
  assert.equal(
    extractMarketplaceLocationLabelFromText('Filters\nZurich · Within 20 kilometres\nPrice'),
    'Zurich'
  );
});

test('extractMarketplaceVisibleFilterText prefers text near the visible filter heading', () => {
  assert.equal(
    extractMarketplaceVisibleFilterText('Marketplace\nÉpalinges · Dans un rayon de 20 km\nFiltres\nPrilly\nDans un rayon de 10 km\nPrix'),
    'Prilly\nDans un rayon de 10 km\nPrix'
  );
});

test('assertMarketplaceActiveLocation accepts matching active location labels', () => {
  assert.doesNotThrow(() => {
    assertMarketplaceActiveLocation('Filtres\nPully · Dans un rayon de 10 km', 'Pully');
  });
});

test('assertMarketplaceActiveLocation ignores whitespace and canton suffixes', () => {
  assert.doesNotThrow(() => {
    assertMarketplaceActiveLocation('Filtres\nBulle FR · Dans un rayon de 10 km', ' Bulle ');
  });
});

test('assertMarketplaceActiveLocation skips legacy empty expected labels', () => {
  assert.doesNotThrow(() => {
    assertMarketplaceActiveLocation('anything', '');
  });
});

test('assertMarketplaceActiveLocation rejects mismatched active location labels', () => {
  let err;
  try {
    assertMarketplaceActiveLocation('Filtres\nPully · Dans un rayon de 10 km', 'Bulle');
  } catch (caught) {
    err = caught;
  }

  assert.equal(err?.code, 'FB_MARKETPLACE_LOCATION_MISMATCH');
  assert.match(err?.message || '', /Bulle/);
  assert.match(err?.message || '', /Pully/);
});

test('facebookMarketplaceAccessMessage explains how to refresh the saved login', () => {
  const message = facebookMarketplaceAccessMessage(
    'FB_MARKETPLACE_LOGIN_REQUIRED',
    'https://www.facebook.com/marketplace/sanfrancisco/search/?query=appartement'
  );

  assert.match(message, /FACEBOOK_MARKETPLACE_HEADLESS=false npm run facebook:login/);
  assert.match(message, /ouvre Marketplace/i);
  assert.doesNotMatch(message, /sanfrancisco/);
});

test('renderMarketplaceDebugHtml shows queries, card order, prices, and final actions', () => {
  const html = renderMarketplaceDebugHtml({
    version: 1,
    source: 'Facebook Marketplace',
    status: 'done',
    startedAt: '2026-05-01T10:00:00.000Z',
    finishedAt: '2026-05-01T10:00:05.000Z',
    searches: [
      {
        index: 1,
        requestedUrl: 'https://www.facebook.com/marketplace/search/?query=appartement%20Lausanne',
        pageUrl: 'https://www.facebook.com/marketplace/search/?query=appartement%20Lausanne',
        query: 'appartement Lausanne',
        areaLabel: 'Lausanne',
        status: 'done',
        rawCount: 2,
        acceptedCount: 1,
        rejectedCount: 1,
        cards: [
          {
            order: 1,
            accepted: true,
            finalAction: 'kept',
            raw: {
              title: 'Appartement lumineux',
              priceText: "CHF 1'450",
              locationText: 'Lausanne',
              url: 'https://www.facebook.com/marketplace/item/123/'
            },
            normalized: { totalChf: 1450, rooms: 2.5, surfaceM2: 65, dedupDisabled: true }
          },
          {
            order: 2,
            accepted: false,
            finalAction: 'rejected',
            rejectReason: 'missing price',
            raw: {
              title: 'Appartement sans prix',
              priceText: '',
              locationText: 'Lausanne',
              url: 'https://www.facebook.com/marketplace/item/456/'
            },
            normalized: null
          }
        ]
      }
    ],
    results: { rawCards: 2, acceptedCards: 1, rejectedCards: 1, keptListings: 1, duplicateListings: 0 }
  });

  assert.match(html, /appartement Lausanne/);
  assert.match(html, /#1/);
  assert.match(html, /CHF 1&#39;450/);
  assert.match(html, /kept/);
  assert.match(html, /missing price/);
});

test('renderMarketplaceDebugHtml includes marketplace region metadata', () => {
  const html = renderMarketplaceDebugHtml({
    version: 1,
    source: 'Facebook Marketplace',
    status: 'done',
    startedAt: '2026-05-01T10:00:00.000Z',
    finishedAt: '2026-05-01T10:00:05.000Z',
    searches: [
      {
        index: 1,
        requestedUrl: 'https://www.facebook.com/marketplace/lausanne/search/?query=appartement',
        pageUrl: 'https://www.facebook.com/marketplace/lausanne/search/?query=appartement',
        query: 'appartement',
        areaLabel: 'Lausanne region',
        regionLabel: 'Lausanne region',
        expectedLocationLabel: 'Lausanne',
        memberLabels: ['Lausanne', 'Pully'],
        radiusKm: 10,
        needsResolution: false,
        status: 'done',
        rawCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        cards: []
      }
    ],
    results: { rawCards: 0, acceptedCards: 0, rejectedCards: 0, keptListings: 0, duplicateListings: 0 }
  });

  assert.match(html, /Lausanne region/);
  assert.match(html, /Expected location/);
  assert.match(html, /Lausanne/);
  assert.match(html, /Members/);
  assert.match(html, /Pully/);
  assert.match(html, /10 km/);
});

test('dedupe keys ignore source-only Marketplace listings', () => {
  const item = {
    dedupDisabled: true,
    address: 'Lausanne',
    area: 'Lausanne',
    rooms: 2,
    totalChf: 1400
  };

  assert.equal(buildCrossSourceDedupKey(item), null);
  assert.equal(buildSurfacelessDedupKey(item), null);
});

test('scrapeFacebookMarketplaceListings rejects non-free providers loudly', async () => {
  await assert.rejects(
    () => scrapeFacebookMarketplaceListings({ facebookMarketplace: { provider: 'unknown' } }),
    /Only the free Playwright provider is supported/
  );

  await assert.rejects(
    () => scrapeFacebookMarketplaceListings({ facebookMarketplace: { provider: 'paid-api' } }),
    /Only the free Playwright provider is supported/
  );
});
