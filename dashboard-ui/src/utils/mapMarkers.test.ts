import { describe, expect, it } from 'vitest';
import { computeMarkerOffsets } from './mapMarkers';

describe('computeMarkerOffsets', () => {
  it('keeps unique marker coordinates unshifted', () => {
    const offsets = computeMarkerOffsets([
      { id: 'one', mapLocation: { lat: 46.52, lon: 6.63, precision: 'area' } },
      { id: 'two', mapLocation: { lat: 46.53, lon: 6.64, precision: 'address' } }
    ]);

    expect(offsets.get('one')).toEqual({ x: 0, y: 0, groupSize: 1 });
    expect(offsets.get('two')).toEqual({ x: 0, y: 0, groupSize: 1 });
  });

  it('gives listings with identical coordinates distinct visual offsets', () => {
    const offsets = computeMarkerOffsets([
      { id: 'one', mapLocation: { lat: 46.52, lon: 6.63, precision: 'area' } },
      { id: 'two', mapLocation: { lat: 46.52, lon: 6.63, precision: 'area' } },
      { id: 'three', mapLocation: { lat: 46.52, lon: 6.63, precision: 'area' } },
      { id: 'other', mapLocation: { lat: 46.54, lon: 6.65, precision: 'area' } }
    ]);

    const duplicateOffsets = ['one', 'two', 'three'].map((id) => offsets.get(id));
    expect(new Set(duplicateOffsets.map((offset) => `${offset?.x},${offset?.y}`)).size).toBe(3);
    expect(duplicateOffsets.every((offset) => offset?.groupSize === 3)).toBe(true);
    expect(duplicateOffsets.every((offset) => offset && (offset.x !== 0 || offset.y !== 0))).toBe(true);
    expect(offsets.get('other')).toEqual({ x: 0, y: 0, groupSize: 1 });
  });
});
