import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import maplibregl, {
  LngLatBounds,
  LngLatBoundsLike,
  Map as MapLibreMap,
  Marker,
  type StyleSpecification
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { formatCHF } from './Mono';
import { Icons } from '../icons';
import type { RouteOverlay } from '../types';
import type { Basemap } from '../mapPrefs';
import { SWITZERLAND_MAX_BOUNDS, scopeSourceToSwitzerland } from './mapBounds';

// Register the pmtiles:// protocol with maplibre-gl exactly once. The Protocol
// instance keeps an internal LRU of opened archives, so re-registering on every
// AtlasMap mount would tear that cache. Module scope = process scope = correct.
let pmtilesRegistered = false;
function ensurePmtilesProtocol() {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesRegistered = true;
}

export type AtlasMapPin = {
  id: string;
  lat: number;
  lon: number;
  totalChf: number;
  precision?: 'address' | 'area' | null;
};

export type AtlasMapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetBearing: () => void;
  flyToWorkplace: () => void;
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
  basemap?: Basemap;
  style?: CSSProperties;
  className?: string;
  routeOverlay?: RouteOverlay | null;
};

// Protomaps PMTiles archive — open vector tiles (OSM-derived) in their v4 schema.
// MapLibre range-fetches the .pmtiles archive via the pmtiles:// protocol.
//
// Default: same-origin proxy at /maps/protomaps.pmtiles, served by
// scripts/serve-dashboard.mjs (which forwards range requests to the protomaps
// demo bucket). The demo bucket itself doesn't return CORS headers, which iOS
// Safari rejects — desktop browsers tolerate it but iOS shows only the
// satellite layer. Going through the proxy makes the request same-origin.
//
// Override with VITE_PMTILES_URL to point directly at a self-hosted or
// regional extract (Switzerland is small — roughly 100 MB).
const DEFAULT_PMTILES_URL = '/maps/protomaps.pmtiles';

// Resolve relative URLs against the page origin. The pmtiles:// protocol
// strips its scheme and hands the rest to fetch(), so a value like
// "/maps/protomaps.pmtiles" needs to become an absolute URL before being
// concatenated into "pmtiles://..." — otherwise we get the awkward
// "pmtiles:///maps/..." triple-slash form.
function resolvePmtilesUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  if (typeof window !== 'undefined' && window.location) {
    return new URL(input, window.location.origin).toString();
  }
  return input;
}

const PMTILES_URL: string = resolvePmtilesUrl(
  (import.meta.env?.VITE_PMTILES_URL as string | undefined) || DEFAULT_PMTILES_URL
);

const VECTOR_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://protomaps.com">Protomaps</a>';

const SATELLITE_ATTRIBUTION =
  'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics ' +
  '· Labels © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// ESRI World Imagery — free, no key, max zoom 19. Same provider Leaflet uses
// in countless examples; community-acceptable for non-commercial dashboards.
const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';

// Warm palette — design tokens, used as MapLibre paint properties so each
// feature class can be colored independently (no CSS filter wash).
const COLOR = {
  earth: '#f0e8db',
  // Water is held distinctly blue (vs. the muted greens of park/forest) so
  // landmass and lakes don't read as the same surface. Don't push the
  // saturation too high — the lake should feel calm, not loud.
  water: '#cfdce5',
  park: '#dee5c8',
  forest: '#c8d4ad',
  built: '#ece2cf',
  roadMinor: '#fff8ee',
  roadMajorFill: '#ffffff',
  roadMajorCasing: '#e8dcc4',
  rail: '#d8cfbd',
  border: '#cdbfa2',
  placeLabel: '#5a4f3d',
  placeLabelHalo: 'rgba(255,248,238,0.85)',
  roadLabel: '#7a6d57',
  roadLabelHalo: 'rgba(255,248,238,0.9)',
  satelliteLabel: '#ffffff',
  satelliteLabelHalo: 'rgba(0,0,0,0.55)',
  building: '#e3d6bb',
  buildingShade: '#cdbb98'
};

function buildVectorWarmStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      protomaps: scopeSourceToSwitzerland({
        type: 'vector',
        url: `pmtiles://${PMTILES_URL}`,
        attribution: VECTOR_ATTRIBUTION
      })
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': COLOR.earth } },
      {
        id: 'earth',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'earth',
        paint: { 'fill-color': COLOR.earth }
      },
      {
        id: 'landuse-park',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['park', 'cemetery', 'protected_area', 'nature_reserve', 'golf_course']]],
        paint: { 'fill-color': COLOR.park }
      },
      {
        id: 'landuse-forest',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['forest', 'wood']]],
        paint: { 'fill-color': COLOR.forest }
      },
      {
        id: 'landuse-built',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'kind'], ['literal', ['urban_area', 'residential', 'industrial', 'commercial']]],
        minzoom: 11,
        paint: { 'fill-color': COLOR.built, 'fill-opacity': 0.65 }
      },
      // Water polygons — oceans, lakes, reservoirs, canals, docks, basins.
      // Filter is "any polygon that isn't a river/stream/riverbank" rather
      // than a positive kind allowlist, because at low zoom Protomaps emits
      // Lac Léman under the generic kind="water" (Natural Earth fallback),
      // so ['in', kind, [ocean, lake]] would make the lake disappear when
      // zoomed out. River/stream/riverbank polygons are excluded because in
      // the demo bucket they're buffered floodplains that swallow city
      // streets — rivers/streams are rendered separately as lines below.
      {
        id: 'water-fill',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        filter: [
          'all',
          ['==', ['geometry-type'], 'Polygon'],
          ['!', ['in', ['get', 'kind_detail'], ['literal', ['river', 'stream', 'riverbank']]]]
        ],
        paint: { 'fill-color': COLOR.water }
      },
      // Rivers and streams — rendered as LINES only, not fills. The water
      // source-layer has line geometry for waterways; using lines keeps
      // streets and buildings visible underneath while still showing the
      // watercourse.
      {
        id: 'water-river-line',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'water',
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['in', ['get', 'kind_detail'], ['literal', ['river', 'canal']]]
        ],
        minzoom: 10,
        paint: {
          'line-color': COLOR.water,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 14, 1.2, 18, 3]
        }
      },
      {
        id: 'water-stream-line',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'water',
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['in', ['get', 'kind_detail'], ['literal', ['stream', 'ditch', 'drain']]]
        ],
        minzoom: 13,
        paint: {
          'line-color': COLOR.water,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 18, 1.5]
        }
      },
      {
        id: 'rail',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'transit',
        filter: ['==', ['get', 'kind'], 'rail'],
        minzoom: 11,
        paint: { 'line-color': COLOR.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 1.4] }
      },
      {
        id: 'roads-minor-casing',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other']]],
        minzoom: 12,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLOR.roadMajorCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0, 14, 1.2, 18, 6]
        }
      },
      {
        id: 'roads-minor',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other']]],
        minzoom: 12,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLOR.roadMinor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0, 14, 0.6, 18, 4]
        }
      },
      {
        id: 'roads-medium-casing',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'medium_road'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLOR.roadMajorCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 2.2, 18, 9]
        }
      },
      {
        id: 'roads-medium',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'medium_road'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLOR.roadMajorFill,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 14, 1.6, 18, 7]
        }
      },
      {
        id: 'roads-major-casing',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['in', ['get', 'kind'], ['literal', ['major_road', 'highway']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLOR.roadMajorCasing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 14, 3.2, 18, 12]
        }
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['in', ['get', 'kind'], ['literal', ['major_road', 'highway']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLOR.roadMajorFill,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.3, 14, 2.4, 18, 10]
        }
      },
      {
        id: 'boundaries',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'boundaries',
        filter: ['<=', ['get', 'kind_detail'], 2],
        paint: {
          'line-color': COLOR.border,
          'line-width': 0.6,
          'line-dasharray': [3, 2],
          'line-opacity': 0.5
        }
      },
      {
        id: 'roads-labels',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'roads',
        minzoom: 14,
        filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'medium_road', 'major_road']]],
        layout: {
          'symbol-placement': 'line',
          'text-font': ['Noto Sans Regular'],
          'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
          'text-size': 11,
          'text-letter-spacing': 0.02
        },
        paint: {
          'text-color': COLOR.roadLabel,
          'text-halo-color': COLOR.roadLabelHalo,
          'text-halo-width': 1.2
        }
      },
      {
        id: 'places-locality',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'places',
        filter: ['in', ['get', 'kind'], ['literal', ['locality', 'neighbourhood', 'suburb', 'city', 'town', 'village']]],
        layout: {
          'text-font': ['Noto Sans Regular'],
          'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 10,
            10, 12,
            14, 14
          ],
          'text-letter-spacing': 0.04,
          'text-max-width': 7
        },
        paint: {
          'text-color': COLOR.placeLabel,
          'text-halo-color': COLOR.placeLabelHalo,
          'text-halo-width': 1.4
        }
      }
    ]
  };
}

function buildSatelliteStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      imagery: scopeSourceToSwitzerland({
        type: 'raster',
        tiles: [SATELLITE_TILE_URL],
        tileSize: 256,
        attribution: SATELLITE_ATTRIBUTION,
        maxzoom: 19
      }),
      protomaps: scopeSourceToSwitzerland({
        type: 'vector',
        url: `pmtiles://${PMTILES_URL}`
      })
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0c1014' } },
      { id: 'imagery', type: 'raster', source: 'imagery' },
      {
        id: 'roads-labels',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'roads',
        minzoom: 14,
        filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'medium_road', 'major_road']]],
        layout: {
          'symbol-placement': 'line',
          'text-font': ['Noto Sans Regular'],
          'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
          'text-size': 11,
          'text-letter-spacing': 0.02
        },
        paint: {
          'text-color': COLOR.satelliteLabel,
          'text-halo-color': COLOR.satelliteLabelHalo,
          'text-halo-width': 1.4
        }
      },
      {
        id: 'places-locality',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'places',
        filter: ['in', ['get', 'kind'], ['literal', ['locality', 'neighbourhood', 'suburb', 'city', 'town', 'village']]],
        layout: {
          'text-font': ['Noto Sans Regular'],
          'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 10,
            10, 12,
            14, 14
          ],
          'text-letter-spacing': 0.04,
          'text-max-width': 7
        },
        paint: {
          'text-color': COLOR.satelliteLabel,
          'text-halo-color': COLOR.satelliteLabelHalo,
          'text-halo-width': 1.6
        }
      }
    ]
  };
}

