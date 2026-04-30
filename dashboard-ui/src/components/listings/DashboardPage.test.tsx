import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apartmentOpsTheme } from '../../app/theme';
import { DashboardPage } from './DashboardPage';

const listingsApi = vi.hoisted(() => ({
  cancelProfileScan: vi.fn(),
  deleteListing: vi.fn(),
  getDashboardState: vi.fn(),
  getProfileScanStatus: vi.fn(),
  startProfileScan: vi.fn(),
  toggleListingPin: vi.fn(),
  updateListingStatus: vi.fn()
}));

vi.mock('../../api/listings', () => listingsApi);
vi.mock('../../api/profiles', () => ({
  getProfileDetail: vi.fn()
}));
vi.mock('./ApartmentMap', () => ({
  ApartmentMap: () => <div data-testid="apartment-map" />
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <MantineProvider theme={apartmentOpsTheme} defaultColorScheme="light" forceColorScheme="light">
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </MantineProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('min-width: 961px'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

  listingsApi.getDashboardState.mockResolvedValue({
    profile: 'test-profile',
    tracker: {
      statuses: ['À trier', 'À contacter', 'Contacté'],
      listings: [
        {
          id: 'listing-1',
          title: 'Appartement lumineux',
          area: 'Lausanne',
          totalChf: 2100,
          rooms: 3,
          surfaceM2: 72,
          status: 'À trier',
          firstSeenAt: '2026-04-29T12:00:00Z',
          updatedAt: '2026-04-29T12:00:00Z',
          publishedAt: '2026-04-29T12:00:00Z'
        }
      ]
    },
    latest: {
      generatedAt: '2026-04-29T12:00:00Z',
      newCount: 1
    },
    filters: {
      minTotalChf: 1500,
      maxTotalChf: 2200,
      maxTotalHardChf: 2300
    },
    map: {
      workplace: null,
      listingsWithCoordinates: 0,
      listingsMissingCoordinates: 426,
      warnings: []
    }
  });
});

describe('DashboardPage marketplace link', () => {
  it('uses the full desktop Marketplace search URL on desktop', async () => {
    renderDashboard();

    const marketplaceLink = await screen.findByRole('link', { name: 'Ouvrir Facebook Marketplace' });
    const marketplaceUrl = new URL(marketplaceLink.getAttribute('href') || '');

    expect(marketplaceUrl.origin).toBe('https://www.facebook.com');
    expect(marketplaceUrl.pathname).toBe('/marketplace/108211865877609/search/');
    expect(marketplaceUrl.searchParams.get('minPrice')).toBe('1500');
    expect(marketplaceUrl.searchParams.get('maxPrice')).toBe('2300');
    expect(marketplaceUrl.searchParams.get('query')).toBe('louer appartement');
    expect(marketplaceUrl.searchParams.get('sortBy')).toBe('creation_time_descend');
  });

  it('uses the mobile Marketplace search route on mobile with profile filters and recent sort', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: !query.includes('min-width: 961px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    renderDashboard();

    const marketplaceLink = await screen.findByRole('link', { name: 'Ouvrir Facebook Marketplace' });
    const marketplaceUrl = new URL(marketplaceLink.getAttribute('href') || '');

    expect(marketplaceUrl.origin).toBe('https://m.facebook.com');
    expect(marketplaceUrl.pathname).toBe('/marketplace/search/');
    expect(marketplaceUrl.searchParams.get('minPrice')).toBe('1500');
    expect(marketplaceUrl.searchParams.get('maxPrice')).toBe('2300');
    expect(marketplaceUrl.searchParams.get('query')).toBe('louer appartement');
    expect(marketplaceUrl.searchParams.get('sortBy')).toBe('creation_time_descend');
  });
});

describe('DashboardPage listing details', () => {
  it('expands the selected listing inside its card and collapses it when selected again', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const listingButton = await screen.findByRole('button', { name: /3 pièces à Lausanne, CHF/i });
    const listingCard = listingButton.closest('.listing-list-card');
    expect(listingCard).toBeInstanceOf(HTMLElement);
    expect(within(listingCard as HTMLElement).queryByText('Annonce sélectionnée')).toBeNull();

    await user.click(listingButton);

    expect(await within(listingCard as HTMLElement).findByText('Annonce sélectionnée')).toBeTruthy();

    await user.click(listingButton);

    await waitFor(() => {
      expect(within(listingCard as HTMLElement).queryByText('Annonce sélectionnée')).toBeNull();
    });
  });

  it('shows a composed photo mosaic in the selected listing details', async () => {
    const user = userEvent.setup();
    listingsApi.getDashboardState.mockResolvedValueOnce({
      profile: 'test-profile',
      tracker: {
        statuses: ['À trier', 'À contacter', 'Contacté'],
        listings: [
          {
            id: 'listing-with-photos',
            area: 'Lausanne',
            totalChf: 2100,
            rooms: 3,
            surfaceM2: 72,
            status: 'À trier',
            imageUrls: ['/photo-1.jpg', '/photo-2.jpg', '/photo-3.jpg', '/photo-4.jpg'],
            firstSeenAt: '2026-04-29T12:00:00Z',
            updatedAt: '2026-04-29T12:00:00Z',
            publishedAt: '2026-04-29T12:00:00Z'
          }
        ]
      },
      latest: {
        generatedAt: '2026-04-29T12:00:00Z',
        newCount: 1
      },
      map: {
        workplace: null,
        listingsWithCoordinates: 0,
        listingsMissingCoordinates: 1,
        warnings: []
      }
    });

    renderDashboard();

    const listingButton = await screen.findByRole('button', { name: /3 pièces à Lausanne, CHF/i });
    const listingCard = listingButton.closest('.listing-list-card');
    expect(listingCard).toBeInstanceOf(HTMLElement);

    await user.click(listingButton);

    const photoGrid = await within(listingCard as HTMLElement).findByRole('group', { name: 'Photos de l’annonce, 4 images' });
    expect(within(photoGrid).getAllByRole('button', { name: /Voir la photo/i })).toHaveLength(4);
    expect(within(photoGrid).getByRole('button', { name: 'Voir la photo principale de 3 pièces à Lausanne' })).toBeTruthy();
    expect(within(photoGrid).getByRole('button', { name: 'Voir la photo 4 de 3 pièces à Lausanne' }).className).toContain('is-row-fill');
    expect(within(photoGrid).getByRole('img', { name: 'Photo 1 de 3 pièces à Lausanne' })).toBeTruthy();
  });

  it('counts missing map coordinates from the visible listings', async () => {
    renderDashboard();

    expect(await screen.findByText('Carte partielle · 1 sans coordonnées')).toBeTruthy();
    expect(screen.queryByText('Carte partielle · 426 sans coordonnées')).toBeNull();
  });

  it('does not render a floating selected-listing card over the map', async () => {
    renderDashboard();

    await screen.findByRole('button', { name: /3 pièces à Lausanne/i });

    expect(screen.queryByText('Aucune annonce')).toBeNull();
  });

  it('shows a reopen action for a discarded listing in the closed tab', async () => {
    const user = userEvent.setup();
    listingsApi.getDashboardState.mockResolvedValueOnce({
      profile: 'test-profile',
      tracker: {
        statuses: ['À trier', 'À contacter', 'Contacté', 'Écartée'],
        listings: [
          {
            id: 'dismissed-listing',
            title: 'Appartement écarté',
            area: 'Lausanne',
            totalChf: 1950,
            rooms: 2,
            surfaceM2: 54,
            status: 'Écartée',
            notes: 'pas intéressé',
            firstSeenAt: '2026-04-28T12:00:00Z',
            updatedAt: '2026-04-29T12:00:00Z',
            publishedAt: '2026-04-28T12:00:00Z'
          }
        ]
      },
      latest: {
        generatedAt: '2026-04-29T12:00:00Z',
        newCount: 0
      },
      map: {
        workplace: null,
        listingsWithCoordinates: 0,
        listingsMissingCoordinates: 1,
        warnings: []
      }
    });

    renderDashboard();

    await user.click(await screen.findByText('Clos (1)'));
    await user.click(await screen.findByRole('button', { name: /2 pièces à Lausanne/i }));
    await user.click(await screen.findByRole('button', { name: 'Réouvrir' }));

    expect(listingsApi.updateListingStatus).toHaveBeenCalledWith(
      'test-profile',
      'dismissed-listing',
      'À contacter',
      'pas intéressé',
      { reopen: true }
    );
  });

  it('renders the map as a compact supporting panel on desktop', async () => {
    renderDashboard();

    const mapPanel = await screen.findByTestId('listing-map-panel');

    expect(mapPanel.className).toContain('listing-map-panel');
  });

  it('shows the floating map action on desktop when grid view is enabled', async () => {
    const user = userEvent.setup();
    renderDashboard();

    expect(await screen.findByTestId('listing-map-panel')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carte' })).toBeNull();

    await user.click(await screen.findByLabelText('Vue grille'));

    await waitFor(() => {
      expect(screen.queryByTestId('listing-map-panel')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Carte' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Carte' }));

    expect(await screen.findByTestId('apartment-map')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer la carte' })).toBeTruthy();
  });

  it('opens listing details in a drawer instead of an inline accordion in grid view', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByLabelText('Vue grille'));
    const listingButton = await screen.findByRole('button', { name: /3 pièces à Lausanne/i });
    const listingCard = listingButton.closest('.listing-list-card');
    expect(listingCard).toBeInstanceOf(HTMLElement);

    await user.click(listingButton);

    expect(await screen.findByRole('dialog', { name: 'Détail de l’annonce' })).toBeTruthy();
    expect(within(listingCard as HTMLElement).queryByText('Annonce sélectionnée')).toBeNull();
  });
});
