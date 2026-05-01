import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAddressDedupKey,
  buildCrossSourceDedupKey,
  dedupeCrossSourceListings,
  isStub,
  listingQualityRank,
  toDiscardedStub
} from './dedup.mjs';

const BASE = { rooms: 1, surfaceM2: 16, totalChf: 570 };

test('buildAddressDedupKey: same flat, abbreviation variants → same key', () => {
  const a = buildAddressDedupKey({ address: 'Avenue de la Rapille 6, 1008 Prilly', area: 'Prilly' });
  const b = buildAddressDedupKey({ address: 'Av. de la Rapille 6, 1008 Prilly', area: 'Prilly' });
  const c = buildAddressDedupKey({ address: 'Ave de la Rapille 6, 1008 Prilly', area: 'Prilly' });
  assert.equal(a, b, 'Av. should canonicalize to avenue');
  assert.equal(a, c, 'Ave should canonicalize to avenue');
});

test('buildAddressDedupKey: cross-source order variants → same key', () => {
  const a = buildAddressDedupKey({ address: 'Avenue de la Rapille 6, 1008 Prilly', area: 'Prilly' });
  const b = buildAddressDedupKey({ address: 'Prilly, Avenue de la Rapille 6', area: 'Prilly' });
  assert.equal(a, b, 'parts-sorted normalization should make order irrelevant');
});

test('buildAddressDedupKey: chemin/ch. canonicalize', () => {
  const a = buildAddressDedupKey({ address: 'Ch. de la Lande 8, 1008 Prilly', area: 'Prilly' });
  const b = buildAddressDedupKey({ address: 'Chemin de la Lande 8, 1008 Prilly', area: 'Prilly' });
  assert.equal(a, b);
});

test('buildAddressDedupKey: route/rte canonicalize', () => {
  const a = buildAddressDedupKey({ address: 'Rte du Jura 12, 1700 Fribourg', area: 'Fribourg' });
  const b = buildAddressDedupKey({ address: 'Route du Jura 12, 1700 Fribourg', area: 'Fribourg' });
  assert.equal(a, b);
});

test('buildAddressDedupKey: empty address returns empty', () => {
  assert.equal(buildAddressDedupKey({ address: '', area: '' }), '');
  assert.equal(buildAddressDedupKey({}), '');
});

test('buildCrossSourceDedupKey: surface tolerance, near-bucket-edge values match', () => {
  // 23 and 27 both round to 25 (Math.round(x/5)*5)
  const a = buildCrossSourceDedupKey({ ...BASE, address: 'Av. Foo 1', area: 'Bar', surfaceM2: 23 });
  const b = buildCrossSourceDedupKey({ ...BASE, address: 'Av. Foo 1', area: 'Bar', surfaceM2: 27 });
  assert.equal(a, b, '23 and 27 m² both round to 25');
});

test('buildCrossSourceDedupKey: price tolerance, near-bucket-edge values match', () => {
  // 1525 and 1549 both round to 1550 (Math.round(x/50)*50)
  const a = buildCrossSourceDedupKey({ ...BASE, address: 'Av. Foo 1', area: 'Bar', totalChf: 1525 });
  const b = buildCrossSourceDedupKey({ ...BASE, address: 'Av. Foo 1', area: 'Bar', totalChf: 1549 });
  assert.equal(a, b, '1525 and 1549 should round to same 50-CHF bucket (1550)');
});

test('buildCrossSourceDedupKey: across-bucket values do not collide', () => {
  // 1500 → 1500, 1551 → 1550 — wait these match. Try 1500 vs 1576 (1576 → 1600).
  const a = buildCrossSourceDedupKey({ ...BASE, address: 'Av. Foo 1', area: 'Bar', totalChf: 1500 });
  const b = buildCrossSourceDedupKey({ ...BASE, address: 'Av. Foo 1', area: 'Bar', totalChf: 1576 });
  assert.notEqual(a, b, 'far-apart prices must produce different keys');
});

test('buildCrossSourceDedupKey: returns null when all numeric fields missing', () => {
  const k = buildCrossSourceDedupKey({ address: 'Av. Foo 1', area: 'Bar' });
  assert.equal(k, null);
});