// Relief mode = warm vector style + flat building footprints + extruded buildings.
// Heights come from OSM via Protomaps' `buildings` layer (`height` in meters,
// `min_height` for stacked structures). Coverage is patchy in residential areas
// — buildings without height data simply don't extrude, which degrades gracefully.
function buildReliefStyle(): StyleSpecification {
  const base = buildVectorWarmStyle();
  return {
    ...base,
    layers: [
      ...base.layers,
      // Flat footprint fill, zoom 13 → 14. The 3D layer takes over from 14
      // upward, so we fade this out to avoid double-painting.
      {
        id: 'buildings-flat',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'buildings',
        minzoom: 13,
        maxzoom: 14.5,
        paint: {
          'fill-color': COLOR.building,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.6, 14.5, 0]
        }
      },
      {
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'protomaps',
        'source-layer': 'buildings',
        minzoom: 14,
        paint: {
          // `interpolate` returns the layer's default color (black) when its
          // input expression evaluates to null — which happens for any building
          // missing the `height` property. Coalesce to a sensible default so
          // those buildings get a real color from the gradient.
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'height'], 8],
            0, COLOR.building,
            40, COLOR.buildingShade
          ],
          // OSM coverage of `height` is incomplete — coalesce missing heights
          // to a small default so we still get *some* relief.
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 4],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.9
        }
      }
    ]
  };
}

function buildStyleFor(basemap: Basemap): StyleSpecification {
  if (basemap === 'satellite') return buildSatelliteStyle();
  if (basemap === 'relief') return buildReliefStyle();
  return buildVectorWarmStyle();
}

const DEFAULT_CENTER = { lat: 46.47, lon: 6.84, zoom: 11 };

function PinButton({
  totalChf,
  selected,
  approximate,
  onClick
}: {
  totalChf: number;
  selected: boolean;
  approximate: boolean;
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
        border: approximate && !selected ? '1px dashed rgba(22,20,15,.32)' : 0,
        background: selected ? 'var(--atlas-ink)' : '#fff',
        color: selected ? '#fff' : 'var(--atlas-ink)',
        fontFamily: 'var(--atlas-mono)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        opacity: approximate && !selected ? 0.78 : 1,
        transform: selected ? 'scale(1.06)' : 'scale(1)',
        boxShadow: selected
          ? '0 8px 24px rgba(22,20,15,.28), 0 0 0 2px #fff'
          : '0 4px 14px rgba(22,20,15,.16), 0 0 0 1px rgba(22,20,15,.06)',
        transition:
          'transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease',
        fontVariantNumeric: 'tabular-nums',
        // Let multi-touch gestures (pinch-zoom) fall through to MapLibre's
        // canvas. Without this, iOS Safari treats a second finger landing
        // while the first is on the pin as a cancelled tap and never starts
        // the pinch. Single-tap clicks still fire normally.
        touchAction: 'none'
      }}
      title={approximate ? 'Position approximative' : undefined}
    >
      {formatCHF(totalChf)}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          marginLeft: 3,
          opacity: 0.6,
          textTransform: 'lowercase'
        }}
      >
        chf
      </span>
    </button>
  );
}

function ClusterPin({
  count,
  minChf,
  maxChf,
  onClick
}: {
  count: number;
  minChf: number;
  maxChf: number;
  onClick: () => void;
}) {
  const label =
    minChf === maxChf ? formatCHF(minChf) : `${formatCHF(minChf)}–${formatCHF(maxChf)}`;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px 5px 6px',
        borderRadius: 999,
        border: 0,
        background: '#fff',
        color: 'var(--atlas-ink)',
        fontFamily: 'var(--atlas-mono)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(22,20,15,.16), 0 0 0 1px rgba(22,20,15,.06)',
        transition: 'transform 140ms ease, box-shadow 140ms ease',
        fontVariantNumeric: 'tabular-nums',
        touchAction: 'none'
      }}
      title={`${count} annonces · cliquer pour zoomer`}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 20,
          height: 20,
          padding: '0 6px',
          borderRadius: 999,
          background: 'var(--atlas-ink)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700
        }}
      >
        {count}
      </span>
      <span>
        {label}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            marginLeft: 3,
            opacity: 0.6,
            textTransform: 'lowercase'
          }}
        >
          chf
        </span>
      </span>
    </button>
  );
}

function LegBadge({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        background: color,
        color: '#fff',
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '-0.005em',
        boxShadow: '0 4px 10px rgba(0,0,0,.18), 0 0 0 1.5px #fff',
        fontFamily: 'var(--atlas-mono)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </div>
  );
}

function WorkplacePill({ label }: { label: string }) {
  return (
    <div
      title={label}
      aria-label={label}
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        background: 'var(--atlas-ink)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(0,0,0,.18), 0 0 0 2px #fff',
        pointerEvents: 'none'
      }}
    >
      <Icons.Briefcase size={15} stroke={1.8} />
    </div>
  );
}

type SinglePinGroup = {
  kind: 'pin';
  id: string;
  lat: number;
  lon: number;
  pin: AtlasMapPin;
};

type ClusterGroup = {
  kind: 'cluster';
  id: string;
  lat: number;
  lon: number;
  members: AtlasMapPin[];
};

type PinGroup = SinglePinGroup | ClusterGroup;

type ManagedMarker = {
  marker: Marker;
  el: HTMLDivElement;
  group: PinGroup;
};

// Pixel radius within which two pins collapse into a cluster. Tuned to roughly
// match the rendered pill width so visually-overlapping pills always merge.
const CLUSTER_PIXEL_RADIUS = 44;

