import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardState, Listing } from '../../api/schemas';
import { money } from '../../utils/format';
import { getImageUrls, listingSourceLabel, listingTitle } from '../../utils/listings';

type Workplace = NonNullable<DashboardState['map']>['workplace'];

const CLUSTER_RADIUS_PX = 52;

type ListingCluster = {
  items: Listing[];
  latLng: L.LatLng;
  layerPoint: L.Point;
  latSum: number;
  lonSum: number;
  containsSelected: boolean;
};

function isValidCoordinate(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function toValidLatLng(point: { lat: number; lon: number } | null | undefined): L.LatLngTuple | null {
  if (!point) return null;
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  return isValidCoordinate(lat, lon) ? [lat, lon] : null;
}

function rentAmount(value: number | null | undefined) {
  if (value == null) return null;
  return Math.round(value).toLocaleString('fr-CH');
}

function rentPinLabel(value: number | null | undefined) {
  const amount = rentAmount(value);
  return amount ? `${amount} CHF` : 'n/a';
}

function clusterPriceLabel(items: Listing[]) {
  const prices = items
    .map((item) => item.totalChf)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (!prices.length) return `${items.length} annonces`;

  const min = Math.round(Math.min(...prices));
  const max = Math.round(Math.max(...prices));
  if (min === max) return `${min.toLocaleString('fr-CH')} CHF`;
  return `${min.toLocaleString('fr-CH')}-${max.toLocaleString('fr-CH')} CHF`;
}

function markerHtml(item: Listing, selected: boolean) {
  const classes = [
    'atlas-map-pin',
    item.mapLocation?.precision === 'area' ? 'is-approximate' : '',
    selected ? 'is-selected' : ''
  ].filter(Boolean).join(' ');
  return `<div class="atlas-map-pin-frame is-listing-pin"><div class="${classes}">${rentPinLabel(item.totalChf)}</div></div>`;
}

function clusterHtml(cluster: ListingCluster) {
  const classes = ['atlas-map-cluster', cluster.containsSelected ? 'is-selected' : ''].filter(Boolean).join(' ');
  return [
    '<div class="atlas-map-pin-frame">',
    `<div class="${classes}">`,
    `<span class="atlas-map-cluster-count">${cluster.items.length}</span>`,
    `<span class="atlas-map-cluster-label">${clusterPriceLabel(cluster.items)}</span>`,
    '</div>',
    '</div>'
  ].join('');
}

function surfaceLabel(item: Listing) {
  const bits = [];
  if (item.rooms != null) bits.push(`${item.rooms} pces`);
  if (item.surfaceM2 != null) bits.push(`${item.surfaceM2} m2`);
  return bits.join(' · ');
}

function commuteLabel(item: Listing) {
  return item.transitText || item.driveText || item.distanceText || '';
}

function appendText(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, className: string, text: string) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  parent.appendChild(el);
  return el;
}

function popupContent(item: Listing, onOpenLightbox: (urls: string[], index: number) => void) {
  const urls = getImageUrls(item);
  const root = document.createElement('article');
  root.className = 'atlas-map-popup';

  const media = document.createElement(urls.length ? 'button' : 'div');
  media.className = urls.length ? 'atlas-map-popup-media' : 'atlas-map-popup-media is-empty';
  if (urls.length) {
    media.type = 'button';
    media.addEventListener('click', () => onOpenLightbox(urls, 0));
    const image = document.createElement('img');
    image.src = urls[0];
    image.alt = `Aperçu ${listingTitle(item)}`;
    image.loading = 'lazy';
    media.appendChild(image);
    if (urls.length > 1) appendText(media, 'span', 'atlas-map-popup-count', `+${urls.length - 1}`);
  } else {
    appendText(media, 'span', '', 'Sans photo');
  }
  root.appendChild(media);

  const body = document.createElement('div');
  body.className = 'atlas-map-popup-body';
  appendText(body, 'h3', 'atlas-map-popup-title', listingTitle(item));

  const meta = [money(item.totalChf), surfaceLabel(item)].filter(Boolean).join(' · ');
  if (meta) appendText(body, 'p', 'atlas-map-popup-meta is-strong', meta);

  const location = item.address || item.area || 'Lieu non renseigné';
  appendText(body, 'p', 'atlas-map-popup-meta', location);

  const commute = commuteLabel(item);
  if (commute) appendText(body, 'p', 'atlas-map-popup-meta', commute);

  const badges = document.createElement('div');
  badges.className = 'atlas-map-popup-badges';
  const source = listingSourceLabel(item);
  if (source) appendText(badges, 'span', '', source);
  if (item.mapLocation?.precision === 'area') appendText(badges, 'span', '', 'Position approx.');
  if (badges.childElementCount) body.appendChild(badges);

  if (item.url) {
    const link = document.createElement('a');
    link.className = 'atlas-map-popup-link';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Ouvrir l’annonce';
    body.appendChild(link);
  }

  root.appendChild(body);
  return root;
}

