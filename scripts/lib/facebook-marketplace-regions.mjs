const FACEBOOK_BASE_URL = 'https://www.facebook.com';
const EARTH_RADIUS_KM = 6371.0088;

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function roundRadiusKm(value) {
  return Math.ceil(value / 5) * 5;
}

export function normalizeMarketplaceAreaPoint(area = {}) {
  const label = String(area?.label || '').trim();
  const slug = String(area?.slug || '').trim();
  const canton = String(area?.canton || '').trim();
  const lat = finiteNumber(area?.lat);
  const lon = finiteNumber(area?.lon);

  if (!label || lat == null || lon == null) return null;

  return { label, slug, canton, lat, lon };
}

export function distanceKm(a = {}, b = {}) {
  const latA = finiteNumber(a.lat);
  const lonA = finiteNumber(a.lon);
  const latB = finiteNumber(b.lat);
  const lonB = finiteNumber(b.lon);
  if (latA == null || lonA == null || latB == null || lonB == null) return Infinity;

  const toRad = Math.PI / 180;
  const dLat = (latB - latA) * toRad;
  const dLon = (lonB - lonA) * toRad;
  const rLatA = latA * toRad;
  const rLatB = latB * toRad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rLatA) * Math.cos(rLatB) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function centroid(points) {
  const totals = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lon: acc.lon + point.lon }),
    { lat: 0, lon: 0 }
  );
  return {
    lat: totals.lat / points.length,
    lon: totals.lon / points.length
  };
}

function centerMember(points) {
  const clusterCentroid = centroid(points);
  return points.reduce((best, point) => {
    const pointDistance = distanceKm(point, clusterCentroid);
    const bestDistance = distanceKm(best, clusterCentroid);
    return pointDistance < bestDistance ? point : best;
  }, points[0]);
}

function clusterCoverage(points) {
  const center = centerMember(points);
  const maxMemberDistanceKm = Math.max(...points.map((member) => distanceKm(center, member)));
  return {
    center,
    maxMemberDistanceKm,
    radiusKm: roundRadiusKm(maxMemberDistanceKm)
  };
}

export function clusterMarketplaceAreas(areas = [], options = {}) {
  const points = areas.map(normalizeMarketplaceAreaPoint).filter(Boolean);
  const clusterDistanceKm = finiteNumber(options.clusterDistanceKm) ?? 25;
  const minRadiusKm = finiteNumber(options.minRadiusKm) ?? 10;
  const maxRadiusKm = Math.max(minRadiusKm, finiteNumber(options.maxRadiusKm) ?? 30);
  const visited = new Set();
  const regions = [];

  for (let i = 0; i < points.length; i += 1) {
    if (visited.has(i)) continue;

    const clusterIndexes = [i];
    visited.add(i);

    let added = true;
    while (added) {
      added = false;
      for (let candidate = 0; candidate < points.length; candidate += 1) {
        if (visited.has(candidate)) continue;
        const isNearCluster = clusterIndexes.some((index) => (
          distanceKm(points[index], points[candidate]) <= clusterDistanceKm
        ));
        if (!isNearCluster) continue;

        const proposedMembers = [...clusterIndexes, candidate].map((index) => points[index]);
        if (clusterCoverage(proposedMembers).radiusKm > maxRadiusKm) continue;

        visited.add(candidate);
        clusterIndexes.push(candidate);
        added = true;
      }
    }

    clusterIndexes.sort((a, b) => a - b);
    const members = clusterIndexes.map((index) => points[index]);
    const coverage = clusterCoverage(members);
    const center = coverage.center;
    const radiusKm = clamp(coverage.radiusKm, minRadiusKm, maxRadiusKm);
    const label = members.length > 1 ? `${center.label} area` : center.label;

    regions.push({
      label,
      center: { lat: center.lat, lon: center.lon },
      radiusKm,
      members
    });
  }

  return regions;
}

export function marketplaceRegionKey(region = {}) {
  const label = slugify(region.label || '');
  const lat = finiteNumber(region.center?.lat);
  const lon = finiteNumber(region.center?.lon);
  const radiusKm = finiteNumber(region.radiusKm);

  if (!label || lat == null || lon == null || radiusKm == null) {
    throw new Error('Cannot build Facebook Marketplace region key without label, center, and radius');
  }

  return `${label}:${lat.toFixed(5)},${lon.toFixed(5)}:${Math.round(radiusKm)}`;
}

export function buildMarketplaceSearchUrl(options = {}) {
  const facebookLocation = String(options.facebookLocation || '').trim();
  const useGlobalLocation = options.useGlobalLocation === true;
  if (!facebookLocation && !useGlobalLocation) {
    throw new Error('Cannot build Facebook Marketplace search URL without facebookLocation');
  }

  const path = facebookLocation
    ? `/marketplace/${encodeURIComponent(facebookLocation)}/search/`
    : '/marketplace/search/';
  const url = new URL(path, FACEBOOK_BASE_URL);
  const params = [
    ['query', options.query],
    ['minPrice', options.minPrice],
    ['maxPrice', options.maxPrice],
    ['daysSinceListed', options.daysSinceListed],
    ['sortBy', options.sortBy],
    ['exact', options.exact]
  ];

  for (const [key, value] of params) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}