function clusterPins(map: MapLibreMap, pins: AtlasMapPin[]): PinGroup[] {
  const valid = pins.filter((p) => isValidLatLon(p.lat, p.lon));
  if (valid.length === 0) return [];

  // Project once; cluster in screen-space so the threshold is pixel-stable
  // across zoom levels.
  type Projected = { pin: AtlasMapPin; x: number; y: number; used: boolean };
  const projected: Projected[] = valid.map((pin) => {
    const point = map.project([pin.lon, pin.lat]);
    return { pin, x: point.x, y: point.y, used: false };
  });

  const groups: PinGroup[] = [];
  const r2 = CLUSTER_PIXEL_RADIUS * CLUSTER_PIXEL_RADIUS;

  for (let i = 0; i < projected.length; i++) {
    const seed = projected[i];
    if (seed.used) continue;
    seed.used = true;
    const members: AtlasMapPin[] = [seed.pin];
    let sumX = seed.x;
    let sumY = seed.y;

    for (let j = i + 1; j < projected.length; j++) {
      const other = projected[j];
      if (other.used) continue;
      const dx = other.x - seed.x;
      const dy = other.y - seed.y;
      if (dx * dx + dy * dy <= r2) {
        other.used = true;
        members.push(other.pin);
        sumX += other.x;
        sumY += other.y;
      }
    }

    if (members.length === 1) {
      const p = members[0];
      groups.push({ kind: 'pin', id: p.id, lat: p.lat, lon: p.lon, pin: p });
    } else {
      const center = map.unproject([sumX / members.length, sumY / members.length]);
      // Stable id from sorted member ids — keeps the same DOM marker across
      // re-clusters when the underlying group is unchanged.
      const id = `cluster:${members
        .map((m) => m.id)
        .sort()
        .join(',')}`;
      groups.push({
        kind: 'cluster',
        id,
        lat: center.lat,
        lon: center.lng,
        members
      });
    }
  }

  return groups;
}

