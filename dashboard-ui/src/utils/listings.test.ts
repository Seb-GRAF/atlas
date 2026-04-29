import { describe, expect, it } from 'vitest';
import { Listing } from '../api/schemas';
import { filterAndSortListings } from './listings';

const listing = (overrides: Partial<Listing>): Listing => ({ id: overrides.id || String(Math.random()), ...overrides });

describe('filterAndSortListings', () => {
  it('pushes removed and refused listings below active ones', () => {
    const active = listing({ id: 'active', publishedAt: '2026-01-01T00:00:00Z' });
    const removed = listing({ id: 'removed', isRemoved: true, publishedAt: '2026-04-01T00:00:00Z' });
    const refused = listing({ id: 'refused', status: 'Refusé', publishedAt: '2026-04-02T00:00:00Z' });

    expect(filterAndSortListings([removed, refused, active], '').map((item) => item.id)).toEqual([
      'active',
      'refused',
      'removed'
    ]);
  });

  it('sorts active listings newest first, then score', () => {
    const lowScore = listing({ id: 'low-score', publishedAt: '2026-03-01T00:00:00Z', score: 20 });
    const highScore = listing({ id: 'high-score', publishedAt: '2026-03-01T00:00:00Z', score: 90 });
    const newest = listing({ id: 'newest', publishedAt: '2026-04-01T00:00:00Z', score: 10 });

    expect(filterAndSortListings([lowScore, newest, highScore], '').map((item) => item.id)).toEqual([
      'newest',
      'high-score',
      'low-score'
    ]);
  });

  it('filters by listing text fields', () => {
    const match = listing({ id: 'match', address: 'Rue du Lac 4' });
    const miss = listing({ id: 'miss', title: 'Studio centre' });

    expect(filterAndSortListings([match, miss], 'lac').map((item) => item.id)).toEqual(['match']);
  });
});
