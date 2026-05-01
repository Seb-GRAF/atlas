import { describe, expect, it } from 'vitest';
import type { AtlasListing } from '../types';
import { filterListingsByQuery } from './listingSearch';

const baseListing: AtlasListing = {
  id: 'base',
  title: '',
  area: '',
  address: '',
  rooms: null,
  surfaceM2: null,
  totalChf: null,
  source: 'immobilier.ch',
  url: null,
  pinned: false,
  isNew: false,
  isRemoved: false,
  status: 'À trier',
  notes: '',
  publishedLabel: '',
  publishedShort: '',
  publishedTs: null,
  transitText: null,
  driveText: null,
  distanceText: null,
  driveMinutes: null,
  transitMinutes: null,
  driveRouteStatus: null,
  transitRouteStatus: null,
  transitRouteLabel: null,
  transitRouteComputedAt: null,
  transitRoute: null,
  transitRouteOverlay: null,
  commuteWarnings: [],
  commutePending: false,
  lat: null,
  lon: null,
  locationPrecision: null,
  images: []
};

function listing(patch: Partial<AtlasListing>): AtlasListing {
  return { ...baseListing, ...patch };
}

describe('filterListingsByQuery', () => {
  it('returns all listings for a blank query', () => {
    const listings = [
      listing({ id: 'lausanne', area: 'Lausanne' }),
      listing({ id: 'vevey', area: 'Vevey' })
    ];

    expect(filterListingsByQuery(listings, '   ')).toEqual(listings);
  });

  it('matches listing text across searchable fields', () => {
    const listings = [
      listing({
        id: 'match',
        title: 'Appartement lumineux',
        area: 'Lausanne',
        address: 'Rue Centrale 8',
        totalChf: 2100,
        notes: 'Appeler lundi'
      }),
      listing({
        id: 'miss',
        title: 'Studio calme',
        area: 'Vevey',
        address: 'Rue du Lac 2',
        totalChf: 1450
      })
    ];

    expect(filterListingsByQuery(listings, 'lausanne 2100 lundi').map((l) => l.id)).toEqual([
      'match'
    ]);
  });
});
