import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AtlasMap,
  GlassPanel,
  GlassPill,
  Icons,
  MapControls,
  Mono,
  formatCHF,
  type AtlasMapHandle,
  type AtlasMapPin
} from '../../components';
import { loadBasemap, saveBasemap, type Basemap } from '../../mapPrefs';
import type {
  AtlasListing,
  AtlasProfile,
  AtlasStage,
  AtlasStageValue,
  RouteOverlay
} from '../../types';

const VEVEY_FALLBACK = { lat: 46.47, lon: 6.84, zoom: 11 };

type MobileMapProps = {
  profile: AtlasProfile;
  listings: AtlasListing[];
  selectedId: string | null;
  stages: AtlasStage[];
  stage: AtlasStageValue;
  onStageChange: (stage: AtlasStageValue) => void;
  onSelect: (id: string) => void;
  onOpenFilters: () => void;
  routeOverlay?: RouteOverlay | null;
};

const rootStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--atlas-bg)',
  fontFamily: 'var(--atlas-sans)',
  color: 'var(--atlas-ink)',
  overflow: 'hidden'
};

const topBarStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
  left: 12,
  right: 12,
  zIndex: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

const chipsRowStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
  left: 0,
  right: 0,
  zIndex: 5,
  display: 'flex',
  gap: 6,
  padding: '0 12px',
  overflowX: 'auto',
  pointerEvents: 'auto'
};

