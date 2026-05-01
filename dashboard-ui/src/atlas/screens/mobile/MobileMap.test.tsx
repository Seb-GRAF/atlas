import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileMap } from './MobileMap';
import type { AtlasListing, AtlasProfile, AtlasStage } from '../../types';

vi.mock('../../components', async () => {
  const React = await import('react');

  return {
    AtlasMap: React.forwardRef(function AtlasMapMock(
      props: { selectedId: string | null; onSelect?: (id: string | null) => void },
      ref
    ) {
      React.useImperativeHandle(ref, () => ({
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetBearing: vi.fn()
      }));
      return (
        <div data-testid="atlas-map" data-selected-id={props.selectedId ?? ''}>
          <button type="button" data-testid="map-pin-b" onClick={() => props.onSelect?.('b')}>
            pin b
          </button>
        </div>
      );
    }),
    GlassPanel: ({ children, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div style={style} {...rest}>
        {children}
      </div>
    ),
    GlassPill: ({
      as,
      children,
      style,
      ...rest
    }: React.HTMLAttributes<HTMLElement> & { as?: keyof HTMLElementTagNameMap }) =>
      React.createElement(as ?? 'div', { style, ...rest }, children),
    Icons: {
      Search: () => <span />,
      Filter: () => <span />,
      ChevronDown: () => <span />
    },
    MapControls: () => <div />,
    Mono: ({ children, style }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span style={style}>{children}</span>
    ),
    formatCHF: (value: number) => String(value)
  };
});

vi.mock('../SourcesFilter', () => ({
  SourcesFilter: () => <div data-testid="sources-filter" />
}));

vi.mock('../../mapPrefs', () => ({
  loadBasemap: () => 'standard',
  saveBasemap: () => undefined
}));

const profile: AtlasProfile = {
  slug: 'vevey',
  shortTitle: 'Vevey',
  areas: [],
  zones: ['Vevey'],
  workplace: null,
  workplaceCoords: null,
  newCount: 0,
  generatedAt: '',
  budgetMinChf: null,
  budgetMaxChf: null,
  budgetCeilingChf: null,
  roomsMin: null,
  roomsMax: null,
  enabledSources: {}
};

const stages: AtlasStage[] = [{ value: 'triage', label: 'À trier', count: 3 }];

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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (Element.prototype as Element & { scrollIntoView?: unknown }).scrollIntoView;
});

describe('MobileMap carousel focus', () => {
  it('does not auto-select the first pin on initial map open', () => {
    render(
      <MobileMap
        profile={profile}
        listings={[listing('a'), listing('b'), listing('c')]}
        selectedId={null}
        stages={stages}
        stage="triage"
        onStageChange={() => undefined}
        onSelect={() => undefined}
        onOpenProfileSwitcher={() => undefined}
      />
    );

    expect(screen.getByTestId('atlas-map').dataset.selectedId).toBe('');
  });

  it('updates the focused card during swipe scroll without waiting for scrollend', async () => {
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    Object.defineProperty(window.Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    });

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const el = this as HTMLElement;
      if (el.dataset.listingId === 'a') return { left: -278 } as DOMRect;
      if (el.dataset.listingId === 'b') return { left: 12 } as DOMRect;
      if (el.dataset.listingId === 'c') return { left: 302 } as DOMRect;
      return { left: 0 } as DOMRect;
    });

    render(
      <MobileMap
        profile={profile}
        listings={[listing('a'), listing('b'), listing('c')]}
        selectedId="a"
        stages={stages}
        stage="triage"
        onStageChange={() => undefined}
        onSelect={() => undefined}
        onOpenProfileSwitcher={() => undefined}
      />
    );

    const carousel = document.querySelector('.atlas-no-scrollbar') as HTMLElement;
    expect(carousel).toBeTruthy();

    act(() => {
      fireEvent.pointerDown(carousel);
      fireEvent.scroll(carousel);
    });

    await waitFor(() => expect(screen.getByTestId('atlas-map').dataset.selectedId).toBe('b'));

    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
  });

  it('uses a white pill background for cards and dims non-focused ones', () => {
    Object.defineProperty(window.Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    });

    render(
      <MobileMap
        profile={profile}
        listings={[listing('a'), listing('b')]}
        selectedId="b"
        stages={stages}
        stage="triage"
        onStageChange={() => undefined}
        onSelect={() => undefined}
        onOpenProfileSwitcher={() => undefined}
      />
    );

    const focusedWrapper = document.querySelector('[data-listing-id="b"]') as HTMLElement;
    const focusedCard = focusedWrapper.firstElementChild as HTMLElement;
    expect(focusedCard).toBeTruthy();
    expect(focusedCard.style.background).toBe('var(--atlas-glass-pill-bg)');
    expect(focusedCard.style.outline).toBe('none');
    expect(focusedWrapper.style.opacity).toBe('1');

    const dimmedWrapper = document.querySelector('[data-listing-id="a"]') as HTMLElement;
    const dimmedCard = dimmedWrapper.firstElementChild as HTMLElement;
    expect(dimmedCard.style.background).toBe('var(--atlas-glass-pill-bg)');
    expect(dimmedWrapper.style.opacity).toBe('0.5');
  });

  it('focuses a tapped map pin before opening detail after a short delay', () => {
    vi.useFakeTimers();
    Object.defineProperty(window.Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    });
    const onSelect = vi.fn();

    render(
      <MobileMap
        profile={profile}
        listings={[listing('a'), listing('b'), listing('c')]}
        selectedId={null}
        stages={stages}
        stage="triage"
        onStageChange={() => undefined}
        onSelect={onSelect}
        onOpenProfileSwitcher={() => undefined}
      />
    );

    fireEvent.click(screen.getByTestId('map-pin-b'));

    expect(screen.getByTestId('atlas-map').dataset.selectedId).toBe('b');
    expect(onSelect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
