import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAtlasMutations, useAtlasState } from '../../data/hooks';
import { listStages, matchesStage } from '../../data/adapt';
import { useAtlasUrlState } from '../../url';
import { useScan } from '../../scan';
import type { AtlasListing, AtlasListingStatus } from '../../types';
import { MobileList } from './MobileList';
import { MobileMap } from './MobileMap';
import { MobileDetailSheet } from './MobileDetailSheet';
import { MobileTabBar, type MobileTab } from './MobileTabBar';

type Mode = 'list' | 'map' | 'detail';

const rootStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--atlas-bg)',
  color: 'var(--atlas-ink)',
  fontFamily: 'var(--atlas-sans)',
  overflow: 'hidden'
};

export function MobileShell() {
  const { listings, profile, isLoading, error } = useAtlasState();
  const { setStatus, togglePin, dismiss } = useAtlasMutations();
  const [urlState, updateUrl] = useAtlasUrlState();
  const { scan, start: startScan } = useScan();

  const [mode, setMode] = useState<Mode>(urlState.listing ? 'detail' : 'list');
  // Tracks the screen behind the sheet so the user returns to it on close.
  const [priorMode, setPriorMode] = useState<'list' | 'map'>('list');

  // Sync mode when URL listing param changes externally (e.g. back/forward).
  useEffect(() => {
    if (urlState.listing) {
      setMode('detail');
    } else {
      setMode((current) => (current === 'detail' ? priorMode : current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlState.listing]);

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

  const handleSelect = (id: string) => {
    setPriorMode(mode === 'map' ? 'map' : 'list');
    updateUrl({ listing: id });
    setMode('detail');
  };

  const handleCloseDetail = () => {
    updateUrl({ listing: null });
    setMode(priorMode);
  };

  const handleTabSelect = (tab: MobileTab) => {
    if (tab === 'list') {
      if (urlState.listing) updateUrl({ listing: null });
      setMode('list');
      setPriorMode('list');
    } else if (tab === 'map') {
      if (urlState.listing) updateUrl({ listing: null });
      setMode('map');
      setPriorMode('map');
    }
    // 'filters' — phase 6 will implement the filter sheet.
  };

  const activeTab: MobileTab = mode === 'map' ? 'map' : 'list';

  // Render the prior screen behind the detail sheet so the map stays
  // visible when the user opened detail from M2.
  const backgroundMode: 'list' | 'map' = mode === 'detail' ? priorMode : (mode as 'list' | 'map');

  return (
    <div style={rootStyle}>
      {backgroundMode === 'map' ? (
        <MobileMap
          profile={profile}
          listings={filtered}
          selectedId={urlState.listing}
          stages={stages}
          stage={urlState.stage}
          onStageChange={(stage) => updateUrl({ stage, listing: null })}
          onSelect={handleSelect}
          onOpenList={() => {
            setMode('list');
            setPriorMode('list');
          }}
        />
      ) : (
        <MobileList
          profile={profile}
          listings={filtered}
          stages={stages}
          stage={urlState.stage}
          onStageChange={(stage) => updateUrl({ stage, listing: null })}
          onSelect={handleSelect}
          onOpenMap={() => {
            setMode('map');
            setPriorMode('map');
          }}
          onScan={() => startScan()}
          scanning={!!scan && scan.status === 'running'}
        />
      )}

      {mode === 'detail' && selected ? (
        <MobileDetailSheet
          listing={selected}
          onClose={handleCloseDetail}
          onTogglePin={(id) => togglePin.mutate(id)}
          onStatusChange={(id, status: AtlasListingStatus) =>
            setStatus.mutate({ id, status, notes: selected.notes })
          }
          onNotesChange={(id, notes) =>
            setStatus.mutate({ id, status: selected.status, notes })
          }
          onDismiss={(id) => {
            dismiss.mutate(id);
            handleCloseDetail();
          }}
        />
      ) : null}

      {mode !== 'detail' ? (
        <MobileTabBar
          active={activeTab}
          onSelect={handleTabSelect}
          counts={{ newCount: profile.newCount }}
        />
      ) : null}

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
        bottom: 96,
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
        zIndex: 10
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
        bottom: 96,
        left: 16,
        right: 16,
        background: 'var(--atlas-paper)',
        boxShadow: 'var(--atlas-shadow-2)',
        padding: '10px 16px',
        borderRadius: 12,
        fontSize: 13,
        color: 'var(--atlas-bad)',
        zIndex: 10
      }}
    >
      {message}
    </div>
  );
}