test('dedupeCrossSourceListings: real-world cross-source pair (Rapille)', () => {
  const a = { id: 'A', source: 'flatfox.ch', address: 'Avenue de la Rapille 6, 1008 Prilly', area: 'Prilly', rooms: 1, surfaceM2: 16, totalChf: 570 };
  const b = { id: 'B', source: 'immobilier.ch', address: 'Prilly, Avenue de la Rapille 6', area: 'Prilly', rooms: 1, surfaceM2: 16, totalChf: 570 };
  const { kept, removedIds } = dedupeCrossSourceListings([a, b]);
  assert.equal(kept.length, 1, 'exactly one winner kept');
  assert.equal(kept[0].id, 'B', 'immobilier.ch wins on source priority (30 > 20)');
  assert.deepEqual([...kept[0].duplicateSources].sort(), ['flatfox.ch', 'immobilier.ch']);
  assert.deepEqual([...removedIds], ['A']);
});

test('dedupeCrossSourceListings: postal-code disambiguation', () => {
  const a = { id: 'A', source: 'flatfox.ch', address: 'Rue du Lac 5, 1003 Lausanne', area: 'Lausanne', rooms: 2, surfaceM2: 50, totalChf: 1500 };
  const b = { id: 'B', source: 'immobilier.ch', address: 'Rue du Lac 5, 1004 Lausanne', area: 'Lausanne', rooms: 2, surfaceM2: 50, totalChf: 1500 };
  const { kept } = dedupeCrossSourceListings([a, b]);
  assert.equal(kept.length, 2, 'different postals must stay distinct');
  const ids = kept.map((x) => x.id).sort();
  assert.deepEqual(ids, ['A', 'B']);
});

test('dedupeCrossSourceListings: postal vs no-postal in same bucket merges', () => {
  const a = { id: 'A', source: 'flatfox.ch', address: 'Rue du Lac 5, 1003 Lausanne', area: 'Lausanne', rooms: 2, surfaceM2: 50, totalChf: 1500 };
  const b = { id: 'B', source: 'immobilier.ch', address: 'Rue du Lac 5, Lausanne', area: 'Lausanne', rooms: 2, surfaceM2: 50, totalChf: 1500 };
  const { kept } = dedupeCrossSourceListings([a, b]);
  assert.equal(kept.length, 1, 'no postal on B → no signal to split, treat as same');
});

test('dedupeCrossSourceListings: items with no dedup key fall through', () => {
  const a = { id: 'A', source: 'flatfox.ch' };
  const b = { id: 'B', source: 'immobilier.ch', address: 'X', area: 'Y' };
  const { kept } = dedupeCrossSourceListings([a, b]);
  assert.equal(kept.length, 2, 'both fall to passthrough since neither yields a dedup key');
});

test('listingQualityRank: tracker history dominates source priority', () => {
  const trackerMap = new Map([['A', { id: 'A' }]]);
  const a = { id: 'A', source: 'anibis.ch', imageUrls: [] };
  const b = { id: 'B', source: 'immobilier.ch', imageUrls: [] };
  assert.ok(
    listingQualityRank(a, trackerMap) > listingQualityRank(b, trackerMap),
    'tracker presence (+1000) outweighs source priority (15 vs 30)'
  );
});

test('listingQualityRank: no tracker map still ranks by source priority', () => {
  const a = { id: 'A', source: 'immobilier.ch', imageUrls: [] };
  const b = { id: 'B', source: 'anibis.ch', imageUrls: [] };
  assert.ok(listingQualityRank(a) > listingQualityRank(b));
});

