import { describe, expect, it } from 'vitest';
import { adaptListing } from './adapt';
import type { Listing } from '../../api/schemas';

describe('adaptListing commute overlays', () => {
  it('preserves a precomputed transit route overlay for instant map display', () => {
    const overlay = {
      listingId: 'listing-1',
      bounds: [[6.5, 46.4], [6.7, 46.6]],
      failedCount: 0,
      legs: [
        {
          kind: 'transit',
          mode: 'IC',
          label: 'IC1',
          color: '#d64545',
          coords: [[6.5, 46.4], [6.7, 46.6]],
          failed: false,
          fromName: 'Lausanne',
          toName: 'Morges',
          minutes: 12
        }
      ]
    };

    const listing = adaptListing({
      id: 'listing-1',
      address: 'Rue Centrale 1',
      area: 'Lausanne',
      transitRouteOverlay: overlay
    } as Listing);

    expect(listing.transitRouteOverlay).toEqual(overlay);
  });
});
