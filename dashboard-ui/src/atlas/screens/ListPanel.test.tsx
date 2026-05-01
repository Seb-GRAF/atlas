import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListPanel } from './ListPanel';
import type { AtlasListing } from '../types';

function listing(id: string): AtlasListing {
  return {
    id,
    title: `Listing ${id}`,
    area: 'Vevey',
    address: 'Rue du Lac 1',
    rooms: 3,
    surfaceM2: 72,
    totalChf: 1800,
    source: 'flatfox.ch',
    url: null,
    pinned: false,
    isNew: false,
    isRemoved: false,
    status: 'À trier',
    notes: '',
    publishedLabel: '',
    publishedShort: '',
    publishedTs: null,
    transitText: null,
    driveText: null,
    distanceText: null,
    driveMinutes: null,
    transitMinutes: null,
    driveRouteStatus: null,
    transitRouteStatus: null,
    transitRouteLabel: null,
    transitRouteComputedAt: null,
    transitRoute: null,
    transitRouteOverlay: null,
    commuteWarnings: [],
    commutePending: false,
    lat: 46.47,
    lon: 6.84,
    locationPrecision: 'address',
    images: []
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (Element.prototype as Element & { scrollIntoView?: unknown }).scrollIntoView;
});

describe('ListPanel selection focus', () => {
  it('scrolls the selected row into view when selection changes externally', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    });

    const { rerender } = render(
      <ListPanel
        zones={['Vevey']}
        listings={[listing('a'), listing('b'), listing('c')]}
        selectedId={null}
        onSelect={() => undefined}
        generatedAt=""
        sort="recent"
        onSortChange={() => undefined}
      />
    );

    rerender(
      <ListPanel
        zones={['Vevey']}
        listings={[listing('a'), listing('b'), listing('c')]}
        selectedId="c"
        onSelect={() => undefined}
        generatedAt=""
        sort="recent"
        onSortChange={() => undefined}
      />
    );

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
    );
  });

  it('makes the selected row visually distinct', () => {
    Object.defineProperty(window.Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    });

    render(
      <ListPanel
        zones={['Vevey']}
        listings={[listing('a'), listing('b')]}
        selectedId="b"
        onSelect={() => undefined}
        generatedAt=""
        sort="recent"
        onSortChange={() => undefined}
      />
    );

    const selectedRow = screen.getByRole('button', { name: 'Listing b' });
    expect(selectedRow.style.background).toBe('var(--atlas-ember-2)');
    expect(selectedRow.style.boxShadow).toBe('none');
  });
});
