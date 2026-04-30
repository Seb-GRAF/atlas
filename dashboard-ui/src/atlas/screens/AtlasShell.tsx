import { useMemo } from 'react';
import { AtlasMap, type AtlasMapPin, MapControls } from '../components';
import { useAtlasMutations, useAtlasState } from '../data/hooks';
import { listStages, matchesStage } from '../data/adapt';
import { useAtlasUrlState } from '../url';
import { useScan } from '../scan';
import { TopBar } from './TopBar';
import { ListPanel } from './ListPanel';
import { DetailPanel } from './DetailPanel';
import type { AtlasListing, AtlasListingStatus } from '../types';

const VEVEY_FALLBACK = { lat: 46.47, lon: 6.84, zoom: 11 };

export function AtlasShell() {
  const { listings, profile, isLoading, error } = useAtlasState();
  const { setStatus, togglePin, dismiss } = useAtlasMutations();
  const [urlState, updateUrl] = useAtlasUrlState();
  const { scan, start: startScan } = useScan();

  const stages = useMemo(() => listStages(listings), [listings]);

  const filtered = useMemo(
    () =>
      listings
        .filter((l) => matchesStage(l, urlState.stage))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [listings, urlState.stage]
  );

  const selected: AtlasListing | null = useMemo(
    () => listings.find((l) => l.id === urlState.listing) ?? null,
    [listings, urlState.listing]
  );

  const pins = useMemo<AtlasMapPin[]>(
    () =>
      filtered
        .filter((l) => l.lat != null && l.lon != null && l.totalChf != null)
        .map((l) => ({ id: l.id, lat: l.lat as number, lon: l.lon as number, totalChf: l.totalChf as number })),
    [filtered]
  );

  const initialCenter = profile.workplaceCoords
    ? { lat: profile.workplaceCoords.lat, lon: profile.workplaceCoords.lon, zoom: 11 }
    : VEVEY_FALLBACK;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--atlas-bg)',
        fontFamily: 'var(--atlas-sans)',
        color: 'var(--atlas-ink)'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <AtlasMap
          pins={pins}
          selectedId={urlState.listing}
          onSelect={(id) => updateUrl({ listing: id })}
          showWorkplace={!!profile.workplaceCoords}
          workplaceLabel={profile.workplace ? `Travail · ${profile.workplace}` : 'Travail'}
          workplace={profile.workplaceCoords ?? undefined}
          initialCenter={initialCenter}
        />
      </div>

      <TopBar
        profileTitle={profile.shortTitle}
        zones={profile.zones}
        query=""
        onQueryChange={() => {
          /* search wired in a later phase */
        }}
        stages={stages}
        stage={urlState.stage}
        onStageChange={(stage) => updateUrl({ stage, listing: null })}
        onOpenSettings={() => {
          /* phase 4 */
        }}
        onScan={() => startScan()}
        scanning={!!scan && scan.status === 'running'}
      />

      <ListPanel
        zones={profile.zones}
        listings={filtered}
        selectedId={urlState.listing}
        onSelect={(id) => updateUrl({ listing: id })}
        generatedAt={profile.generatedAt}
      />

      {selected ? (
        <DetailPanel
          listing={selected}
          onTogglePin={(id) => togglePin.mutate(id)}
          onStatusChange={(id, status: AtlasListingStatus) =>
            setStatus.mutate({ id, status, notes: selected.notes })
          }
          onNotesChange={(id, notes) => setStatus.mutate({ id, status: selected.status, notes })}
          onDismiss={(id) => {
            dismiss.mutate(id);
            updateUrl({ listing: null });
          }}
        />
      ) : null}

      <MapControls
        style={{ position: 'absolute', right: 432, bottom: 24, zIndex: 4 }}
      />

      {isLoading ? <LoadingIndicator /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--atlas-glass-pill-bg)',
        backdropFilter: 'var(--atlas-glass-pill-blur)',
        WebkitBackdropFilter: 'var(--atlas-glass-pill-blur)',
        boxShadow: 'var(--atlas-shadow-1)',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 12,
        color: 'var(--atlas-ink-2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 5
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          border: '2px solid transparent',
          borderTopColor: 'var(--atlas-ember)',
          animation: 'v2spin 1s linear infinite',
          display: 'inline-block'
        }}
      />
      Chargement…
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--atlas-paper)',
        boxShadow: 'var(--atlas-shadow-2)',
        padding: '10px 16px',
        borderRadius: 12,
        fontSize: 13,
        color: 'var(--atlas-bad)',
        zIndex: 5,
        maxWidth: 480
      }}
    >
      {message}
    </div>
  );
}
