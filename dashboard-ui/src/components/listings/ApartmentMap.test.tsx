import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Listing } from '../../api/schemas';
import { ApartmentMap } from './ApartmentMap';

type MarkerRecord = {
  latLng: { lat: number; lng: number };
  events: Map<string, () => void>;
  options?: { icon?: { html?: string }; zIndexOffset?: number };
  element: HTMLElement;
  popup: unknown;
  on: (event: string, handler: () => void) => MarkerRecord;
  bindPopup: (content: unknown, options?: unknown) => MarkerRecord;
  addTo: (layer: unknown) => MarkerRecord;
  getElement: () => HTMLElement;
  getLatLng: () => { lat: number; lng: number };
  openPopup: ReturnType<typeof vi.fn>;
  setZIndexOffset: ReturnType<typeof vi.fn>;
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
    panInside: ReturnType<typeof vi.fn>;
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
          panInside: vi.fn(),
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
      marker: vi.fn((point: [number, number] | { lat: number; lng?: number; lon?: number }, options?: { icon?: { html?: string }; zIndexOffset?: number }) => {
        const element = document.createElement('div');
        element.innerHTML = options?.icon?.html || '';
        const marker: MarkerRecord = {
          latLng: toLatLng(point),
          events: new Map(),
          options,
          element,
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
          getElement() {
            return this.element;
          },
          getLatLng() {
            return this.latLng;
          },
          openPopup: vi.fn(),
          setZIndexOffset: vi.fn()
        };
        return marker;
      }),
      divIcon: vi.fn((options) => options),
      latLng: vi.fn(toLatLng),
      latLngBounds,
      DomEvent: {
        stop: vi.fn((event: Event) => {
          event.preventDefault();
          event.stopPropagation();
        })
      }
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
        onClearSelection={vi.fn()}
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

describe('ApartmentMap listing markers', () => {
  it('renders the selected listing with full collapsed shell content before selection classes are toggled', async () => {
    render(
      <ApartmentMap
        listings={[{ ...listing('one', 46.52, 6.63), totalChf: 100 }]}
        workplace={null}
        selectedListingId="one"
        onSelectListing={vi.fn()}
        onClearSelection={vi.fn()}
        onOpenLightbox={vi.fn()}
        open
      />
    );

    await waitFor(() => expect(leafletMock.markers).toHaveLength(1));
    const marker = leafletMock.markers[0];
    const html = marker.options?.icon?.html || '';
    const shell = marker.getElement().querySelector('.atlas-map-pin-shell');

    expect(marker.popup).toBeNull();
    expect(html).toContain('atlas-map-pin-shell');
    expect(html).not.toContain('is-expanded');
    expect(html).toContain('atlas-map-pin-price');
    expect(html).toContain('atlas-map-pin-preview');
    expect(html).toContain('Listing one');
    expect(html).toMatch(/100(?:\s|&nbsp;)?CHF/);
    await waitFor(() => expect(shell?.classList.contains('is-expanded')).toBe(true));
  });

  it('updates the same marker shell when a listing is selected', async () => {
    const onSelectListing = vi.fn();
    const onOpenLightbox = vi.fn();
    const listings = [listing('one', 46.52, 6.63)];
    const { rerender } = render(
      <ApartmentMap
        listings={listings}
        workplace={null}
        selectedListingId={null}
        onSelectListing={onSelectListing}
        onClearSelection={vi.fn()}
        onOpenLightbox={onOpenLightbox}
        open
      />
    );

    await waitFor(() => expect(leafletMock.markers).toHaveLength(1));
    const marker = leafletMock.markers[0];
    const shell = marker.getElement().querySelector('.atlas-map-pin-shell');
    const preview = marker.getElement().querySelector('[data-map-preview]');

    expect(shell).toBeTruthy();
    expect(shell?.classList.contains('is-expanded')).toBe(false);
    expect(preview?.getAttribute('aria-hidden')).toBe('true');
    expect(preview?.hasAttribute('inert')).toBe(true);

    rerender(
      <ApartmentMap
        listings={[{ ...listing('one', 46.52, 6.63) }]}
        workplace={null}
        selectedListingId="one"
        onSelectListing={vi.fn()}
        onClearSelection={vi.fn()}
        onOpenLightbox={vi.fn()}
        open
      />
    );

    await waitFor(() => expect(shell?.classList.contains('is-expanded')).toBe(true));
    expect(leafletMock.markers).toHaveLength(1);
    expect(preview?.getAttribute('aria-hidden')).toBe('false');
    expect(preview?.hasAttribute('inert')).toBe(false);
    expect(marker.setZIndexOffset).toHaveBeenLastCalledWith(240);
  });

  it('selects marker clicks and pans selected listings into visible padded space without opening Leaflet popups', async () => {
    const onSelectListing = vi.fn();
    const onOpenLightbox = vi.fn();
    const listings = [listing('one', 46.52, 6.63)];
    const { rerender } = render(
      <ApartmentMap
        listings={listings}
        workplace={null}
        selectedListingId={null}
        onSelectListing={onSelectListing}
        onClearSelection={vi.fn()}
        onOpenLightbox={onOpenLightbox}
        open
      />
    );

    await waitFor(() => expect(leafletMock.markers).toHaveLength(1));
    leafletMock.markers[0].events.get('click')?.();

    expect(onSelectListing).toHaveBeenCalledWith('one');

    rerender(
      <ApartmentMap
        listings={listings}
        workplace={null}
        selectedListingId="one"
        onSelectListing={onSelectListing}
        onClearSelection={vi.fn()}
        onOpenLightbox={onOpenLightbox}
        open
      />
    );

    await waitFor(() =>
      expect(leafletMock.maps[0].panInside).toHaveBeenCalledWith(
        { lat: 46.52, lng: 6.63 },
        {
          paddingTopLeft: [160, 340],
          paddingBottomRight: [160, 32],
          animate: true,
          duration: 0.35
        }
      )
    );
    const latestMarker = leafletMock.markers.at(-1);

    expect(latestMarker?.openPopup).not.toHaveBeenCalled();
    expect(leafletMock.maps[0].panTo).not.toHaveBeenCalled();
  });

  it('clears selection when clicking the map background but not the marker shell', async () => {
    const onClearSelection = vi.fn();
    render(
      <ApartmentMap
        listings={[listing('one', 46.52, 6.63)]}
        workplace={null}
        selectedListingId="one"
        onSelectListing={vi.fn()}
        onClearSelection={onClearSelection}
        onOpenLightbox={vi.fn()}
        open
      />
    );

    await waitFor(() => expect(leafletMock.markers).toHaveLength(1));
    const clickHandler = leafletMock.maps[0].on.mock.calls.find(([event]) => event === 'click')?.[1];
    const shell = leafletMock.markers[0].getElement().querySelector('.atlas-map-pin-shell');
    const markerEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(markerEvent, 'target', { value: shell });

    clickHandler?.({ originalEvent: markerEvent });
    expect(onClearSelection).not.toHaveBeenCalled();

    clickHandler?.({ originalEvent: new MouseEvent('click', { bubbles: true }) });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('opens marker media in the lightbox without selecting the marker', async () => {
    const onSelectListing = vi.fn();
    const onOpenLightbox = vi.fn();
    render(
      <ApartmentMap
        listings={[{ ...listing('one', 46.52, 6.63), imageUrls: ['/photo-one.jpg'] }]}
        workplace={null}
        selectedListingId="one"
        onSelectListing={onSelectListing}
        onClearSelection={vi.fn()}
        onOpenLightbox={onOpenLightbox}
        open
      />
    );

    await waitFor(() => expect(leafletMock.markers).toHaveLength(1));
    const media = leafletMock.markers[0].getElement().querySelector('[data-map-action="lightbox"]');
    expect(media).toBeTruthy();

    media?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(onOpenLightbox).toHaveBeenCalledWith(['/photo-one.jpg'], 0);
    expect(onSelectListing).not.toHaveBeenCalled();
  });
});
