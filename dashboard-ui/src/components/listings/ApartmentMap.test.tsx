import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Listing } from '../../api/schemas';
import { ApartmentMap } from './ApartmentMap';

type MarkerRecord = {
  latLng: { lat: number; lng: number };
  events: Map<string, () => void>;
  popup: unknown;
  on: (event: string, handler: () => void) => MarkerRecord;
  bindPopup: (content: unknown, options?: unknown) => MarkerRecord;
  addTo: (layer: unknown) => MarkerRecord;
  getLatLng: () => { lat: number; lng: number };
  openPopup: () => void;
};

const leafletMock = vi.hoisted(() => {
  const maps: Array<{
    fitBounds: ReturnType<typeof vi.fn>;
    setView: ReturnType<typeof vi.fn>;
    latLngToLayerPoint: (latLng: { lat: number; lng: number }) => { x: number; y: number; distanceTo: (other: { x: number; y: number }) => number };
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    invalidateSize: ReturnType<typeof vi.fn>;
    panTo: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }> = [];
  const markers: MarkerRecord[] = [];
  const latLngBounds = vi.fn((points: unknown[]) => ({ type: 'bounds', points }));

  function toLatLng(point: [number, number] | { lat: number; lng?: number; lon?: number }) {
    if (Array.isArray(point)) return { lat: point[0], lng: point[1] };
    return { lat: point.lat, lng: point.lng ?? point.lon ?? 0 };
  }

  return {
    maps,
    markers,
    latLngBounds,
    L: {
      map: vi.fn(() => {
        const map = {
          fitBounds: vi.fn(),
          setView: vi.fn(),
          latLngToLayerPoint: (latLng: { lat: number; lng: number }) => {
            const point = { x: latLng.lat * 10000, y: latLng.lng * 10000 };
            return {
              ...point,
              distanceTo: (other: { x: number; y: number }) => Math.hypot(point.x - other.x, point.y - other.y)
            };
          },
          on: vi.fn(),
          off: vi.fn(),
          invalidateSize: vi.fn(),
          panTo: vi.fn(),
          remove: vi.fn()
        };
        maps.push(map);
        return map;
      }),
      control: {
        zoom: vi.fn(() => ({ addTo: vi.fn() }))
      },
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      layerGroup: vi.fn(() => ({
        addTo: vi.fn(function addTo() {
          return this;
        }),
        clearLayers: vi.fn()
      })),
      circleMarker: vi.fn(() => ({
        bindTooltip: vi.fn(function bindTooltip() {
          return this;
        }),
        addTo: vi.fn()
      })),
      marker: vi.fn((point: [number, number] | { lat: number; lng?: number; lon?: number }) => {
        const marker: MarkerRecord = {
          latLng: toLatLng(point),
          events: new Map(),
          popup: null,
          on(event, handler) {
            this.events.set(event, handler);
            return this;
          },
          bindPopup(content) {
            this.popup = content;
            return this;
          },
          addTo() {
            markers.push(this);
            return this;
          },
          getLatLng() {
            return this.latLng;
          },
          openPopup: vi.fn()
        };
        return marker;
      }),
      divIcon: vi.fn((options) => options),
      latLng: vi.fn(toLatLng),
      latLngBounds
    }
  };
});

vi.mock('leaflet', () => ({
  default: leafletMock.L
}));

const baseListing = {
  source: 'test',
  area: 'Lausanne',
  totalChf: 2100,
  rooms: 3,
  surfaceM2: 72,
  status: 'À trier'
} satisfies Partial<Listing>;

function listing(id: string, lat: number, lon: number): Listing {
  return {
    ...baseListing,
    id,
    title: `Listing ${id}`,
    mapLocation: {
      lat,
      lon,
      query: 'Lausanne',
      source: 'geocode-cache',
      precision: 'address'
    }
  };
}

beforeEach(() => {
  leafletMock.maps.length = 0;
  leafletMock.markers.length = 0;
  leafletMock.latLngBounds.mockClear();
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  window.cancelAnimationFrame = vi.fn();
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('ApartmentMap clusters', () => {
  it('zooms to the clustered listings instead of opening a cluster card', async () => {
    render(
      <ApartmentMap
        listings={[listing('one', 46.52, 6.63), listing('two', 46.5204, 6.6304)]}
        workplace={null}
        selectedListingId={null}
        onSelectListing={vi.fn()}
        onOpenLightbox={vi.fn()}
        open
      />
    );

    await waitFor(() => expect(leafletMock.markers).toHaveLength(1));
    const clusterMarker = leafletMock.markers[0];

    expect(clusterMarker.popup).toBeNull();
    expect(clusterMarker.events.has('click')).toBe(true);

    clusterMarker.events.get('click')?.();

    expect(leafletMock.latLngBounds).toHaveBeenCalledWith([
      [46.52, 6.63],
      [46.5204, 6.6304]
    ]);
    expect(leafletMock.maps[0].fitBounds).toHaveBeenCalledWith(
      { type: 'bounds', points: [[46.52, 6.63], [46.5204, 6.6304]] },
      { padding: [42, 42], maxZoom: 18 }
    );
  });
});
