type MarkerPoint = {
  lat: number;
  lon: number;
  precision?: 'address' | 'area';
};

type MarkerItem = {
  id: string | number;
  mapLocation?: MarkerPoint | null;
};

export type MarkerOffset = {
  x: number;
  y: number;
  groupSize: number;
};

function coordinateKey(point: MarkerPoint) {
  return `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`;
}

function duplicateOffset(index: number, groupSize: number, precision?: 'address' | 'area') {
  if (groupSize <= 1) return { x: 0, y: 0 };

  const baseRadius = precision === 'area' ? 24 : 16;
  const step = precision === 'area' ? 7 : 5;
  const radius = baseRadius + Math.sqrt(index) * step;
  const angle = (-90 + index * 137.508) * (Math.PI / 180);

  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius)
  };
}

export function computeMarkerOffsets(items: MarkerItem[]) {
  const groups = new Map<string, MarkerItem[]>();
  const offsets = new Map<string, MarkerOffset>();

  for (const item of items) {
    if (!item.mapLocation) continue;
    const key = coordinateKey(item.mapLocation);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    for (let index = 0; index < group.length; index += 1) {
      const item = group[index];
      const offset = duplicateOffset(index, group.length, item.mapLocation?.precision);
      offsets.set(String(item.id), { ...offset, groupSize: group.length });
    }
  }

  return offsets;
}
