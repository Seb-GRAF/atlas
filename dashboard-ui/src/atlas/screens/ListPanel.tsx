import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GlassPanel, Hairline, Icons } from '../components';
import { ListingRow } from './ListingRow';
import { SortMenu } from './SortMenu';
import { SourcesFilter } from './SourcesFilter';
import { ConfirmDialog } from './ConfirmDialog';
import type { AtlasListing } from '../types';
import type { AtlasSortValue } from '../url';

type ListPanelProps = {
  zones: string[];
  listings: AtlasListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
  onArchiveAll?: () => void;
  pendingIds?: ReadonlySet<string>;
  restoringIds?: ReadonlySet<string>;
  generatedAt: string;
  totalCount?: number;
  emptyContent?: React.ReactNode;
  scanStatus?: React.ReactNode;
  sort: AtlasSortValue;
  onSortChange: (sort: AtlasSortValue) => void;
  sourceListings?: AtlasListing[];
  sources?: string[];
  onSourcesChange?: (next: string[]) => void;
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  left: 16,
  top: 76,
  bottom: 16,
  width: 380,
  zIndex: 4,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

function formatZones(zones: string[]) {
  if (zones.length === 0) return '—';
  if (zones.length <= 3) return zones.join(' · ').toUpperCase();
  const head = zones.slice(0, 3).join(' · ').toUpperCase();
  return `${head} +${zones.length - 3}`;
}

export function ListPanel({
  zones,
  listings,
  selectedId,
  onSelect,
  onArchive,
  onArchiveAll,
  pendingIds,
  restoringIds,
  generatedAt,
  totalCount,
  emptyContent,
  scanStatus,
  sort,
  onSortChange,
  sourceListings,
  sources,
  onSourcesChange
}: ListPanelProps) {
  const count = totalCount ?? listings.length;
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    const row = rowRefs.current.get(selectedId);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [selectedId]);

  const archivableCount = pendingIds
    ? listings.reduce((acc, l) => acc + (pendingIds.has(l.id) ? 0 : 1), 0)
    : listings.length;
  const showArchiveAll = !!onArchiveAll && archivableCount > 0;

  return (
    <GlassPanel variant="panel" style={panelStyle}>
      <div style={{ padding: '16px 18px 12px', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginTop: 6,
            gap: 12
          }}
        >
          <div
            style={{
              fontFamily: 'var(--atlas-sans)',
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'var(--atlas-ink)',
              whiteSpace: 'nowrap'
            }}
          >
            {count} appartement{count > 1 ? 's' : ''}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 6,
              minWidth: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {showArchiveAll ? (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  aria-label={`Archiver les ${archivableCount} annonces`}
                  title="Tout archiver"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--atlas-sans)',
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: 'var(--atlas-ink-3)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Icons.Close size={12} stroke={1.8} />
                  Tout archiver
                </button>
              ) : null}
              <SortMenu
                sort={sort}
                onChange={onSortChange}
                align="right"
                buttonStyle={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: 'var(--atlas-ink-3)',
                  padding: '4px 10px',
                  whiteSpace: 'nowrap'
                }}
              />
            </div>
            {generatedAt ? (
              <span style={{ fontSize: 10.5, color: 'var(--atlas-ink-3)' }}>maj. {generatedAt}</span>
            ) : null}
          </div>
        </div>
      </div>

      {confirmOpen ? (
        <ConfirmDialog
          title={`Archiver ${archivableCount} annonce${archivableCount > 1 ? 's' : ''} ?`}
          message={
            <>
              Toutes les annonces visibles seront archivées. Vous pourrez annuler
              pendant quelques secondes.
            </>
          }
          confirmLabel="Tout archiver"
          destructive
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            onArchiveAll?.();
          }}
        />
      ) : null}

      {sourceListings && sources && onSourcesChange ? (
        <div style={{ paddingBottom: 12, marginTop: -4 }}>
          <SourcesFilter
            listings={sourceListings}
            selected={sources}
            onChange={onSourcesChange}
            compact
            padInline={18}
          />
        </div>
      ) : null}

      {scanStatus ?? null}
      <Hairline />

      {listings.length === 0 && emptyContent ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 18px' }}>{emptyContent}</div>
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '8px 8px 16px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              selected={listing.id === selectedId}
              onSelect={onSelect}
              onArchive={onArchive}
              pending={pendingIds?.has(listing.id)}
              restoring={restoringIds?.has(listing.id)}
              registerRef={(el) => {
                if (el) rowRefs.current.set(listing.id, el);
                else rowRefs.current.delete(listing.id);
              }}
            />
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
