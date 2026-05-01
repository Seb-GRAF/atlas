import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GlassPill, Icons } from '../../components';
import { MobileListRow } from './MobileListRow';
import { SortMenu } from '../SortMenu';
import { SourcesFilter } from '../SourcesFilter';
import { ConfirmDialog } from '../ConfirmDialog';
import type {
  AtlasListing,
  AtlasProfile,
  AtlasStage,
  AtlasStageValue
} from '../../types';
import type { AtlasSortValue } from '../../url';

type MobileListProps = {
  profile: AtlasProfile;
  listings: AtlasListing[];
  stages: AtlasStage[];
  stage: AtlasStageValue;
  onStageChange: (stage: AtlasStageValue) => void;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
  onArchiveAll?: () => void;
  pendingIds?: ReadonlySet<string>;
  restoringIds?: ReadonlySet<string>;
  onScan: () => void;
  scanning: boolean;
  onOpenProfileSwitcher: () => void;
  sort: AtlasSortValue;
  onSortChange: (sort: AtlasSortValue) => void;
  scanStatus?: ReactNode;
  sourceListings?: AtlasListing[];
  sources?: string[];
  onSourcesChange?: (next: string[]) => void;
};

const rootStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--atlas-bg)',
  fontFamily: 'var(--atlas-sans)',
  color: 'var(--atlas-ink)'
};

const scrollStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overscrollBehavior: 'contain'
};

const topBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 12px 8px'
};

const stageBarBaseStyle: CSSProperties = {
  padding: '6px 12px 10px',
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  background: 'var(--atlas-glass-base-bg)',
  backdropFilter: 'var(--atlas-glass-base-blur)',
  WebkitBackdropFilter: 'var(--atlas-glass-base-blur)'
};

const stickyHeaderStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 6,
  paddingTop: 'env(safe-area-inset-top, 0px)',
  background: 'var(--atlas-glass-base-bg)',
  backdropFilter: 'var(--atlas-glass-base-blur)',
  WebkitBackdropFilter: 'var(--atlas-glass-base-blur)',
  boxShadow: '0 1px 0 rgba(22,20,15,.06)',
  transition: 'transform 220ms cubic-bezier(0.25, 1, 0.5, 1)',
  willChange: 'transform'
};

const sortBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 10px',
  borderRadius: 999,
  background: 'transparent',
  fontSize: 12,
  color: 'var(--atlas-ink-3)',
  border: 0,
  cursor: 'pointer',
  fontFamily: 'var(--atlas-sans)',
  whiteSpace: 'nowrap'
};

function formatZonesShort(zones: string[], shortTitle: string) {
  if (zones.length === 0) return shortTitle || '—';
  if (zones.length === 1) return zones[0];
  return `${zones[0]} +${zones.length - 1}`;
}

