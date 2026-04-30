import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import maplibregl, { LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { formatCHF } from './Mono';

export type AtlasMapPin = {
  id: string;
  lat: number;
  lon: number;
  totalChf: number;
};

type AtlasMapProps = {
  pins: AtlasMapPin[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  showWorkplace?: boolean;
  workplaceLabel?: string;
  workplace?: { lat: number; lon: number };
  initialBounds?: LngLatBoundsLike;
  initialCenter?: { lat: number; lon: number; zoom?: number };
  mode?: 'warm' | 'cool';
  style?: CSSProperties;
  className?: string;
};

const DEMO_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

const WARM_CANVAS_FILTER =
  'sepia(0.18) saturate(0.92) hue-rotate(-6deg) brightness(1.02) contrast(0.98)';
const COOL_CANVAS_FILTER = 'saturate(0.9) brightness(1.01)';

const DEFAULT_CENTER = { lat: 46.47, lon: 6.84, zoom: 11 };

function PinButton({
  totalChf,
  selected,
  onClick
}: {
  totalChf: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={{
        padding: '5px 10px',
        borderRadius: 999,
        border: 0,
        background: selected ? 'var(--atlas-ink)' : '#fff',
        color: selected ? '#fff' : 'var(--atlas-ink)',
        fontFamily: 'var(--atlas-mono)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transform: selected ? 'scale(1.06)' : 'scale(1)',
        boxShadow: selected
          ? '0 8px 24px rgba(22,20,15,.28), 0 0 0 2px #fff'
          : '0 4px 14px rgba(22,20,15,.16), 0 0 0 1px rgba(22,20,15,.06)',
        transition:
          'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease',
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {formatCHF(totalChf)}
    </button>
  );
}

function WorkplacePill({ label }: { label: string }) {
  return (
    <div
      style={{
        background: 'var(--atlas-ink)',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        boxShadow: '0 6px 16px rgba(0,0,0,.18)',
        fontFamily: 'var(--atlas-sans)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </div>
  );
}

type ManagedMarker = {
  marker: Marker;
  el: HTMLDivElement;
  pin: AtlasMapPin;
};

export function AtlasMap({
  pins,
  selectedId = null,
  onSelect,
  showWorkplace = true,
  workplaceLabel = 'Travail · EPFL',
  workplace,
  initialBounds,
  initialCenter,
  mode = 'warm',
  style,
  className
}: AtlasMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, ManagedMarker>>(new Map());
  const workplaceMarkerRef = useRef<{ marker: Marker; el: HTMLDivElement } | null>(null);
  const [, force] = useState(0);

  const center = initialCenter ?? DEFAULT_CENTER;

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEMO_STYLE_URL,
      center: [center.lon, center.lat],
      zoom: center.zoom ?? DEFAULT_CENTER.zoom,
      attributionControl: { compact: true },
      cooperativeGestures: false
    });

    if (initialBounds) {
      map.fitBounds(initialBounds, { padding: 64, animate: false });
    }

    // Disable scroll-wheel zoom without ctrl/cmd modifier on desktop — page should
    // scroll first; modifier-zoom is a deliberate gesture.
    map.scrollZoom.disable();
    const wheelHandler = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        // Re-enable for this gesture only.
        map.scrollZoom.enable();
        // Manually zoom by passing the event back through.
        const delta = event.deltaY * -0.002;
        map.zoomTo(map.getZoom() + delta, { duration: 80 });
        // Disable again on next tick so a non-modifier wheel scrolls the page.
        window.setTimeout(() => map.scrollZoom.disable(), 0);
      }
    };
    containerRef.current.addEventListener('wheel', wheelHandler, { passive: false });

    map.on('click', (event) => {
      // If the click target is a marker, the marker handler stops propagation. Anything
      // reaching the map = background click.
      const target = event.originalEvent.target as HTMLElement | null;
      if (target && target.closest('.atlas-map-marker')) return;
      onSelect?.(null);
    });

    map.on('load', () => force((n) => n + 1));

    mapRef.current = map;
    return () => {
      containerRef.current?.removeEventListener('wheel', wheelHandler);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      workplaceMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync listing pin markers with `pins`. We portal React content into each marker's
  // DOM element so click/state transitions render through React.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = new Map<string, ManagedMarker>();
    const seen = new Set<string>();

    for (const pin of pins) {
      seen.add(pin.id);
      const existing = markersRef.current.get(pin.id);
      if (existing) {
        existing.marker.setLngLat([pin.lon, pin.lat]);
        existing.pin = pin;
        next.set(pin.id, existing);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'atlas-map-marker';
      el.style.cursor = 'pointer';
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pin.lon, pin.lat])
        .addTo(map);
      next.set(pin.id, { marker, el, pin });
    }

    // Remove markers no longer in pins.
    for (const [id, managed] of markersRef.current) {
      if (!seen.has(id)) managed.marker.remove();
    }
    markersRef.current = next;
    force((n) => n + 1);
  }, [pins]);

  // Workplace marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wp = workplace;
    if (!showWorkplace || !wp) {
      workplaceMarkerRef.current?.marker.remove();
      workplaceMarkerRef.current = null;
      force((n) => n + 1);
      return;
    }
    if (workplaceMarkerRef.current) {
      workplaceMarkerRef.current.marker.setLngLat([wp.lon, wp.lat]);
    } else {
      const el = document.createElement('div');
      el.style.pointerEvents = 'none';
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([wp.lon, wp.lat])
        .addTo(map);
      workplaceMarkerRef.current = { marker, el };
      force((n) => n + 1);
    }
  }, [showWorkplace, workplace?.lat, workplace?.lon]);

  const portals: ReactNode[] = useMemo(() => {
    const items: ReactNode[] = [];
    for (const [id, managed] of markersRef.current) {
      items.push(
        createPortal(
          <PinButton
            totalChf={managed.pin.totalChf}
            selected={selectedId === id}
            onClick={() => onSelect?.(id)}
          />,
          managed.el,
          id
        )
      );
    }
    if (workplaceMarkerRef.current) {
      items.push(
        createPortal(
          <WorkplacePill label={workplaceLabel} />,
          workplaceMarkerRef.current.el,
          'atlas-workplace'
        )
      );
    }
    return items;
    // markersRef/workplaceMarkerRef are mutable; force re-render via the `_` state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, selectedId, workplaceLabel, onSelect]);

  const filter = mode === 'warm' ? WARM_CANVAS_FILTER : COOL_CANVAS_FILTER;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'var(--atlas-paper)',
        ...style
      }}
      data-atlas-map-mode={mode}
    >
      <style>{`
        [data-atlas-map-mode="${mode}"] .maplibregl-canvas { filter: ${filter}; }
        .atlas-map-marker { will-change: transform; }
      `}</style>
      {portals}
    </div>
  );
}
