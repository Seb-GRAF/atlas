import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAtlasMutations, useAtlasState } from '../../data/hooks';
import { listStages, matchesStage, sortListings } from '../../data/adapt';
import { useAtlasUrlState } from '../../url';
import { useScan } from '../../scan';
import type { AtlasListing, AtlasListingStatus, RouteOverlay } from '../../types';
import { buildTransitRouteOverlay } from '../../data/routeViz';
import { MobileList } from './MobileList';
import { MobileMap } from './MobileMap';
import { MobileDetailSheet } from './MobileDetailSheet';
import { MobileScanSheet } from './MobileScanSheet';
import { CommuteProgressBanner } from '../CommuteProgressBanner';
import { MobileTabBar, type MobileTab } from './MobileTabBar';
import { ProfileSwitcherSheet } from './ProfileSwitcherSheet';
import { UndoToast } from '../UndoToast';
import { usePendingDismissals } from '../usePendingDismissals';
import { getActiveProfileSlug } from '../../profileRouting';

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
  const activeProfileSlug = getActiveProfileSlug();
  const { listings, profile, isLoading, error } = useAtlasState(activeProfileSlug);
  const { setStatus, togglePin, dismiss } = useAtlasMutations(profile.slug, activeProfileSlug);
  const [urlState, updateUrl] = useAtlasUrlState();
  const { scan, jobId, start: startScan, cancel: cancelScan } = useScan(activeProfileSlug);

  const [mode, setMode] = useState<Mode>(urlState.listing ? 'detail' : 'list');
  // Tracks the screen behind the sheet so the user returns to it on close.
  const [priorMode, setPriorMode] = useState<'list' | 'map'>('list');
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);
  // Sheet visibility is decoupled from URL selection: a user may keep a
  // listing selected (so the route overlay stays drawn on the map) while
  // closing the bottom sheet to actually see the map.
  const [sheetOpen, setSheetOpen] = useState(!!urlState.listing);
  const [routeOverlay, setRouteOverlay] = useState<RouteOverlay | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [scanSheetOpen, setScanSheetOpen] = useState(false);
  // Tracks the last scan job we auto-opened the sheet for. Without this, the
  // 2s status poll would re-open the sheet right after the user dismissed it.
  const lastShownJobIdRef = useRef<string | null>(null);
  const autoCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!jobId) return;
    if (scan?.status !== 'running') return;
    if (lastShownJobIdRef.current === jobId) return;
    // Don't steal focus from an open detail sheet — the labeled pill keeps
    // the user aware; they can open the scan sheet manually after.
    if (sheetOpen) return;
    lastShownJobIdRef.current = jobId;
    setScanSheetOpen(true);
  }, [jobId, scan?.status, sheetOpen]);

  useEffect(() => {
    if (scan?.status !== 'done' || !scanSheetOpen) return;
    autoCloseTimerRef.current = window.setTimeout(() => {
      setScanSheetOpen(false);
    }, 4000);
    return () => {
      if (autoCloseTimerRef.current != null) {
        window.clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [scan?.status, scanSheetOpen]);

  const scanRunning = !!scan && scan.status === 'running';
  const handleScanClick = useCallback(() => {
    if (scanRunning) {
      setScanSheetOpen(true);
    } else {
      startScan();
    }
  }, [scanRunning, startScan]);
  const handleScanCancel = useCallback(async () => {
    await cancelScan();
    setScanSheetOpen(false);
  }, [cancelScan]);

  // Sync mode when URL listing param changes externally (e.g. back/forward).
  useEffect(() => {
    if (urlState.listing) {
      setMode(sheetOpen ? 'detail' : priorMode);
    } else {
      setMode((current) => (current === 'detail' ? priorMode : current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlState.listing, sheetOpen]);

  const dismissCallback = useCallback((id: string) => dismiss.mutate(id), [dismiss]);
  const {
    pendingIds,
    pendingCount,
    restoringIds: restoringPendingIds,
    schedule: schedulePending,
    undoAll: undoPending
  } = usePendingDismissals(dismissCallback);

  const visibleListings = useMemo(
    () => (pendingIds.size === 0 ? listings : listings.filter((l) => !pendingIds.has(l.id))),
    [listings, pendingIds]
  );

  const stages = useMemo(() => listStages(visibleListings), [visibleListings]);

  const stageScoped = useMemo(
    () => visibleListings.filter((l) => matchesStage(l, urlState.stage)),
    [visibleListings, urlState.stage]
  );

  const filtered = useMemo(() => {
    const sourceSet = urlState.sources.length > 0 ? new Set(urlState.sources) : null;
    const scoped = sourceSet
      ? stageScoped.filter((l) => sourceSet.has(String(l.source)))
      : stageScoped;
    return sortListings(scoped, urlState.sort);
  }, [stageScoped, urlState.sort, urlState.sources]);

  // Keep pending items in the rendered list so they animate to height 0
  // instead of jumping. They are still excluded from `filtered` (and from
  // selection / map pins / stage counts).
  const filteredForList = useMemo(() => {
    if (pendingIds.size === 0) return filtered;
    const sourceSet = urlState.sources.length > 0 ? new Set(urlState.sources) : null;
    const pendingMembers = listings.filter(
      (l) =>
        pendingIds.has(l.id) &&
        matchesStage(l, urlState.stage) &&
        (!sourceSet || sourceSet.has(String(l.source)))
    );
    if (pendingMembers.length === 0) return filtered;
    return sortListings([...filtered, ...pendingMembers], urlState.sort);
  }, [filtered, listings, pendingIds, urlState.stage, urlState.sort, urlState.sources]);

  const selected: AtlasListing | null = useMemo(
    () => listings.find((l) => l.id === urlState.listing) ?? null,
    [listings, urlState.listing]
  );

  // Drop the route when the user switches to a different listing or
  // deselects entirely. Mirrors desktop behavior.
  useEffect(() => {
    if (!selected || (routeOverlay && routeOverlay.listingId !== selected.id)) {
      setRouteOverlay(null);
      setRouteLoading(false);
      setRouteError(null);
    }
  }, [selected, routeOverlay]);

  const handleVisualizeRoute = useCallback(async () => {
    if (!selected) return;
    if (routeOverlay && routeOverlay.listingId === selected.id) {
      setRouteOverlay(null);
      setRouteError(null);
      return;
    }
    // Hide the sheet so the user can actually see the route on the map; the
    // listing stays selected, the route stays drawn. priorMode must flip to
    // 'map' so the urlState/sheetOpen sync effect doesn't snap back to list.
    setSheetOpen(false);
    setPriorMode('map');
    setMode('map');
    if (selected.transitRouteOverlay && selected.transitRouteOverlay.legs.length > 0) {
      setRouteOverlay(selected.transitRouteOverlay);
      setRouteError(null);
      return;
    }
    if (!selected.transitRoute || selected.transitRoute.legs.length === 0) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const overlay = await buildTransitRouteOverlay(
        selected.id,
        selected.transitRoute,
        selected.lat != null && selected.lon != null
          ? { lat: selected.lat, lon: selected.lon }
          : null
      );
      setRouteOverlay(overlay);
    } catch (err) {
      setRouteError(`Impossible de tracer le trajet: ${(err as Error).message}`);
    } finally {
      setRouteLoading(false);
    }
  }, [selected, routeOverlay]);

  const handleSelect = (id: string) => {
    setPriorMode(mode === 'map' ? 'map' : 'list');
    updateUrl({ listing: id });
    setSheetOpen(true);
    setMode('detail');
  };

  // The sheet's drag-to-dismiss only hides the sheet — when opened from the
  // map, the listing stays selected so the route overlay remains drawn.
  // When opened from the list, dismissing returns the user to the list.
  const handleHideSheet = () => {
    setSheetOpen(false);
    if (priorMode === 'list') {
      updateUrl({ listing: null });
      setRouteOverlay(null);
      setRouteError(null);
    }
    setMode(priorMode);
  };

  const handleFullClose = useCallback(() => {
    updateUrl({ listing: null });
    setSheetOpen(false);
    setRouteOverlay(null);
    setRouteError(null);
    setMode(priorMode);
  }, [updateUrl, priorMode]);

  const handleReopenSheet = () => {
    setSheetOpen(true);
    setMode('detail');
  };

  const handleArchive = useCallback(
    (id: string) => {
      if (urlState.listing === id) {
        const idx = filtered.findIndex((l) => l.id === id);
        const next = idx >= 0 ? filtered[idx + 1] ?? filtered[idx - 1] ?? null : null;
        if (next) {
          updateUrl({ listing: next.id });
          setRouteOverlay(null);
          setRouteError(null);
        } else {
          handleFullClose();
        }
      }
      schedulePending(id);
    },
    [filtered, schedulePending, updateUrl, urlState.listing, handleFullClose]
  );

  const handleArchiveAll = useCallback(() => {
    if (filtered.length === 0) return;
    if (urlState.listing && filtered.some((l) => l.id === urlState.listing)) {
      handleFullClose();
    }
    for (const l of filtered) schedulePending(l.id);
  }, [filtered, schedulePending, urlState.listing, handleFullClose]);

  const handleTabSelect = (tab: MobileTab) => {
    if (tab === 'list') {
      if (urlState.listing) updateUrl({ listing: null });
      setSheetOpen(false);
      setRouteOverlay(null);
      setRouteError(null);
      setMode('list');
      setPriorMode('list');
    } else if (tab === 'map') {
      if (urlState.listing) updateUrl({ listing: null });
      setSheetOpen(false);
      setRouteOverlay(null);
      setRouteError(null);
      setMode('map');
      setPriorMode('map');
    }
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
          onOpenProfileSwitcher={() => setProfileSwitcherOpen(true)}
          routeOverlay={routeOverlay}
          sourceListings={stageScoped}
          sources={urlState.sources}
          onSourcesChange={(sources) => updateUrl({ sources, listing: null })}
        />
      ) : (
        <MobileList
          profile={profile}
          listings={filteredForList}
          onArchive={handleArchive}
          onArchiveAll={handleArchiveAll}
          pendingIds={pendingIds}
          restoringIds={restoringPendingIds}
          stages={stages}
          stage={urlState.stage}
          onStageChange={(stage) => updateUrl({ stage, listing: null })}
          onSelect={handleSelect}
          onScan={handleScanClick}
          scanning={scanRunning}
          onOpenProfileSwitcher={() => setProfileSwitcherOpen(true)}
          sort={urlState.sort}
          onSortChange={(sort) => updateUrl({ sort })}
          scanStatus={<CommuteProgressBanner scan={scan} />}
          sourceListings={stageScoped}
          sources={urlState.sources}
          onSourcesChange={(sources) => updateUrl({ sources, listing: null })}
        />
      )}

      <ProfileSwitcherSheet
        open={profileSwitcherOpen}
        onClose={() => setProfileSwitcherOpen(false)}
        activeSlug={activeProfileSlug}
      />

      <MobileDetailSheet
        listing={mode === 'detail' && sheetOpen ? selected : null}
        onClose={handleHideSheet}
        onTogglePin={(id) => togglePin.mutate(id)}
        onStatusChange={(id, status: AtlasListingStatus) => {
          if (!selected) return;
          setStatus.mutate({ id, status, notes: selected.notes });
        }}
        onNotesChange={(id, notes) => {
          if (!selected) return;
          setStatus.mutate({ id, status: selected.status, notes });
        }}
        onDismiss={(id) => {
          const idx = filtered.findIndex((l) => l.id === id);
          const nextListing =
            idx >= 0 ? filtered[idx + 1] ?? filtered[idx - 1] ?? null : null;
          dismiss.mutate(id);
          if (nextListing) {
            updateUrl({ listing: nextListing.id });
            setRouteOverlay(null);
            setRouteError(null);
          } else {
            handleFullClose();
          }
        }}
        onVisualizeRoute={handleVisualizeRoute}
        routeVisualizing={!!routeOverlay && !!selected && routeOverlay.listingId === selected.id}
        routeLoading={routeLoading}
      />

      <MobileScanSheet
        open={scanSheetOpen}
        onClose={() => setScanSheetOpen(false)}
        scan={scan}
        profile={profile}
        onCancel={handleScanCancel}
      />

      {/* Floating pills shown when a listing is selected but the sheet is
          hidden — lets the user reopen detail or fully clear selection. */}
      {urlState.listing && !sheetOpen ? (
        <SelectionPills onReopen={handleReopenSheet} onClose={handleFullClose} />
      ) : null}

      {routeError ? <RouteErrorToast message={routeError} /> : null}

      {mode !== 'detail' && !urlState.listing ? (
        <MobileTabBar
          active={activeTab}
          onSelect={handleTabSelect}
          counts={{ newCount: profile.newCount }}
        />
      ) : null}

      {pendingCount > 0 ? (
        <UndoToast count={pendingCount} onUndo={undoPending} bottomOffset={88} />
      ) : null}

      {isLoading ? <LoadingIndicator /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}
    </div>
  );
}

function SelectionPills({ onReopen, onClose }: { onReopen: () => void; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: `calc(env(safe-area-inset-bottom, 16px) + 16px)`,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        padding: '0 12px',
        pointerEvents: 'none'
      }}
    >
      <button
        type="button"
        onClick={onReopen}
        style={{
          pointerEvents: 'auto',
          background: 'var(--atlas-ink)',
          color: '#fff',
          border: 0,
          padding: '10px 16px',
          borderRadius: 999,
          fontFamily: 'var(--atlas-sans)',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          boxShadow: '0 8px 22px rgba(22,20,15,.28)',
          cursor: 'pointer'
        }}
      >
        Voir les détails
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        style={{
          pointerEvents: 'auto',
          background: 'var(--atlas-paper)',
          color: 'var(--atlas-ink)',
          border: 0,
          padding: '10px 14px',
          borderRadius: 999,
          fontFamily: 'var(--atlas-sans)',
          fontSize: 13,
          fontWeight: 500,
          boxShadow: '0 6px 18px rgba(22,20,15,.20), 0 0 0 1px var(--atlas-line)',
          cursor: 'pointer'
        }}
      >
        Fermer
      </button>
    </div>
  );
}

function RouteErrorToast({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 96,
        left: 16,
        right: 16,
        background: 'var(--atlas-paper)',
        boxShadow: 'var(--atlas-shadow-2), 0 0 0 1px var(--atlas-line)',
        padding: '8px 14px',
        borderRadius: 12,
        fontSize: 12,
        color: 'var(--atlas-ink-2)',
        zIndex: 10,
        textAlign: 'center'
      }}
    >
      {message}
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
