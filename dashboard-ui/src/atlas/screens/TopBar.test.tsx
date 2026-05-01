import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';
import type { AtlasStage } from '../types';

const stages: AtlasStage[] = [
  { value: 'triage', label: 'A trier', count: 2 },
  { value: 'active', label: 'En cours', count: 1 },
  { value: 'visits', label: 'Visites', count: 0 },
  { value: 'done', label: 'Clos', count: 0 }
];

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

function renderTopBar(overrides: Partial<ComponentProps<typeof TopBar>> = {}) {
  return renderWithClient(
    <TopBar
      profileSlug="vaud-3-pieces"
      profileTitle="Vaud"
      zones={['Vevey']}
      query=""
      onQueryChange={() => undefined}
      stages={stages}
      stage="triage"
      onStageChange={() => undefined}
      onOpenSettings={() => undefined}
      onScan={() => undefined}
      scanning={false}
      onProfileSelect={() => undefined}
      {...overrides}
    />
  );
}

function responseJson(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(payload))
  } as Response;
}

describe('TopBar profile chooser', () => {
  it('opens a chooser, highlights the active profile, and switches to another profile', async () => {
    const onProfileSelect = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          responseJson({
            profiles: [
              { slug: 'vaud-3-pieces', shortTitle: 'Vaud', listingsCount: 4 },
              { slug: 'fribourg', shortTitle: 'Fribourg', listingsCount: 2 }
            ]
          })
        )
      )
    );

    renderTopBar({ onProfileSelect });

    fireEvent.click(screen.getByRole('button', { name: /choisir un profil/i }));

    expect(await screen.findByRole('menu')).toBeTruthy();
    expect(await screen.findByText('Actif')).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: /fribourg/i }));

    expect(onProfileSelect).toHaveBeenCalledWith('fribourg');
  });

  it('opens profile creation in a dashboard modal with price and room sliders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(responseJson({ profiles: [] })))
    );

    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: /choisir un profil/i }));

    fireEvent.click(await screen.findByRole('menuitem', { name: /nouveau profil/i }));

    expect(await screen.findByRole('dialog', { name: /nouveau profil/i })).toBeTruthy();
    expect(screen.getByLabelText(/loyer minimum/i)).toBeTruthy();
    expect(screen.getByLabelText(/loyer maximum/i)).toBeTruthy();
    expect(screen.getByLabelText(/pièces minimum/i)).toBeTruthy();
    expect(screen.getByLabelText(/pièces maximum/i)).toBeTruthy();
  });

  it('opens profile editing from the chooser row', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const path = String(url);
      if (path.startsWith('/api/profile/detail')) {
        return Promise.resolve(
          responseJson({
            ok: true,
            profile: {
              slug: 'fribourg',
              shortTitle: 'Fribourg',
              areas: [{ slug: 'fribourg', label: 'Fribourg', canton: 'fribourg' }],
              sources: { immobilier: true, flatfox: true },
              filters: {
                minTotalChf: 900,
                maxTotalChf: 1600,
                maxTotalHardChf: 1700,
                minRoomsPreferred: 2,
                maxRoomsPreferred: 4,
                minSurfaceM2Preferred: 45,
                allowMissingSurface: true,
                maxPublishedAgeDays: 21
              },
              preferences: { workplaceAddress: 'Lausanne' }
            }
          })
        );
      }
      return Promise.resolve(
        responseJson({
          profiles: [{ slug: 'fribourg', shortTitle: 'Fribourg', areas: 'Fribourg', listingsCount: 2 }]
        })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: /choisir un profil/i }));
    fireEvent.click(await screen.findByRole('button', { name: /modifier fribourg/i }));

    expect(await screen.findByRole('dialog', { name: /modifier le profil/i })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/profile/detail?profile=fribourg', expect.anything());
  });

  it('shows deletion confirmation in the chooser row', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          responseJson({
            profiles: [{ slug: 'vaud-', shortTitle: 'Vaud-', areas: 'Vaud-', listingsCount: 0 }]
          })
        )
      )
    );

    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: /choisir un profil/i }));
    fireEvent.click(await screen.findByRole('button', { name: /supprimer vaud-/i }));

    expect(screen.getByText(/supprimer ce profil et ses données/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^supprimer$/i })).toBeTruthy();
  });

  it('closes the chooser when clicking the active profile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          responseJson({
            profiles: [{ slug: 'vaud-3-pieces', shortTitle: 'Vaud', listingsCount: 4 }]
          })
        )
      )
    );

    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: /choisir un profil/i }));
    const active = await screen.findByRole('menuitem', { name: /vaud/i });

    fireEvent.click(active);

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('closes the chooser from Escape and outside clicks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          responseJson({
            profiles: [{ slug: 'vaud-3-pieces', shortTitle: 'Vaud', listingsCount: 4 }]
          })
        )
      )
    );

    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: /choisir un profil/i }));
    expect(await screen.findByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /choisir un profil/i }));
    expect(await screen.findByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('shows profile loading failures visibly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(responseJson({ error: 'Service indisponible' }, false, 503))
      )
    );

    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: /choisir un profil/i }));

    await waitFor(() => expect(screen.getByText(/impossible de charger les profils/i)).toBeTruthy());
  });
});
