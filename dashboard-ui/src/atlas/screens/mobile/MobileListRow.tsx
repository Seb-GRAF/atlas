import type { CSSProperties, KeyboardEvent } from 'react';
import { Icons, Mono, PhotoFrame, formatCHF } from '../../components';
import type { AtlasListing } from '../../types';
import { CommuteChips } from '../CommuteChips';

type MobileListRowProps = {
  listing: AtlasListing;
  onSelect: (id: string) => void;
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 0',
  borderBottom: '1px solid var(--atlas-line-2)',
  background: 'transparent',
  textAlign: 'left',
  width: '100%',
  cursor: 'pointer'
};

const heartBtnStyle: CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 32,
  height: 32,
  borderRadius: 999,
  background: 'rgba(255,255,255,.92)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 4px 10px rgba(0,0,0,.12)'
};

const newBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 10,
  left: 10,
  padding: '4px 9px',
  borderRadius: 999,
  background: 'rgba(22,20,15,.7)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  color: '#fff',
  fontSize: 10.5,
  letterSpacing: '0.08em',
  fontWeight: 500
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

const titleStyle: CSSProperties = {
  fontSize: 14.5,
  fontWeight: 500,
  letterSpacing: '-0.012em',
  marginTop: 2,
  lineHeight: 1.3,
  color: 'var(--atlas-ink)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const metaItem: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4
};

export function MobileListRow({ listing, onSelect }: MobileListRowProps) {
  const sourceShort = String(listing.source).replace(/\.ch$/i, '');
  const open = () => onSelect(listing.id);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={listing.title}
      onClick={open}
      onKeyDown={onKeyDown}
      style={rowStyle}
    >
      <div style={{ position: 'relative', width: '100%' }}>
        <PhotoFrame images={listing.images} aspect="16 / 10" radius={14} count={false} />
        <span
          style={{
            ...heartBtnStyle,
            color: listing.pinned ? 'var(--atlas-ember)' : 'var(--atlas-ink-2)'
          }}
          aria-hidden
        >
          <Icons.Heart size={14} stroke={1.7} />
        </span>
        {listing.isNew ? <span style={newBadgeStyle}>NOUVEAU</span> : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={eyebrowStyle}>
            {[listing.area, sourceShort].filter(Boolean).join(' · ') || '—'}
          </div>
          <div style={titleStyle}>{listing.title}</div>
        </div>
        {listing.totalChf != null ? (
          <Mono style={{ fontSize: 16, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {formatCHF(listing.totalChf)}
          </Mono>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--atlas-ink-3)' }}>n/a</span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 14,
          fontSize: 12,
          color: 'var(--atlas-ink-2)',
          flexWrap: 'wrap'
        }}
      >
        {listing.rooms != null ? (
          <span style={metaItem}>
            <Icons.Bed size={12} stroke={1.7} /> {listing.rooms} pces
          </span>
        ) : null}
        {listing.surfaceM2 != null ? (
          <span style={metaItem}>
            <Icons.Square size={12} stroke={1.7} /> {listing.surfaceM2} m²
          </span>
        ) : null}
      </div>

      <CommuteChips listing={listing} compact style={{ marginTop: 6 }} />
    </div>
  );
}