export function MobileMap({
  profile,
  listings,
  selectedId,
  stages,
  stage,
  onStageChange,
  onSelect,
  onOpenFilters,
  routeOverlay
}: MobileMapProps) {
  const mapHandle = useRef<AtlasMapHandle>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [basemap, setBasemap] = useState<Basemap>(() => loadBasemap());
  const changeBasemap = useCallback((next: Basemap) => {
    setBasemap(next);
    saveBasemap(next);
  }, []);
  // The carousel-driven focus is local: swiping highlights a pin and pans the
  // map without opening the detail sheet. Tapping a card or pin still calls
  // `onSelect` which lifts to the URL and opens detail.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Suppress the IntersectionObserver while we're programmatically scrolling
  // the carousel (e.g. pin tap → scroll mini-card into view) so it doesn't
  // bounce focus back to whatever passes the centerline mid-animation.
  const suppressObserverRef = useRef(false);

  const visible = useMemo(
    () => listings.filter((l) => l.lat != null && l.lon != null && l.totalChf != null),
    [listings]
  );

  const pins = useMemo<AtlasMapPin[]>(
    () =>
      visible.map((l) => ({
        id: l.id,
        lat: l.lat as number,
        lon: l.lon as number,
        totalChf: l.totalChf as number,
        precision: l.locationPrecision
      })),
    [visible]
  );

  const initialCenter = profile.workplaceCoords
    ? { lat: profile.workplaceCoords.lat, lon: profile.workplaceCoords.lon, zoom: 11 }
    : VEVEY_FALLBACK;

  const carouselListings = useMemo(() => visible.slice(0, 12), [visible]);

  // Mirror URL selection into local focus so the carousel scrolls to the right
  // card on back/forward and on detail-sheet open. We deliberately don't
  // auto-focus the first listing on mount — that would trump the initial
  // fitBounds in AtlasMap and zoom into a single pin.
  useEffect(() => {
    if (selectedId) setFocusedId(selectedId);
  }, [selectedId]);

  // Drop a stale focus if the underlying listing leaves the carousel (e.g.
  // stage filter change).
  useEffect(() => {
    setFocusedId((current) => {
      if (!current) return null;
      return carouselListings.some((l) => l.id === current) ? current : null;
    });
  }, [carouselListings]);

  // Carousel → map: only commit a new focus once scrolling has settled. We
  // wait for the native `scrollend` event when available, falling back to a
  // 140ms debounce after the last scroll tick. Reacting mid-inertia would
  // otherwise pan the map repeatedly through every card the swipe passes.
  useEffect(() => {
    const root = carouselRef.current;
    if (!root || carouselListings.length === 0) return;

    const computeNearest = (): string | null => {
      const rootRect = root.getBoundingClientRect();
      // Match the card snap alignment (start), padded by `scrollPaddingLeft`.
      // Anchor on the card's left edge instead of its center so the picked
      // card matches the snap point, not the visually-centered one.
      const anchor = rootRect.left + 12;
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const [id, el] of cardRefs.current) {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.left - anchor);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = id;
        }
      }
      return bestId;
    };

    const commit = () => {
      if (suppressObserverRef.current) return;
      const id = computeNearest();
      if (id) setFocusedId(id);
    };

    const supportsScrollEnd = 'onscrollend' in root;
    let timer = 0;
    const onScroll = () => {
      if (supportsScrollEnd) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(commit, 140);
    };
    const onScrollEnd = () => commit();

    root.addEventListener('scroll', onScroll, { passive: true });
    if (supportsScrollEnd) {
      root.addEventListener('scrollend', onScrollEnd);
    }
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (supportsScrollEnd) root.removeEventListener('scrollend', onScrollEnd);
      window.clearTimeout(timer);
    };
  }, [carouselListings]);

  // Map → carousel: when focus moves (e.g. user taps a pin and `selectedId`
  // updates, or external state change), scroll the matching card into view.
  useEffect(() => {
    if (!focusedId) return;
    const card = cardRefs.current.get(focusedId);
    if (!card) return;
    suppressObserverRef.current = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    const t = window.setTimeout(() => {
      suppressObserverRef.current = false;
    }, 450);
    return () => window.clearTimeout(t);
  }, [focusedId]);

  const selected =
    listings.find((l) => l.id === (selectedId ?? focusedId)) ?? visible[0] ?? null;

  return (
    <div style={rootStyle}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <AtlasMap
          ref={mapHandle}
          pins={pins}
          selectedId={selected?.id ?? null}
          onSelect={(id) => id && onSelect(id)}
          showWorkplace={!!profile.workplaceCoords}
          workplaceLabel={profile.workplace ? `Travail · ${profile.workplace}` : 'Travail'}
          workplace={profile.workplaceCoords ?? undefined}
          initialCenter={initialCenter}
          basemap={basemap}
          routeOverlay={routeOverlay}
        />
      </div>

      <div style={topBarStyle}>
        <GlassPill padding="8px 12px" style={{ flex: 1, gap: 8 }}>
          <Icons.Search size={14} stroke={1.7} style={{ color: 'var(--atlas-ink-3)' }} />
          <span style={{ flex: 1, color: 'var(--atlas-ink-3)', fontSize: 13 }}>
            Vevey, Lutry…
          </span>
        </GlassPill>
        <GlassPill as="button" padding="8px 10px" aria-label="Filtres" onClick={onOpenFilters}>
          <Icons.Filter size={15} stroke={1.7} />
          {profile.newCount > 0 ? (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: 'var(--atlas-ember)'
              }}
            />
          ) : null}
        </GlassPill>
      </div>

      <div style={chipsRowStyle}>
        {stages.map((s) => {
          const active = s.value === stage;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onStageChange(s.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'var(--atlas-sans)',
                whiteSpace: 'nowrap',
                background: active
                  ? 'rgba(22,20,15,.92)'
                  : 'var(--atlas-glass-pill-bg)',
                backdropFilter: 'var(--atlas-glass-pill-blur)',
                WebkitBackdropFilter: 'var(--atlas-glass-pill-blur)',
                color: active ? '#fff' : 'var(--atlas-ink-2)',
                // boxShadow: 'var(--atlas-shadow-1)',
                border: 0,
                cursor: 'pointer'
              }}
            >
              {s.label} · <span style={{ fontFamily: 'var(--atlas-mono)' }}>{s.count}</span>
            </button>
          );
        })}
      </div>

      <MapControls
        size={40}
        style={{
          position: 'absolute',
          right: 12,
          top: 'calc(env(safe-area-inset-top, 0px) + 116px)',
          zIndex: 5
        }}
        onZoomIn={() => mapHandle.current?.zoomIn()}
        onZoomOut={() => mapHandle.current?.zoomOut()}
        onCompass={() => mapHandle.current?.resetBearing()}
        basemap={basemap}
        onBasemapChange={changeBasemap}
      />

      {carouselListings.length > 0 ? (
        <div
          ref={carouselRef}
          className="atlas-no-scrollbar"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `calc(env(safe-area-inset-bottom, 16px) + 84px)`,
            zIndex: 6,
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollPaddingLeft: 12,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {carouselListings.map((listing) => (
            <MiniCard
              key={listing.id}
              listing={listing}
              selected={listing.id === (selectedId ?? focusedId)}
              registerRef={(el) => {
                if (el) cardRefs.current.set(listing.id, el);
                else cardRefs.current.delete(listing.id);
              }}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type MiniCardProps = {
  listing: AtlasListing;
  selected: boolean;
  onSelect: (id: string) => void;
  registerRef: (el: HTMLDivElement | null) => void;
};

function MiniCard({ listing, selected, onSelect, registerRef }: MiniCardProps) {
  const cover = listing.images[0];
  const meta = [
    listing.rooms != null ? `${listing.rooms} pces` : null,
    listing.surfaceM2 != null ? `${listing.surfaceM2} m²` : null,
    listing.transitText
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      ref={registerRef}
      data-listing-id={listing.id}
      style={{ flex: '0 0 280px', scrollSnapAlign: 'start' }}
    >
    <GlassPanel
      variant="panel"
      style={{
        borderRadius: 18,
        padding: 10,
        cursor: 'pointer',
        outline: selected ? '2px solid var(--atlas-ink)' : 'none',
        outlineOffset: -2,
        transition: 'outline 140ms ease',
        boxShadow:
          '0 4px 10px -6px rgba(22, 20, 15, 0.18), 0 0 0 1px rgba(22, 20, 15, 0.04)'
      }}
      onClick={() => onSelect(listing.id)}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '96px 1fr',
          gap: 10,
          alignItems: 'stretch'
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 12,
            background: cover
              ? `center/cover no-repeat url(${JSON.stringify(cover)})`
              : 'var(--atlas-soft)'
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            paddingTop: 2,
            minWidth: 0
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--atlas-ink-3)'
            }}
          >
            {listing.area || '—'}
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--atlas-ink)'
            }}
          >
            {listing.title}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--atlas-ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {meta || '—'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4
            }}
          >
            {listing.totalChf != null ? (
              <Mono style={{ fontSize: 14, fontWeight: 500 }}>
                {formatCHF(listing.totalChf)}
                <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)', marginLeft: 3 }}>CHF</span>
              </Mono>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--atlas-ink-3)' }}>n/a</span>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: 'var(--atlas-ink-3)' }}>
              {listing.publishedShort}
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
    </div>
  );
}