function isValidLatLon(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function pinsBoundsKey(pins: AtlasMapPin[], workplace?: { lat: number; lon: number }) {
  // Build a stable signature of the geographic set; fitBounds only re-runs when
  // this changes (otherwise selecting a pin would keep refitting).
  const parts = pins
    .filter((p) => isValidLatLon(p.lat, p.lon))
    .map((p) => `${p.id}:${p.lat.toFixed(5)},${p.lon.toFixed(5)}`)
    .sort();
  if (workplace && isValidLatLon(workplace.lat, workplace.lon)) {
    parts.push(`w:${workplace.lat.toFixed(5)},${workplace.lon.toFixed(5)}`);
  }
  return parts.join('|');
}

export const AtlasMap = forwardRef<AtlasMapHandle, AtlasMapProps>(function AtlasMap(
  {
    pins,
    selectedId = null,
    onSelect,
    showWorkplace = true,
    workplaceLabel = 'Travail · EPFL',
    workplace,
    initialBounds,
    initialCenter,
    basemap = 'vector',
    style,
    className,
    routeOverlay
  },
  ref
) {
  ensurePmtilesProtocol();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, ManagedMarker>>(new Map());
  const workplaceMarkerRef = useRef<{ marker: Marker; el: HTMLDivElement } | null>(null);
  const routeBadgeMarkersRef = useRef<Array<{ marker: Marker; el: HTMLDivElement; label: string; color: string }>>([]);
  const routeLayersAddedRef = useRef(false);
  const lastBoundsKeyRef = useRef<string | null>(null);
  const appliedBasemapRef = useRef<Basemap>(basemap);
  const [loaded, setLoaded] = useState(false);
  const [renderTick, setRenderTick] = useState(0);
  // Bumped whenever the underlying style changes (e.g. vector ↔ satellite swap).
  // Effects that add MapLibre sources/layers (the route overlay) depend on this
  // so they re-add their content after `setStyle` blows the previous style away.
  const [styleTick, setStyleTick] = useState(0);
  // When a cluster's members all share the exact same coordinate (typically
  // address-less listings that fell back to the same town centroid), zooming
  // can't separate them. Instead we "spiderfy" the cluster on click: render
  // each member as its own marker offset radially in screen pixels, with a
  // thin line back to the shared anchor. Stored as the anchor lat/lon plus
  // the member list — pixel positions are recomputed every render so they
  // track pan/zoom correctly.
  const [spider, setSpider] = useState<{
    anchorLat: number;
    anchorLon: number;
    members: AtlasMapPin[];
  } | null>(null);

  const center = initialCenter ?? DEFAULT_CENTER;

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        mapRef.current?.zoomIn({ duration: 250 });
      },
      zoomOut: () => {
        mapRef.current?.zoomOut({ duration: 250 });
      },
      resetBearing: () => {
        mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 350 });
      },
      flyToWorkplace: () => {
        const map = mapRef.current;
        if (!map || !workplace) return;
        map.easeTo({
          center: [workplace.lon, workplace.lat],
          zoom: Math.max(map.getZoom(), 13),
          duration: 450
        });
      }
    }),
    [workplace?.lat, workplace?.lon]
  );

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyleFor(basemap),
      center: [center.lon, center.lat],
      zoom:
        basemap === 'relief'
          ? Math.max(center.zoom ?? DEFAULT_CENTER.zoom, 15)
          : center.zoom ?? DEFAULT_CENTER.zoom,
      pitch: basemap === 'relief' ? 55 : 0,
      bearing: basemap === 'relief' ? -17 : 0,
      attributionControl: { compact: true },
      cooperativeGestures: false,
      maxZoom: 19,
      maxBounds: SWITZERLAND_MAX_BOUNDS,
      renderWorldCopies: false
    });

    if (initialBounds) {
      map.fitBounds(initialBounds, { padding: 64, animate: false });
    }

    // Plain scroll-wheel zoom — the map fills its panel so there's no scroll
    // hijack to worry about.
    map.scrollZoom.enable();

    map.on('click', (event) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target && target.closest('.atlas-map-marker')) return;
      onSelect?.(null);
    });

    map.on('load', () => setLoaded(true));

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      workplaceMarkerRef.current = null;
      lastBoundsKeyRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap basemap style (vector / satellite / relief) without recreating the
  // map. After setStyle the previous sources/layers are gone, so we clear the
  // route bookkeeping and bump styleTick to make the route-overlay effect
  // re-attach its source + layers on top of the new style. DOM markers (pins,
  // workplace, route badges) are MapLibre Markers that survive setStyle
  // automatically.
  //
  // Relief mode also tilts the camera so the extruded buildings actually read
  // as 3D; switching away resets pitch/bearing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (appliedBasemapRef.current === basemap) return;
    appliedBasemapRef.current = basemap;
    routeLayersAddedRef.current = false;
    map.setStyle(buildStyleFor(basemap), { diff: false });
    const onStyleData = () => {
      // Wait for the new style's first styledata event before letting the
      // route effect re-add layers — adding to an unloaded style throws.
      if (!map.isStyleLoaded()) return;
      map.off('styledata', onStyleData);
      if (basemap === 'relief') {
        map.easeTo({
          pitch: 55,
          bearing: -17,
          zoom: Math.max(map.getZoom(), 15),
          duration: 600
        });
      } else if (map.getPitch() !== 0 || map.getBearing() !== 0) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 450 });
      }
      setStyleTick((n) => n + 1);
    };
    map.on('styledata', onStyleData);
    return () => {
      map.off('styledata', onStyleData);
    };
  }, [basemap, loaded]);

  // Re-cluster on map move/zoom. We bump a tick so the marker-sync effect below
  // re-runs against the freshly-projected pixel positions. rAF-coalesced so a
  // long pan/zoom doesn't thrash.
  const [moveTick, setMoveTick] = useState(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    let raf = 0;
    const onMove = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setMoveTick((n) => n + 1);
      });
    };
    map.on('move', onMove);
    map.on('zoom', onMove);
    return () => {
      map.off('move', onMove);
      map.off('zoom', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [loaded]);

  // Sync listing pin markers with the current group set. We portal React
  // content into each marker's DOM element so click/state transitions render
  // through React. Gated on `loaded` because Markers attached before the map's
  // first frame render at (0,0) and stay invisible until a later interaction
  // forces a reflow.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const groups = clusterPins(map, pins);
    const next = new Map<string, ManagedMarker>();
    const seen = new Set<string>();
    // Reapply route-fade on every (re)cluster so freshly-created markers
    // during a pan don't briefly render at full opacity. Clusters that
    // contain the routed listing stay opaque.
    const routeListingId = routeOverlay?.listingId ?? null;
    const isDimmed = (group: PinGroup) => {
      if (!routeListingId) return false;
      if (group.kind === 'pin') return group.pin.id !== routeListingId;
      return !group.members.some((m) => m.id === routeListingId);
    };

    for (const group of groups) {
      seen.add(group.id);
      const existing = markersRef.current.get(group.id);
      if (existing) {
        existing.marker.setLngLat([group.lon, group.lat]);
        existing.group = group;
        // MapLibre rewrites `el.style.opacity` on every internal _update
        // (terrain occlusion path), so we have to go through the public
        // setOpacity API or our value gets clobbered mid-pan.
        existing.marker.setOpacity(isDimmed(group) ? '0.5' : '1');
        next.set(group.id, existing);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'atlas-map-marker';
      el.style.cursor = 'pointer';
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([group.lon, group.lat])
        .addTo(map);
      marker.setOpacity(isDimmed(group) ? '0.5' : '1');
      next.set(group.id, { marker, el, group });
    }

    for (const [id, managed] of markersRef.current) {
      if (!seen.has(id)) managed.marker.remove();
    }
    markersRef.current = next;
    setRenderTick((n) => n + 1);
  }, [pins, loaded, moveTick, routeOverlay]);

  // Workplace marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const wp = workplace;
    if (!showWorkplace || !wp || !isValidLatLon(wp.lat, wp.lon)) {
      workplaceMarkerRef.current?.marker.remove();
      workplaceMarkerRef.current = null;
      setRenderTick((n) => n + 1);
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
      setRenderTick((n) => n + 1);
    }
  }, [showWorkplace, workplace?.lat, workplace?.lon, loaded]);

  // Route overlay: draw GeoJSON LineString layers + leg-label badges. The
  // source data is rebuilt per overlay; clearing the prop removes all layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const SOURCE_ID = 'commute-route';
    const WALK_LAYER = 'commute-route-walk';
    const TRANSIT_LAYER = 'commute-route-transit';
    const STOPS_LAYER = 'commute-route-stops';

    const removeLayers = () => {
      for (const id of [WALK_LAYER, TRANSIT_LAYER, STOPS_LAYER]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      routeLayersAddedRef.current = false;
      for (const m of routeBadgeMarkersRef.current) m.marker.remove();
      routeBadgeMarkersRef.current = [];
      setRenderTick((n) => n + 1);
    };

    if (!routeOverlay || routeOverlay.legs.length === 0) {
      removeLayers();
      return;
    }

    type RouteFeature = GeoJSON.Feature<GeoJSON.LineString, { kind: 'walk' | 'transit'; color: string; failed: boolean }>;
    type StopFeature = GeoJSON.Feature<GeoJSON.Point, { color: string }>;
    const lineFeatures: RouteFeature[] = [];
    const stopFeatures: StopFeature[] = [];
    const isUsablePoint = (p: [number, number] | undefined) =>
      Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && !(p[0] === 0 && p[1] === 0);

    // Recompute bounds from the *cleaned* leg coords. The stored
    // routeOverlay.bounds field can be polluted by older overlays whose legs
    // included a {0, 0} placeholder coord, which makes the map zoom out to
    // span Switzerland → the equator.
    let computedBounds: [[number, number], [number, number]] | null = null;
    const expand = (point: [number, number]) => {
      if (!computedBounds) {
        computedBounds = [[point[0], point[1]], [point[0], point[1]]];
        return;
      }
      const [[w, s], [e, n]] = computedBounds;
      computedBounds = [
        [Math.min(w, point[0]), Math.min(s, point[1])],
        [Math.max(e, point[0]), Math.max(n, point[1])]
      ];
    };

    // Find the listing pin so we can fall back to it for the first walk leg
    // when the stored overlay only has the destination stop (older tracker
    // data, or address-based opendata.ch results without a station coord).
    const listingPin = pins.find((p) => p.id === routeOverlay.listingId);
    const listingPoint: [number, number] | null =
      listingPin && isUsablePoint([listingPin.lon, listingPin.lat])
        ? [listingPin.lon, listingPin.lat]
        : null;
    const workplacePoint: [number, number] | null =
      workplace && isUsablePoint([workplace.lon, workplace.lat])
        ? [workplace.lon, workplace.lat]
        : null;

    const lastIdx = routeOverlay.legs.length - 1;
    for (let i = 0; i < routeOverlay.legs.length; i++) {
      const leg = routeOverlay.legs[i];
      let cleanCoords = (leg.coords as [number, number][]).filter(isUsablePoint);
      // Patch missing endpoints on the first/last walk legs using the listing
      // or workplace pin. Keeps stale overlays renderable without a recompute.
      if (leg.kind === 'walk' && cleanCoords.length < 2) {
        if (i === 0 && listingPoint) {
          cleanCoords = cleanCoords.length === 0
            ? [listingPoint]
            : [listingPoint, ...cleanCoords];
        }
        if (i === lastIdx && workplacePoint) {
          cleanCoords = cleanCoords.length === 0
            ? [workplacePoint]
            : [...cleanCoords, workplacePoint];
        }
      }
      if (cleanCoords.length < 2) continue;
      for (const c of cleanCoords) expand(c);
      lineFeatures.push({
        type: 'Feature',
        properties: { kind: leg.kind, color: leg.color, failed: leg.failed },
        geometry: { type: 'LineString', coordinates: cleanCoords }
      });
      stopFeatures.push({
        type: 'Feature',
        properties: { color: leg.color },
        geometry: { type: 'Point', coordinates: cleanCoords[0] }
      });
    }
    // Final stop (arrival of last leg).
    const lastLeg = routeOverlay.legs[routeOverlay.legs.length - 1];
    if (lastLeg) {
      let lastCoords = (lastLeg.coords as [number, number][]).filter(isUsablePoint);
      // If the last leg is a walk and its destination was the {0,0} sentinel,
      // append the workplace pin so the arrival dot lands at the office.
      const rawLast = lastLeg.coords?.[lastLeg.coords.length - 1];
      if (lastLeg.kind === 'walk' && workplacePoint && !isUsablePoint(rawLast)) {
        lastCoords = [...lastCoords, workplacePoint];
      }
      if (lastCoords.length > 0) {
        stopFeatures.push({
          type: 'Feature',
          properties: { color: lastLeg.color },
          geometry: { type: 'Point', coordinates: lastCoords[lastCoords.length - 1] }
        });
      }
    }

    const lineFc: GeoJSON.FeatureCollection<GeoJSON.LineString> = { type: 'FeatureCollection', features: lineFeatures };
    const stopFc: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: 'FeatureCollection', features: stopFeatures };

    const apply = () => {
      const existing = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        // Combine line + stop features into a single source — easier to manage
        // and we filter by geometry-type in each layer.
        existing.setData({
          type: 'FeatureCollection',
          features: [...lineFeatures, ...stopFeatures]
        });
      } else {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [...lineFeatures, ...stopFeatures] }
        });
      }

      if (!map.getLayer(WALK_LAYER)) {
        map.addLayer({
          id: WALK_LAYER,
          type: 'line',
          source: SOURCE_ID,
          filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'kind'], 'walk']],
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3,
            'line-dasharray': [2, 2],
            'line-opacity': 0.95
          }
        });
      }
      if (!map.getLayer(TRANSIT_LAYER)) {
        map.addLayer({
          id: TRANSIT_LAYER,
          type: 'line',
          source: SOURCE_ID,
          filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'kind'], 'transit']],
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 4.5,
            'line-opacity': 0.95
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' }
        });
      }
      if (!map.getLayer(STOPS_LAYER)) {
        map.addLayer({
          id: STOPS_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 4.5,
            'circle-color': '#ffffff',
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': 2
          }
        });
      }
      routeLayersAddedRef.current = true;

      // Sync per-leg badge markers (one at the start of each transit leg, plus
      // first walk if the route starts with a walk).
      for (const m of routeBadgeMarkersRef.current) m.marker.remove();
      routeBadgeMarkersRef.current = [];
      for (let i = 0; i < routeOverlay.legs.length; i++) {
        const leg = routeOverlay.legs[i];
        const cleanCoords = (leg.coords as [number, number][]).filter(isUsablePoint);
        if (cleanCoords.length === 0) continue;
        // Show transit labels always; skip walk labels except at index 0.
        if (leg.kind === 'walk' && i !== 0) continue;
        const startIdx = Math.floor(cleanCoords.length / 2);
        const [lng, lat] = cleanCoords[startIdx];
        const el = document.createElement('div');
        el.className = 'atlas-map-marker';
        el.style.pointerEvents = 'none';
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
        routeBadgeMarkersRef.current.push({ marker, el, label: leg.label, color: leg.color });
      }

      // Fit bounds to the route, using the bounds we just recomputed from
      // cleaned coords (not routeOverlay.bounds, which can contain {0, 0}
      // pollution from older stored overlays).
      if (computedBounds) {
        const [[w, s], [e, n]] = computedBounds;
        const bounds = new LngLatBounds([w, s], [e, n]);
        const isWide = (map.getContainer().clientWidth || 0) >= 1024;
        map.fitBounds(bounds, {
          padding: isWide
            ? { top: 96, right: 432, bottom: 96, left: 432 }
            : { top: 80, right: 32, bottom: 220, left: 32 },
          maxZoom: 15,
          duration: 600
        });
      }
      setRenderTick((n) => n + 1);
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);

    return () => {
      // Don't remove on unmount-of-effect when the overlay is still set;
      // removal is handled by the next overlay change or null. But if the
      // component is unmounting entirely the map cleanup effect handles it.
    };
  }, [routeOverlay, loaded, styleTick]);

  // Auto-fit the viewport to the visible pins (+ workplace) whenever the pin
  // set changes geographically. Without this the map kept its initial center
  // and pins would land outside the viewport.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const key = pinsBoundsKey(pins, showWorkplace ? workplace : undefined);
    if (key === lastBoundsKeyRef.current) return;
    lastBoundsKeyRef.current = key;
    const valid = pins.filter((p) => isValidLatLon(p.lat, p.lon));
    if (valid.length === 0 && !(showWorkplace && workplace)) return;

    const bounds = new LngLatBounds();
    for (const p of valid) bounds.extend([p.lon, p.lat]);
    if (showWorkplace && workplace && isValidLatLon(workplace.lat, workplace.lon)) {
      bounds.extend([workplace.lon, workplace.lat]);
    }

    const run = () => {
      if (valid.length === 1 && !(showWorkplace && workplace)) {
        map.easeTo({ center: [valid[0].lon, valid[0].lat], zoom: 13, duration: 350 });
        return;
      }
      // Padding clears the floating glass list (left ~412px) and detail panel
      // (right ~412px) on desktop; on mobile the panels don't overlay the map.
      const isWide = (map.getContainer().clientWidth || 0) >= 1024;
      map.fitBounds(bounds, {
        padding: isWide
          ? { top: 96, right: 432, bottom: 64, left: 432 }
          : { top: 80, right: 32, bottom: 200, left: 32 },
        maxZoom: 14,
        duration: 450
      });
    };

    if (map.isStyleLoaded()) run();
    else map.once('load', run);
  }, [pins, showWorkplace, workplace?.lat, workplace?.lon]);

  // Pan to the selected pin so it's always visible after selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const pin = pins.find((p) => p.id === selectedId);
    if (!pin || !isValidLatLon(pin.lat, pin.lon)) return;
    // Close the spider unless the new selection is one of its members (i.e.
    // the user just picked a spider pin — keep it open until it's mounted in
    // its selected state, then the next selection change will collapse it).
    if (spider && !spider.members.some((m) => m.id === selectedId)) {
      setSpider(null);
    }
    const run = () => {
      map.easeTo({
        center: [pin.lon, pin.lat],
        zoom: Math.max(map.getZoom(), 13),
        duration: 350,
        essential: true
      });
    };
    if (map.isStyleLoaded()) run();
    else map.once('load', run);
  }, [selectedId, pins]);

  const zoomToCluster = (members: AtlasMapPin[]) => {
    const map = mapRef.current;
    if (!map || members.length === 0) return;
    const bounds = new LngLatBounds();
    for (const m of members) bounds.extend([m.lon, m.lat]);
    // If members share a coordinate (e.g. address-less listings that fell back
    // to the same town centroid), bounds collapses to a point and zooming can't
    // separate them. Spiderfy the cluster instead — fan members out radially
    // in screen space so each becomes its own clickable target.
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    if (sw.lat === ne.lat && sw.lng === ne.lng) {
      setSpider({ anchorLat: sw.lat, anchorLon: sw.lng, members });
      return;
    }
    // Different-coords cluster: close any open spider before flying to it,
    // otherwise the spider would recompute mid-flight and trail off-screen.
    setSpider(null);
    const isWide = (map.getContainer().clientWidth || 0) >= 1024;
    map.fitBounds(bounds, {
      padding: isWide
        ? { top: 96, right: 432, bottom: 64, left: 432 }
        : { top: 80, right: 32, bottom: 200, left: 32 },
      maxZoom: 17,
      duration: 450
    });
  };

  // While the spider is open: bump renderTick on every map move so the
  // pixel-projected member positions follow pan/zoom. Close on Escape or on
  // a background map click (any click that didn't land on a marker or on a
  // spider element).
  useEffect(() => {
    if (!spider) return;
    const map = mapRef.current;
    if (!map) return;
    const onMove = () => setRenderTick((t) => t + 1);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSpider(null);
    };
    const onBackgroundClick = (event: maplibregl.MapMouseEvent) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target && target.closest('[data-atlas-spider]')) return;
      if (target && target.closest('.atlas-map-marker')) return;
      setSpider(null);
    };
    map.on('move', onMove);
    map.on('zoom', onMove);
    map.on('click', onBackgroundClick);
    window.addEventListener('keydown', onKey);
    return () => {
      map.off('move', onMove);
      map.off('zoom', onMove);
      map.off('click', onBackgroundClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [spider]);

  // Reconcile spider members against the live `pins` prop. When the user
  // discards a listing while the spider is open, that listing disappears from
  // `pins`; we drop it from the spider so its stale PinButton stops rendering.
  // Collapse the spider entirely once 1 or fewer members remain.
  useEffect(() => {
    if (!spider) return;
    const live = new Map(pins.map((p) => [p.id, p]));
    const next = spider.members
      .map((m) => live.get(m.id))
      .filter((p): p is AtlasMapPin => !!p);
    if (next.length === spider.members.length) return;
    if (next.length <= 1) {
      setSpider(null);
      return;
    }
    setSpider({ ...spider, members: next });
  }, [pins, spider]);

  const portals: ReactNode[] = useMemo(() => {
    const items: ReactNode[] = [];
    const spideredIds = spider ? new Set(spider.members.map((m) => m.id)) : null;
    for (const [id, managed] of markersRef.current) {
      const group = managed.group;
      if (group.kind === 'pin') {
        // Hide individual pins that overlap with the spidered set.
        if (spideredIds?.has(group.pin.id)) {
          items.push(createPortal(<></>, managed.el, id));
          continue;
        }
        items.push(
          createPortal(
            <PinButton
              totalChf={group.pin.totalChf}
              selected={selectedId === group.pin.id}
              approximate={group.pin.precision === 'area'}
              onClick={() => onSelect?.(group.pin.id)}
            />,
            managed.el,
            id
          )
        );
      } else {
        // While spidered, hide the cluster whose members are being fanned out.
        // Detect by member-set equality rather than coord equality — the
        // cluster's centroid is `unproject`-ed and can drift by floating-point
        // ε from the original anchor lat/lon.
        if (
          spideredIds &&
          group.members.length === spideredIds.size &&
          group.members.every((m) => spideredIds.has(m.id))
        ) {
          items.push(createPortal(<></>, managed.el, id));
          continue;
        }
        let minChf = Infinity;
        let maxChf = -Infinity;
        for (const m of group.members) {
          if (m.totalChf < minChf) minChf = m.totalChf;
          if (m.totalChf > maxChf) maxChf = m.totalChf;
        }
        items.push(
          createPortal(
            <ClusterPin
              count={group.members.length}
              minChf={minChf}
              maxChf={maxChf}
              onClick={() => zoomToCluster(group.members)}
            />,
            managed.el,
            id
          )
        );
      }
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
    routeBadgeMarkersRef.current.forEach((m, i) => {
      items.push(
        createPortal(<LegBadge label={m.label} color={m.color} />, m.el, `route-badge-${i}`)
      );
    });
    return items;
    // renderTick fires after marker sync so the portal map sees freshly-created
    // marker elements; markersRef is mutable so we can't depend on it directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick, selectedId, workplaceLabel, onSelect, spider]);

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
      data-atlas-basemap={basemap}
    >
      <style>{`
        .atlas-map-marker { will-change: transform; transition: opacity 180ms ease; }
      `}</style>
      {portals}
      {spider && mapRef.current && (() => {
        const map = mapRef.current;
        const anchor = map.project([spider.anchorLon, spider.anchorLat]);
        const n = spider.members.length;
        // For 2 members, lay out horizontally so the wide pills don't overlap.
        // For 3+, fan around a ring; radius grows with N so price pills don't
        // collide on the circle. PinButton width ≈ 78–90px for typical 4-digit
        // CHF values; circumference ≥ N * 70 px keeps neighbors clear.
        const items = spider.members.map((m, i) => {
          let x: number;
          let y: number;
          if (n === 2) {
            const dx = i === 0 ? -56 : 56;
            x = anchor.x + dx;
            y = anchor.y;
          } else {
            const radius = Math.max(48, (n * 70) / (2 * Math.PI));
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
            x = anchor.x + Math.cos(angle) * radius;
            y = anchor.y + Math.sin(angle) * radius;
          }
          return { pin: m, x, y };
        });
        return (
          <div
            data-atlas-spider
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 20
            }}
          >
            <svg
              width="100%"
              height="100%"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'visible'
              }}
            >
              {items.map((it) => (
                <line
                  key={`leg-${it.pin.id}`}
                  x1={anchor.x}
                  y1={anchor.y}
                  x2={it.x}
                  y2={it.y}
                  stroke="rgba(22,20,15,.35)"
                  strokeWidth={1.25}
                  strokeDasharray="2 3"
                />
              ))}
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={4}
                fill="var(--atlas-ink)"
                opacity={0.55}
              />
            </svg>
            {items.map((it) => (
              <div
                key={it.pin.id}
                className="atlas-map-marker"
                style={{
                  position: 'absolute',
                  left: it.x,
                  top: it.y,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto'
                }}
              >
                <PinButton
                  totalChf={it.pin.totalChf}
                  selected={selectedId === it.pin.id}
                  approximate={it.pin.precision === 'area'}
                  onClick={() => onSelect?.(it.pin.id)}
                />
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
});