export function MobileList({
  profile,
  listings,
  stages,
  stage,
  onStageChange,
  onSelect,
  onArchive,
  onArchiveAll,
  pendingIds,
  restoringIds,
  onScan,
  scanning,
  onOpenProfileSwitcher,
  sort,
  onSortChange,
  scanStatus,
  sourceListings,
  sources,
  onSourcesChange
}: MobileListProps) {
  const count = pendingIds && pendingIds.size > 0
    ? listings.reduce((acc, l) => acc + (pendingIds.has(l.id) ? 0 : 1), 0)
    : listings.length;
  const [confirmArchiveAll, setConfirmArchiveAll] = useState(false);
  const showArchiveAll = !!onArchiveAll && count > 0;
  const zoneLabel = formatZonesShort(profile.zones, profile.shortTitle);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerLeadRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [collapseOffset, setCollapseOffset] = useState(0);

  useEffect(() => {
    const node = headerLeadRef.current;
    if (!node) return;

    const measure = () => setCollapseOffset(node.getBoundingClientRect().height);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const onScroll = () => {
      const scrollTop = node.scrollTop;
      const delta = scrollTop - lastScrollTopRef.current;

      if (scrollTop < 72) {
        setHeaderExpanded(true);
      } else if (delta > 8) {
        setHeaderExpanded(false);
      } else if (delta < -8) {
        setHeaderExpanded(true);
      }

      lastScrollTopRef.current = scrollTop;
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  const renderTopBar = () => (
    <div style={topBarStyle}>
      <GlassPill
        as="button"
        padding="6px 10px 6px 6px"
        onClick={onOpenProfileSwitcher}
        aria-label="Choisir un profil"
        style={{ flex: 1, gap: 8, justifyContent: 'flex-start', minWidth: 0 }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: 'var(--atlas-ink)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--atlas-mono)',
            fontSize: 11,
            fontWeight: 600,
            flex: '0 0 auto'
          }}
        >
          A
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--atlas-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {profile.shortTitle || zoneLabel}
        </span>
        <Icons.ChevronDown size={12} stroke={1.6} style={{ color: 'var(--atlas-ink-3)', flex: '0 0 auto' }} />
        {profile.newCount > 0 ? (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: 'var(--atlas-ember)',
              flex: '0 0 auto'
            }}
          />
        ) : null}
      </GlassPill>

      <GlassPill
        as="button"
        padding="10px 12px"
        onClick={onScan}
        aria-label={scanning ? 'Scan en cours, voir le détail' : 'Lancer un scan'}
        style={{ gap: 8, flex: '0 0 auto' }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: scanning ? 'var(--atlas-ember)' : 'var(--atlas-good)',
            animation: scanning ? 'v2pulse 1.4s ease-in-out infinite' : undefined,
            display: 'inline-block',
            flex: '0 0 auto'
          }}
        />
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--atlas-ink)',
            fontFamily: 'var(--atlas-sans)'
          }}
        >
          {scanning ? 'Scan…' : 'Scanner'}
        </span>
      </GlassPill>
    </div>
  );

  const renderSummary = () => (
    <div
      style={{
        padding: '14px 16px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap'
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.022em',
          color: 'var(--atlas-ink)',
          whiteSpace: 'nowrap'
        }}
      >
        {count} appartement{count > 1 ? 's' : ''}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          marginInlineEnd: -6
        }}
      >
        {showArchiveAll ? (
          <button
            type="button"
            onClick={() => setConfirmArchiveAll(true)}
            aria-label={`Archiver les ${count} annonces`}
            style={{
              ...sortBtnStyle,
              gap: 4,
              color: 'var(--atlas-ink-3)'
            }}
          >
            <Icons.Close size={12} stroke={1.8} />
            Tout archiver
          </button>
        ) : null}
        <SortMenu sort={sort} onChange={onSortChange} buttonStyle={sortBtnStyle} align="right" />
      </div>
    </div>
  );

  const renderStageBar = () => (
    <div style={stageBarBaseStyle} className="atlas-no-scrollbar">
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
              boxShadow: 'var(--atlas-shadow-1)',
              border: 0,
              cursor: 'pointer'
            }}
          >
            {s.label} ·{' '}
            <span style={{ fontFamily: 'var(--atlas-mono)' }}>{s.count}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={rootStyle}>
      <div ref={scrollRef} style={scrollStyle}>
        <div
          style={{
            ...stickyHeaderStyle,
            transform: headerExpanded
              ? 'translate3d(0, 0, 0)'
              : `translate3d(0, -${collapseOffset}px, 0)`
          }}
        >
          <div ref={headerLeadRef}>
            {renderTopBar()}
            {renderSummary()}
          </div>
          {renderStageBar()}
          {sourceListings && sources && onSourcesChange ? (
            <div style={{ paddingBottom: 10 }}>
              <SourcesFilter
                listings={sourceListings}
                selected={sources}
                onChange={onSourcesChange}
                compact
                padInline={12}
              />
            </div>
          ) : null}
        </div>

        {scanStatus ?? null}

        <div
          style={{
            padding: `0 12px calc(110px + env(safe-area-inset-bottom, 16px))`
          }}
        >
          {count === 0 ? (
            <div
              style={{
                padding: '40px 12px',
                textAlign: 'center',
                color: 'var(--atlas-ink-3)',
                fontSize: 13
              }}
            >
              Aucune annonce dans ce filtre.
            </div>
          ) : (
            listings.map((listing) => (
              <MobileListRow
                key={listing.id}
                listing={listing}
                onSelect={onSelect}
                onArchive={onArchive}
                pending={pendingIds?.has(listing.id)}
                restoring={restoringIds?.has(listing.id)}
              />
            ))
          )}
        </div>
      </div>

      {confirmArchiveAll ? (
        <ConfirmDialog
          title={`Archiver ${count} annonce${count > 1 ? 's' : ''} ?`}
          message="Toutes les annonces visibles seront archivées. Vous pourrez annuler pendant quelques secondes."
          confirmLabel="Tout archiver"
          destructive
          onCancel={() => setConfirmArchiveAll(false)}
          onConfirm={() => {
            setConfirmArchiveAll(false);
            onArchiveAll?.();
          }}
        />
      ) : null}
    </div>
  );
}
