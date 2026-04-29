import { afterEach, describe, expect, it, vi } from 'vitest';
import { Listing } from '../api/schemas';
import { DEFAULT_STATUSES, filterAndSortListings, filterListingsForStage, publishedLabel, stageCounts } from './listings';

const listing = (overrides: Partial<Listing>): Listing => ({ id: overrides.id || String(Math.random()), ...overrides });

afterEach(() => {
  vi.useRealTimers();
});

describe('filterAndSortListings', () => {
  it('keeps Contacté in the default workflow order', () => {
    expect(DEFAULT_STATUSES).toEqual([
      'À trier',
      'À contacter',
      'Contacté',
      'Visite prévue',
      'Dossier à envoyer',
      'Dossier envoyé',
      'Relance à faire',
      'Accepté',
      'Écartée',
      'Refus régie'
    ]);
  });

  it('pushes removed and refused listings below active ones', () => {
    const active = listing({ id: 'active', publishedAt: '2026-01-01T00:00:00Z' });
    const removed = listing({ id: 'removed', isRemoved: true, publishedAt: '2026-04-01T00:00:00Z' });
    const refused = listing({ id: 'refused', status: 'Écartée', publishedAt: '2026-04-02T00:00:00Z' });

    expect(filterAndSortListings([removed, refused, active], '').map((item) => item.id)).toEqual([
      'active',
      'refused',
      'removed'
    ]);
  });

  it('sorts active listings newest first and keeps equal dates stable', () => {
    const firstSameDate = listing({ id: 'first-same-date', publishedAt: '2026-03-01T00:00:00Z' });
    const secondSameDate = listing({ id: 'second-same-date', publishedAt: '2026-03-01T00:00:00Z' });
    const newest = listing({ id: 'newest', publishedAt: '2026-04-01T00:00:00Z' });

    expect(filterAndSortListings([firstSameDate, newest, secondSameDate], '').map((item) => item.id)).toEqual([
      'newest',
      'first-same-date',
      'second-same-date'
    ]);
  });

  it('uses first seen as the freshness date when publication date is missing', () => {
    const discoveredNow = listing({ id: 'discovered-now', firstSeenAt: '2026-04-29T12:00:00Z' });
    const published = listing({ id: 'published', publishedAt: '2026-04-01T00:00:00Z' });

    expect(filterAndSortListings([discoveredNow, published], '').map((item) => item.id)).toEqual([
      'discovered-now',
      'published'
    ]);
  });

  it('sorts listings with invalid or missing dates last', () => {
    const dated = listing({ id: 'dated', publishedAt: '2026-04-01T00:00:00Z' });
    const invalid = listing({ id: 'invalid', publishedAt: 'not-a-date' });
    const missing = listing({ id: 'missing' });

    expect(filterAndSortListings([invalid, missing, dated], '').map((item) => item.id)).toEqual([
      'dated',
      'invalid',
      'missing'
    ]);
  });

  it('keeps pinned listings ahead of newer listings', () => {
    const pinned = listing({ id: 'pinned', pinned: true, publishedAt: '2026-02-01T00:00:00Z' });
    const newer = listing({ id: 'newer', publishedAt: '2026-04-01T00:00:00Z' });

    expect(filterAndSortListings([newer, pinned], '').map((item) => item.id)).toEqual(['pinned', 'newer']);
  });

  it('filters by listing text fields', () => {
    const match = listing({ id: 'match', address: 'Rue du Lac 4' });
    const miss = listing({ id: 'miss', title: 'Studio centre' });

    expect(filterAndSortListings([match, miss], 'lac').map((item) => item.id)).toEqual(['match']);
  });

  it('groups listings into triage, active and closed buckets', () => {
    const listings = [
      listing({ id: 'todo', status: 'À trier' }),
      listing({ id: 'fresh', status: 'À trier' }),
      listing({ id: 'saved', status: 'À contacter' }),
      listing({ id: 'contacted', status: 'Contacté' }),
      listing({ id: 'relance', status: 'Relance à faire' }),
      listing({ id: 'visit', status: 'Visite prévue' }),
      listing({ id: 'dossier-ready', status: 'Dossier à envoyer' }),
      listing({ id: 'dossier-sent', status: 'Dossier envoyé' }),
      listing({ id: 'accepted', status: 'Accepté' }),
      listing({ id: 'dismissed', status: 'Écartée' }),
      listing({ id: 'agency-refused', status: 'Refus régie' }),
      listing({ id: 'removed', isRemoved: true })
    ];

    const counts = stageCounts(listings);
    expect(counts.triage).toBe(2);
    expect(counts.active).toBe(6);
    expect(counts.closed).toBe(4);

    expect(filterListingsForStage(listings, 'triage', '').map((item) => item.id).sort()).toEqual(['fresh', 'todo']);
    expect(filterListingsForStage(listings, 'active', '').map((item) => item.id).sort()).toEqual([
      'contacted',
      'dossier-ready',
      'dossier-sent',
      'relance',
      'saved',
      'visit'
    ]);
    expect(filterListingsForStage(listings, 'closed', '').map((item) => item.id).sort()).toEqual([
      'accepted',
      'agency-refused',
      'dismissed',
      'removed'
    ]);
  });

  it('applies search inside the active stage', () => {
    const match = listing({ id: 'match', status: 'Contacté', address: 'Rue du Lac 4' });
    const stageMiss = listing({ id: 'stage-miss', status: 'À trier', address: 'Rue du Lac 8' });
    const textMiss = listing({ id: 'text-miss', status: 'Contacté', address: 'Rue Centrale' });

    expect(filterListingsForStage([match, stageMiss, textMiss], 'active', 'lac').map((item) => item.id)).toEqual(['match']);
  });
});

describe('publishedLabel', () => {
  it('formats published age in minutes, hours, and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));

    expect(publishedLabel(listing({ publishedAt: '2026-04-29T11:30:00Z' }))).toBe('30 min');
    expect(publishedLabel(listing({ publishedAt: '2026-04-29T09:00:00Z' }))).toBe('3 h');
    expect(publishedLabel(listing({ publishedAt: '2026-04-27T10:00:00Z' }))).toBe('2 j');
  });

  it('labels missing publication dates as first seen or unknown', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));

    expect(publishedLabel(listing({ firstSeenAt: '2026-04-29T11:10:00Z' }))).toBe('Vu 50 min');
    expect(publishedLabel(listing({}))).toBe('Inconnue');
  });
});
