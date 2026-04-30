import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsDrawer } from './SettingsDrawer';
import type { AtlasProfile } from '../types';
import type { ReactNode } from 'react';

vi.mock('vaul', () => ({
  Drawer: {
    Root: ({ children }: { children: ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Overlay: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    Content: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    Title: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />
  }
}));

const profile: AtlasProfile = {
  slug: 'vaud-3-pieces',
  shortTitle: 'Vaud',
  areas: [{ label: 'Vevey', slug: 'vevey', canton: 'vaud' }],
  zones: ['Vevey'],
  workplace: null,
  workplaceCoords: null,
  newCount: 0,
  generatedAt: '',
  budgetMinChf: 1000,
  budgetMaxChf: 1800,
  budgetCeilingChf: 2200,
  roomsMin: 2,
  roomsMax: null,
  enabledSources: {}
};

function geoResponse(label: string, attrs: Record<string, unknown>) {
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        results: [
          {
            attrs: {
              label,
              ...attrs
            }
          }
        ]
      })
  } as Response);
}

describe('SettingsDrawer', () => {
  it('lets users pick a workplace and add a search zone from geo suggestions', async () => {
    const onSave = vi.fn();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const origins = url.searchParams.get('origins');
      if (origins === 'gg25') {
        return geoResponse('Lausanne <b>VD</b>', {
          name: 'Lausanne',
          detail: 'ch.swisstopo-vd',
          origin: 'gg25',
          lat: 46.5197,
          lon: 6.6323
        });
      }
      return geoResponse('EPFL, Route Cantonale, 1015 Lausanne', {
        origin: 'address',
        lat: 46.5183,
        lon: 6.5668
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SettingsDrawer
        profile={profile}
        onClose={() => undefined}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText('Lieu de travail'), { target: { value: 'EPFL' } });
    fireEvent.click(await screen.findByRole('option', { name: /EPFL/i }));

    fireEvent.change(screen.getByLabelText('Ajouter une zone'), { target: { value: 'Lausanne' } });
    fireEvent.click(await screen.findByRole('option', { name: /Lausanne/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as AtlasProfile;
    expect(saved.workplace).toBe('EPFL, Route Cantonale, 1015 Lausanne');
    expect(saved.zones).toContain('Lausanne');
    expect(saved.areas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Lausanne',
          slug: 'lausanne',
          canton: 'vaud',
          cantonAbbr: 'VD',
          lat: 46.5197,
          lon: 6.6323
        })
      ])
    );
  });

  it('shows geo lookup failures visibly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) } as Response))
    );

    render(
      <SettingsDrawer
        profile={profile}
        onClose={() => undefined}
        onSave={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText('Lieu de travail'), { target: { value: 'EPFL' } });

    expect(await screen.findByText('geo.admin.ch 503')).toBeTruthy();
  });

  it('shows save failures visibly', () => {
    render(
      <SettingsDrawer
        profile={profile}
        onClose={() => undefined}
        onSave={() => undefined}
        error="Impossible de modifier le profil"
      />
    );

    expect(screen.getByText('Impossible de modifier le profil')).toBeTruthy();
  });
});