function tileAttribution() {
  return import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
}

function tileUrl() {
  return import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}

function clusterListings(map: L.Map, listings: Listing[], selectedListingId: string | number | null) {
  const clusters: ListingCluster[] = [];
  const selectedKey = selectedListingId == null ? null : String(selectedListingId);

  for (const item of listings) {
    const point = toValidLatLng(item.mapLocation);
    if (!point) continue;

    const latLng = L.latLng(point);
    const layerPoint = map.latLngToLayerPoint(latLng);
    let nearestCluster: ListingCluster | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const distance = layerPoint.distanceTo(cluster.layerPoint);
      if (distance <= CLUSTER_RADIUS_PX && distance < nearestDistance) {
        nearestCluster = cluster;
        nearestDistance = distance;
      }
    }

    if (!nearestCluster) {
      clusters.push({
        items: [item],
        latLng,
        layerPoint,
        latSum: latLng.lat,
        lonSum: latLng.lng,
        containsSelected: selectedKey === String(item.id)
      });
      continue;
    }

    nearestCluster.items.push(item);
    nearestCluster.latSum += latLng.lat;
    nearestCluster.lonSum += latLng.lng;
    nearestCluster.latLng = L.latLng(
      nearestCluster.latSum / nearestCluster.items.length,
      nearestCluster.lonSum / nearestCluster.items.length
    );
    nearestCluster.layerPoint = map.latLngToLayerPoint(nearestCluster.latLng);
    nearestCluster.containsSelected = nearestCluster.containsSelected || selectedKey === String(item.id);
  }

  return clusters;
}

function clusterPoints(items: Listing[]) {
  return items
    .map((item) => toValidLatLng(item.mapLocation))
    .filter((point): point is L.LatLngTuple => Boolean(point));
}

function fitClusterBounds(map: L.Map, points: L.LatLngTuple[]) {
  if (!points.length) return;
  map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 18 });
}

