import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMarketplaceSearchUrl,
  clusterMarketplaceAreas,
  distanceKm,
  marketplaceRegionKey,
  normalizeMarketplaceAreaPoint
} from './facebook-marketplace-regions.mjs';

const AREAS = [
  { label: 'Saint-Sulpice VD', slug: 'saint-sulpice-vd', canton: 'vd', lat: 46.5105, lon: 6.5587 },
  { label: 'Pully', slug: 'pully', canton: 'vd', lat: 46.5100, lon: 6.6618 },
  { label: 'Lausanne', slug: 'lausanne', canton: 'vd', lat: 46.5197, lon: 6.6323 },
  { label: 'Morges', slug: 'morges', canton: 'vd', lat: 46.5088, lon: 6.4961 },
  { label: 'Cugy VD', slug: 'cugy-vd', canton: 'vd', lat: 46.5858, lon: 6.6390 },
  { label: 'Epalinges', slug: 'epalinges', canton: 'vd', lat: 46.5484, lon: 6.6682 },
  { label: 'Bulle', slug: 'bulle', canton: 'fr', lat: 46.6195, lon: 7.0567 },
  { label: 'Zurich', slug: 'zurich', canton: 'zh', lat: 47.3769, lon: 8.5417 }
];

test('distanceKm measures nearby and distant Swiss cities', () => {
  assert.ok(
    distanceKm({ lat: 46.5197, lon: 6.6323 }, { lat: 46.5100, lon: 6.6618 }) < 4,
    'Lausanne to Pully should be under 4 km'
  );
  assert.ok(
    distanceKm({ lat: 46.5197, lon: 6.6323 }, { lat: 47.3769, lon: 8.5417 }) > 170,
    'Lausanne to Zurich should be over 170 km'
  );
});

test('normalizeMarketplaceAreaPoint keeps valid points and rejects invalid ones', () => {
  assert.deepEqual(
    normalizeMarketplaceAreaPoint({ label: 'Lausanne', slug: 'lausanne', canton: 'vd', lat: '46.5197', lon: '6.6323' }),
    { label: 'Lausanne', slug: 'lausanne', canton: 'vd', lat: 46.5197, lon: 6.6323 }
  );

  assert.equal(normalizeMarketplaceAreaPoint({ slug: 'lausanne', canton: 'vd', lat: 46.5197, lon: 6.6323 }), null);
  assert.equal(normalizeMarketplaceAreaPoint({ label: 'Lausanne', slug: 'lausanne', canton: 'vd', lat: NaN, lon: 6.6323 }), null);
  assert.equal(normalizeMarketplaceAreaPoint({ label: 'Lausanne', slug: 'lausanne', canton: 'vd', lat: 46.5197 }), null);
});

test('clusterMarketplaceAreas groups nearby areas and preserves member order', () => {
  const regions = clusterMarketplaceAreas(AREAS, {
    clusterDistanceKm: 25,
    minRadiusKm: 10,
    maxRadiusKm: 30
  });

  assert.equal(regions.length, 3);
  assert.deepEqual(regions.map((region) => region.members.map((member) => member.label)), [
    ['Saint-Sulpice VD', 'Pully', 'Lausanne', 'Morges', 'Cugy VD', 'Epalinges'],
    ['Bulle'],
    ['Zurich']
  ]);
  assert.equal(regions[0].label, 'Lausanne area');
  assert.ok(regions[0].radiusKm >= 15);
  assert.equal(regions[1].radiusKm, 10);
  assert.equal(regions[2].radiusKm, 10);
});

test('clusterMarketplaceAreas splits chained areas that would exceed max radius coverage', () => {
  const chainedAreas = [
    { label: 'Chain A', lat: 46.5, lon: 6.0 },
    { label: 'Chain B', lat: 46.5, lon: 6.31 },
    { label: 'Chain C', lat: 46.5, lon: 6.62 },
    { label: 'Chain D', lat: 46.5, lon: 6.93 }
  ];

  const regions = clusterMarketplaceAreas(chainedAreas, {
    clusterDistanceKm: 25,
    minRadiusKm: 10,
    maxRadiusKm: 30
  });

  assert.equal(regions.length, 2);
  assert.deepEqual(regions.map((region) => region.members.map((member) => member.label)), [
    ['Chain A', 'Chain B', 'Chain C'],
    ['Chain D']
  ]);
  for (const region of regions) {
    for (const member of region.members) {
      assert.ok(distanceKm(region.center, member) <= region.radiusKm);
    }
  }
});

test('marketplaceRegionKey builds stable keys from label center and radius', () => {
  assert.equal(
    marketplaceRegionKey({ label: 'Lausanne area', center: { lat: 46.5197, lon: 6.6323 }, radiusKm: 20 }),
    'lausanne-area:46.51970,6.63230:20'
  );
});

test('buildMarketplaceSearchUrl builds Facebook Marketplace search URLs', () => {
  assert.equal(
    buildMarketplaceSearchUrl({
      facebookLocation: '108211865877609',
      query: 'louer appartement',
      minPrice: 1500,
      maxPrice: 2300,
      daysSinceListed: 2,
      sortBy: 'creation_time_descend',
      exact: false
    }),
    'https://www.facebook.com/marketplace/108211865877609/search/?query=louer+appartement&minPrice=1500&maxPrice=2300&daysSinceListed=2&sortBy=creation_time_descend&exact=false'
  );
});

test('buildMarketplaceSearchUrl builds global-location search URLs when explicit', () => {
  assert.equal(
    buildMarketplaceSearchUrl({
      useGlobalLocation: true,
      query: 'louer appartement',
      daysSinceListed: 2
    }),
    'https://www.facebook.com/marketplace/search/?query=louer+appartement&daysSinceListed=2'
  );
});

test('buildMarketplaceSearchUrl rejects missing Facebook locations unless global location is explicit', () => {
  assert.throws(
    () => buildMarketplaceSearchUrl({ query: 'louer appartement' }),
    /facebookLocation/
  );
});