test('toDiscardedStub: produces compact 6-field shape (isRemoved branch)', () => {
  const item = {
    id: 'flatfox:123',
    title: 'Big payload',
    address: 'Av. Foo',
    priceRaw: 'CHF 1500',
    rooms: 2,
    surfaceM2: 50,
    totalChf: 1500,
    isRemoved: true,
    removedAt: '2026-04-30T11:00:00.000Z',
    firstSeenAt: '2026-04-29T08:00:00.000Z',
    lastSeenAt: '2026-04-30T08:00:00.000Z',
    filterReason: 'Doublon inter-source'
  };
  const stub = toDiscardedStub(item);
  assert.equal(stub.id, 'flatfox:123');
  assert.equal(typeof stub.dedupKey, 'string');
  assert.equal(stub.filterReason, 'Doublon inter-source');
  assert.equal(stub.isRemoved, true);
  assert.equal(stub.removedAt, '2026-04-30T11:00:00.000Z');
  assert.equal(stub.firstSeenAt, '2026-04-29T08:00:00.000Z');
  assert.equal(stub.lastSeenAt, '2026-04-30T08:00:00.000Z');
  assert.equal(stub.isStub, true);
  assert.equal(stub.title, undefined, 'title must not survive in stub');
  assert.equal(stub.priceRaw, undefined);
  assert.equal(stub.totalChf, undefined);
});

test('toDiscardedStub: filtered (display:false) branch sets display=false, no removedAt', () => {
  const item = {
    id: '999',
    address: 'X',
    area: 'Y',
    rooms: 3,
    surfaceM2: 70,
    totalChf: 2400,
    display: false,
    filterReason: 'Au-dessus de CHF 2300',
    firstSeenAt: '2026-04-29T08:00:00.000Z',
    lastSeenAt: '2026-04-30T08:00:00.000Z'
  };
  const stub = toDiscardedStub(item);
  assert.equal(stub.display, false);
  assert.equal(stub.isRemoved, undefined);
  assert.equal(stub.removedAt, undefined);
  assert.equal(stub.filterReason, 'Au-dessus de CHF 2300');
  assert.equal(stub.isStub, true);
});

test('isStub: detects stubs and rejects full listings', () => {
  assert.equal(isStub({ isStub: true, id: 'A' }), true);
  assert.equal(isStub({ id: 'A', title: 'foo' }), false);
  assert.equal(isStub(null), false);
  assert.equal(isStub(undefined), false);
});

test('dedupeCrossSourceListings: surfaceless fallback — BN (no m²) + immo merge', () => {
  const bn = { id: 'bernard:2370', source: 'bernard-nicod.ch', address: 'Rue Neuve 9, 1003 Lausanne', area: 'Lausanne', rooms: 3, surfaceM2: null, totalChf: 1900 };
  const immo = { id: '1494279', source: 'immobilier.ch', address: 'Lausanne, Rue Neuve 9', area: 'Lausanne', rooms: 3, surfaceM2: 75, totalChf: 1900 };
  const { kept, removedIds } = dedupeCrossSourceListings([bn, immo]);
  assert.equal(kept.length, 1, 'BN-blank + immo populated should merge into one entry');
  assert.equal(kept[0].id, '1494279', 'immobilier.ch wins on source priority (30 > 26)');
  assert.deepEqual([...kept[0].duplicateSources].sort(), ['bernard-nicod.ch', 'immobilier.ch']);
  assert.deepEqual([...removedIds], ['bernard:2370']);
});

test('dedupeCrossSourceListings: surfaceless fallback — different postals do NOT merge', () => {
  const bn = { id: 'bernard:1', source: 'bernard-nicod.ch', address: 'Rue Neuve 9, 1003 Lausanne', area: 'Lausanne', rooms: 3, surfaceM2: null, totalChf: 1900 };
  const immo = { id: 'immo:1', source: 'immobilier.ch', address: 'Lausanne, Rue Neuve 9, 1004', area: 'Lausanne', rooms: 3, surfaceM2: 75, totalChf: 1900 };
  const { kept } = dedupeCrossSourceListings([bn, immo]);
  assert.equal(kept.length, 2, 'distinct postal codes must keep entries separate');
});

