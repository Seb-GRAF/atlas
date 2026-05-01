import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GlassPill, Icons } from '../../components';
import { MobileListRow } from './MobileListRow';
import { SortMenu } from '../SortMenu';
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
  onScan: () => void;
  scanning: boolean;
  onOpenFilters: () => void;
  sort: AtlasSortValue;
  onSortChange: (sort: AtlasSortValue) => void;
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
  fontFamily: 'var(--atlas-sans)'
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
  onScan,
  scanning,
  onOpenFilters,
  sort,
  onSortChange
}: MobileListProps) {
  const count = listings.length;
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
        padding="10px 14px"
        onClick={onOpenFilters}
        aria-label="Filtres"
        style={{ flex: 1, gap: 10, justifyContent: 'flex-start' }}
      >
        <Icons.Search size={14} stroke={1.7} style={{ color: 'var(--atlas-ink-3)' }} />
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
          {zoneLabel}
        </span>
        <span
          style={{
            width: 1,
            height: 14,
            background: 'var(--atlas-line)'
          }}
        />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--atlas-ink-2)'
          }}
        >
          <Icons.Filter size={14} stroke={1.7} />
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
        </span>
      </GlassPill>

      <GlassPill
        as="button"
        padding="10px 14px"
        onClick={onScan}
        aria-label={scanning ? 'Scan en cours, voir le détail' : 'Lancer un scan'}
        style={{ gap: 8 }}
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
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.022em',
          color: 'var(--atlas-ink)'
        }}
      >
        {count} appartement{count > 1 ? 's' : ''}
      </div>
      <SortMenu sort={sort} onChange={onSortChange} buttonStyle={sortBtnStyle} align="right" />
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
        </div>

        <div
          style={{
            padding: `0 12px calc(110px + env(safe-area-inset-bottom, 16px))`
          }}
        >
          {listings.length === 0 ? (
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
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
