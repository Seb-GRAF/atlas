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

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value);
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

function previewTitle(item: Listing) {
  const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
  return rawTitle || listingTitle(item);
}

function markerHtml(item: Listing) {
  const classes = [
    'atlas-map-pin-shell',
    item.mapLocation?.precision === 'area' ? 'is-approximate' : ''
  ].filter(Boolean).join(' ');
  const title = previewTitle(item);
  const urls = getImageUrls(item);
  const media = urls.length
    ? [
        `<button class="atlas-map-popup-media" type="button" tabindex="-1" data-map-focusable data-map-action="lightbox" aria-label="${escapeAttribute(`Ouvrir les photos de ${title}`)}">`,
        `<img src="${escapeAttribute(urls[0])}" alt="${escapeAttribute(`Aperçu ${title}`)}" loading="lazy" />`,
        urls.length > 1 ? `<span class="atlas-map-popup-count">+${urls.length - 1}</span>` : '',
        '</button>'
      ].join('')
    : '<div class="atlas-map-popup-media is-empty"><span>Sans photo</span></div>';
  const meta = [money(item.totalChf), surfaceLabel(item)].filter(Boolean).join(' · ');
  const location = item.address || item.area || 'Lieu non renseigné';
  const commute = commuteLabel(item);
  const source = listingSourceLabel(item);
  const badges = [
    source ? `<span>${escapeHtml(source)}</span>` : '',
    item.mapLocation?.precision === 'area' ? '<span>Position approx.</span>' : ''
  ].filter(Boolean).join('');
  const link = item.url
    ? `<a class="atlas-map-popup-link" href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer" tabindex="-1" data-map-focusable>Ouvrir l’annonce</a>`
    : '';

  return [
    '<div class="atlas-map-pin-frame is-listing-pin">',
    `<article class="${classes}" data-listing-id="${escapeAttribute(item.id)}">`,
    `<div class="atlas-map-pin-price">${escapeHtml(rentPinLabel(item.totalChf))}</div>`,
    '<div class="atlas-map-pin-preview atlas-map-popup" data-map-preview aria-hidden="true" inert>',
    media,
    '<div class="atlas-map-popup-body">',
    `<h3 class="atlas-map-popup-title">${escapeHtml(title)}</h3>`,
    meta ? `<p class="atlas-map-popup-meta is-strong">${escapeHtml(meta)}</p>` : '',
    `<p class="atlas-map-popup-meta">${escapeHtml(location)}</p>`,
    commute ? `<p class="atlas-map-popup-meta">${escapeHtml(commute)}</p>` : '',
    badges ? `<div class="atlas-map-popup-badges">${badges}</div>` : '',
    link,
    '</div>',
    '</div>',
    '</article>',
    '</div>'
  ].join('');
}

function clusterHtml(cluster: ListingCluster) {
  return [
    '<div class="atlas-map-pin-frame">',
    '<div class="atlas-map-cluster">',
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

function tileAttribution() {
  return import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
}

function tileUrl() {
  return import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}

function clusterListings(map: L.Map, listings: Listing[]) {
  const clusters: ListingCluster[] = [];

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
        lonSum: latLng.lng
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

function setMarkerShellSelected(marker: L.Marker, selected: boolean) {
  const shell = marker.getElement()?.querySelector<HTMLElement>('.atlas-map-pin-shell');
  if (!shell) return;

  shell.classList.toggle('is-selected', selected);
  shell.classList.toggle('is-expanded', selected);
  shell.setAttribute('aria-expanded', selected ? 'true' : 'false');
  const preview = shell.querySelector<HTMLElement>('[data-map-preview]');
  if (preview) {
    preview.setAttribute('aria-hidden', selected ? 'false' : 'true');
    preview.toggleAttribute('inert', !selected);
  }
  shell.querySelectorAll<HTMLElement>('[data-map-focusable]').forEach((element) => {
    element.tabIndex = selected ? 0 : -1;
  });
  marker.setZIndexOffset(selected ? 240 : 0);
}

export function ApartmentMap({
  listings,
  workplace,
  selectedListingId,
  onSelectListing,
  onClearSelection,
  onOpenLightbox,
  open
}: {
  listings: Listing[];
  workplace: Workplace;
  selectedListingId: string | number | null;
  onSelectListing: (id: string | number) => void;
  onClearSelection: () => void;
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
  const callbacksRef = useRef({ onClearSelection, onOpenLightbox, onSelectListing });
  const [mapRenderKey, setMapRenderKey] = useState(0);

  useEffect(() => {
    callbacksRef.current = { onClearSelection, onOpenLightbox, onSelectListing };
  }, [onClearSelection, onOpenLightbox, onSelectListing]);

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

  const markerDataKey = useMemo(() => {
    const parts = [viewportKey];
    for (const item of visibleListings) {
      const urls = getImageUrls(item).join(',');
      parts.push([
        item.id,
        item.title || '',
        item.totalChf ?? '',
        item.rooms ?? '',
        item.surfaceM2 ?? '',
        item.address || '',
        item.area || '',
        item.transitText || '',
        item.driveText || '',
        item.distanceText || '',
        item.source || '',
        item.url || '',
        item.mapLocation?.precision || '',
        urls
      ].join('~'));
    }
    return parts.join('|');
  }, [viewportKey, visibleListings]);

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
    if (!map) return;

    const clearSelection = (event: L.LeafletMouseEvent) => {
      const target = event.originalEvent?.target instanceof Element ? event.originalEvent.target : null;
      if (target?.closest('.atlas-map-pin-shell, .atlas-map-cluster')) return;
      callbacksRef.current.onClearSelection();
    };

    map.on('click', clearSelection);
    return () => {
      map.off('click', clearSelection);
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

    for (const cluster of clusterListings(map, visibleListings)) {
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
          zIndexOffset: 0
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
      const icon = L.divIcon({
        className: 'atlas-map-pin-wrap',
        html: markerHtml(item),
        iconSize: undefined,
        iconAnchor: [0, 0],
        popupAnchor: [0, -18]
      });
      const marker = L.marker(point, { icon, riseOnHover: true, zIndexOffset: 0 })
        .on('click', () => callbacksRef.current.onSelectListing(item.id))
        .addTo(layer);

      marker.getElement()?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest('[data-map-action="lightbox"]')) return;
        L.DomEvent.stop(event);
        callbacksRef.current.onOpenLightbox(getImageUrls(item), 0);
      }, { capture: true });

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
  }, [mapRenderKey, markerDataKey, viewportKey]);

  useEffect(() => {
    const selectedKey = selectedListingId == null ? null : String(selectedListingId);
    for (const [id, marker] of listingMarkersRef.current) {
      setMarkerShellSelected(marker, selectedKey === id);
    }
  }, [mapRenderKey, markerDataKey, selectedListingId]);

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
    map.panInside(point, {
      paddingTopLeft: [160, 340],
      paddingBottomRight: [160, 32],
      animate: true,
      duration: 0.35
    });
  }, [mapRenderKey, markerDataKey, open, selectedListingId]);

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
