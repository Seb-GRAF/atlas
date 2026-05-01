export const SWITZERLAND_TILE_BOUNDS: [number, number, number, number] = [4.4, 44.8, 12.2, 48.9];

export const SWITZERLAND_MAX_BOUNDS: [[number, number], [number, number]] = [
  [SWITZERLAND_TILE_BOUNDS[0], SWITZERLAND_TILE_BOUNDS[1]],
  [SWITZERLAND_TILE_BOUNDS[2], SWITZERLAND_TILE_BOUNDS[3]]
];

export function scopeSourceToSwitzerland<T extends object>(
  source: T
): T & { bounds: [number, number, number, number] } {
  return {
    ...source,
    bounds: SWITZERLAND_TILE_BOUNDS
  };
}