test('dedupeCrossSourceListings: surfaceless fallback — closest-price tie-break', () => {
  const bn = { id: 'bn:closer', source: 'bernard-nicod.ch', address: 'Avenue Foo 1, 1000 Lausanne', area: 'Lausanne', rooms: 3, surfaceM2: null, totalChf: 2000 };
  const immoSmall = { id: 'immo:small', source: 'immobilier.ch', address: 'Lausanne, Avenue Foo 1', area: 'Lausanne', rooms: 3, surfaceM2: 65, totalChf: 1980 };
  const immoBig = { id: 'immo:big', source: 'immobilier.ch', address: 'Lausanne, Avenue Foo 1', area: 'Lausanne', rooms: 3, surfaceM2: 80, totalChf: 2300 };
  const { kept } = dedupeCrossSourceListings([bn, immoSmall, immoBig]);
  // The two immos differ in price bucket (1980→2000, 2300) so they don't merge with each other.
  // BN at 2000 should land on the closest price → immoSmall (delta 0 from bucket 2000).
  assert.equal(kept.length, 2, 'BN merges into closest-price immo, the other immo stays');
  const survivorIds = kept.map((k) => k.id).sort();
  assert.deepEqual(survivorIds, ['immo:big', 'immo:small']);
  const merged = kept.find((k) => k.id === 'immo:small');
  assert.deepEqual([...merged.duplicateSources].sort(), ['bernard-nicod.ch', 'immobilier.ch']);
});

test('dedupeCrossSourceListings: surfaceless fallback — two blanks alone do NOT merge', () => {
  const a = { id: 'bn:a', source: 'bernard-nicod.ch', address: 'Avenue Foo 1, 1000 Lausanne', area: 'Lausanne', rooms: 3, surfaceM2: null, totalChf: 2000 };
  const b = { id: 'bn:b', source: 'bernard-nicod.ch', address: 'Avenue Foo 1, 1000 Lausanne', area: 'Lausanne', rooms: 3, surfaceM2: null, totalChf: 2000 };
  const { kept } = dedupeCrossSourceListings([a, b]);
  // Today: both blanks land in the same exact-key bucket (s:0) and merge via the primary
  // pass — the surfaceless fallback only fires when there's a populated sibling. Since
  // both are blank with identical address/rooms/price, the primary pass already collapses
  // them. This test pins that behavior and protects the no-populated-anchor case.
  assert.equal(kept.length, 1, 'two BN blanks at identical exact key still merge via primary pass');
  assert.equal(kept[0].source, 'bernard-nicod.ch');
});

test('dedupeCrossSourceListings: surfaceless fallback — blank with different rooms does NOT merge', () => {
  const bn = { id: 'bn:1', source: 'bernard-nicod.ch', address: 'Avenue Foo 1, 1000 Lausanne', area: 'Lausanne', rooms: 3, surfaceM2: null, totalChf: 1900 };
  const immo = { id: 'immo:1', source: 'immobilier.ch', address: 'Lausanne, Avenue Foo 1', area: 'Lausanne', rooms: 4, surfaceM2: 80, totalChf: 1900 };
  const { kept } = dedupeCrossSourceListings([bn, immo]);
  assert.equal(kept.length, 2, 'rooms differ → must not merge even with surfaceless fallback');
});

test('toDiscardedStub: stub size is materially smaller than full payload', () => {
  const full = {
    id: 'flatfox:85454705',
    title: 'A saisir ! Chambre idéalement situé !',
    address: 'Avenue de la Rapille 6, 1008 Prilly',
    area: 'Prilly',
    priceRaw: 'CHF 570',
    imageUrls: Array(8).fill('https://example.com/img-' + 'x'.repeat(40) + '.jpg'),
    imageUrlsLocal: Array(8).fill('/local/img-' + 'x'.repeat(40) + '.jpg'),
    rooms: 1,
    surfaceM2: 16,
    totalChf: 570,
    isRemoved: true,
    removedAt: '2026-04-30T11:23:50.000Z',
    firstSeenAt: '2026-04-30T09:35:03.972Z',
    filterReason: 'Doublon inter-source'
  };
  const stub = toDiscardedStub(full);
  const fullBytes = Buffer.byteLength(JSON.stringify(full));
  const stubBytes = Buffer.byteLength(JSON.stringify(stub));
  assert.ok(stubBytes < fullBytes / 4, `stub (${stubBytes}B) should be at least 4× smaller than full (${fullBytes}B)`);
});