export function ApartmentMap({
  listings,
  workplace,
  selectedListingId,
  onSelectListing,
  onOpenLightbox,
  open
}: {
  listings: Listing[];
  workplace: Workplace;
  selectedListingId: string | number | null;
  onSelectListing: (id: string | number) => void;
  onOpenLightbox: (urls: string[], index: number) => void;
  open: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const listingMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterPointsRef = useRef<Map<string, L.LatLngTuple[]>>(new Map());
  const lastViewportKeyRef = useRef<string | null>(null);
  const [mapRenderKey, setMapRenderKey] = useState(0);

  const visibleListings = useMemo(
    () => listings.filter((item) => toValidLatLng(item.mapLocation)),
    [listings]
  );

  const viewportKey = useMemo(() => {
    const points = [];
    const workPoint = toValidLatLng(workplace);
    if (workPoint) points.push(`work:${workPoint[0].toFixed(5)},${workPoint[1].toFixed(5)}`);

    for (const item of listings) {
      const point = toValidLatLng(item.mapLocation);
      if (!point) continue;
      points.push(`${item.id}:${point[0].toFixed(5)},${point[1].toFixed(5)}`);
    }

    return points.join('|');
  }, [listings, workplace]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true
    });
    map.setView([46.52, 6.63], 11);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(tileUrl(), {
      attribution: tileAttribution(),
      maxZoom: 20
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const raf = window.requestAnimationFrame(() => map.invalidateSize());
    const timers = [60, 200, 500, 1000].map((delay) =>
      window.setTimeout(() => map.invalidateSize(), delay)
    );

    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const redrawClusters = () => setMapRenderKey((key) => key + 1);
    map.on('zoomend', redrawClusters);
    return () => {
      map.off('zoomend', redrawClusters);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    listingMarkersRef.current.clear();
    clusterMarkersRef.current.clear();
    clusterPointsRef.current.clear();
    const points: L.LatLngExpression[] = [];

    const workPoint = toValidLatLng(workplace);
    if (workPoint) {
      L.circleMarker(workPoint, {
        radius: 7,
        color: '#1f2937',
        fillColor: '#1f2937',
        fillOpacity: 1,
        weight: 3,
        opacity: 0.18
      })
        .bindTooltip('Bureau', { direction: 'right', offset: [8, 0] })
        .addTo(layer);
      points.push(workPoint);
    }

    for (const cluster of clusterListings(map, visibleListings, selectedListingId)) {
      if (cluster.items.length > 1) {
        const pointsInCluster = clusterPoints(cluster.items);
        const icon = L.divIcon({
          className: 'atlas-map-cluster-wrap',
          html: clusterHtml(cluster),
          iconSize: undefined,
          iconAnchor: [0, 0],
          popupAnchor: [0, -18]
        });
        const marker = L.marker(cluster.latLng, {
          icon,
          riseOnHover: true,
          zIndexOffset: cluster.containsSelected ? 220 : 0
        })
          .on('click', () => fitClusterBounds(map, pointsInCluster))
          .addTo(layer);

        for (const item of cluster.items) {
          clusterMarkersRef.current.set(String(item.id), marker);
          clusterPointsRef.current.set(String(item.id), pointsInCluster);
          const point = toValidLatLng(item.mapLocation);
          if (point) points.push(point);
        }
        continue;
      }

      const item = cluster.items[0];
      const point = toValidLatLng(item.mapLocation);
      if (!point) continue;
      const selected = String(item.id) === String(selectedListingId);
      const icon = L.divIcon({
        className: 'atlas-map-pin-wrap',
        html: markerHtml(item, selected),
        iconSize: undefined,
        iconAnchor: [0, 0],
        popupAnchor: [0, -18]
      });
      const marker = L.marker(point, { icon, riseOnHover: true, zIndexOffset: selected ? 240 : 0 })
        .on('click', () => onSelectListing(item.id))
        .bindPopup(popupContent(item, onOpenLightbox), {
          className: 'atlas-leaflet-popup',
          closeButton: true,
          maxWidth: 310,
          minWidth: 240,
          autoPanPadding: [24, 24]
        })
        .addTo(layer);
      listingMarkersRef.current.set(String(item.id), marker);
      points.push(point);
    }

    if (lastViewportKeyRef.current !== viewportKey) {
      lastViewportKeyRef.current = viewportKey;
      map.invalidateSize();
      if (points.length === 1) {
        map.setView(points[0], 13);
      } else if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [34, 34], maxZoom: 14 });
      } else {
        map.setView([46.52, 6.63], 11);
      }
    }
  }, [mapRenderKey, onOpenLightbox, onSelectListing, selectedListingId, viewportKey, visibleListings, workplace]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !open || selectedListingId == null) return;
    const marker = listingMarkersRef.current.get(String(selectedListingId));
    const clusterMarker = clusterMarkersRef.current.get(String(selectedListingId));
    if (!marker && !clusterMarker) return;

    if (!marker && clusterMarker) {
      const points = clusterPointsRef.current.get(String(selectedListingId));
      if (points?.length) fitClusterBounds(map, points);
      return;
    }

    const point = marker.getLatLng();
    if (!isValidCoordinate(point.lat, point.lng)) return;
    map.panTo(point, { animate: true, duration: 0.35 });
    marker.openPopup();
  }, [open, selectedListingId, visibleListings]);

  useEffect(() => {
    if (!open || !mapRef.current) return;
    const ids = [0, 120, 320].map((delay) => window.setTimeout(() => mapRef.current?.invalidateSize(), delay));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [open]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect?.width || !rect?.height) return;
      mapRef.current?.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <div ref={containerRef} className="atlas-map-canvas" aria-label="Carte des annonces" />;
}
