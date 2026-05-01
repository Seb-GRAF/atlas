import { describe, expect, it } from 'vitest';
import * as mapBounds from './mapBounds';
import {
  SWITZERLAND_MAX_BOUNDS,
  SWITZERLAND_TILE_BOUNDS,
  scopeSourceToSwitzerland
} from './mapBounds';

describe('map Switzerland bounds', () => {
  it('uses a padded Switzerland bounding box for tile sources and map panning', () => {
    expect(SWITZERLAND_TILE_BOUNDS).toEqual([4.4, 44.8, 12.2, 48.9]);
    expect(SWITZERLAND_MAX_BOUNDS).toEqual([
      [4.4, 44.8],
      [12.2, 48.9]
    ]);
  });

  it('adds Switzerland bounds without mutating the source definition', () => {
    const source = {
      type: 'vector',
      url: 'pmtiles://example.test/world.pmtiles',
      attribution: 'OSM'
    } as const;

    const scoped = scopeSourceToSwitzerland(source);

    expect(scoped).toEqual({
      ...source,
      bounds: SWITZERLAND_TILE_BOUNDS
    });
    expect(source).not.toHaveProperty('bounds');
  });

  it('does not ship an outside-Switzerland dark mask', () => {
    expect(mapBounds).not.toHaveProperty('SWITZERLAND_MASK_FEATURE_COLLECTION');
  });
});
