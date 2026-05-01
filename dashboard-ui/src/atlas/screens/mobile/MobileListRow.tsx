import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Icons, Mono, PhotoFrame, formatCHF } from '../../components';
import type { AtlasListing } from '../../types';
import { CommuteChips } from '../CommuteChips';
import { useSwipeToArchive } from '../useSwipeToArchive';

type MobileListRowProps = {
  listing: AtlasListing;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
};

const wrapperStyle: CSSProperties = {
  position: 'relative',
  borderBottom: '1px solid var(--atlas-line-2)',
  flexShrink: 0,
  overflow: 'hidden'
};

const actionLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 22px',
  background: 'var(--atlas-soft, rgba(22,20,15,.06))',
  fontFamily: 'var(--atlas-sans)',
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  pointerEvents: 'none'
};

const actionPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 0',
  background: 'var(--atlas-bg)',
  textAlign: 'left',
  width: '100%',
  cursor: 'pointer',
  position: 'relative',
  touchAction: 'pan-y'
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

const SWIPE_THRESHOLD = 96;

export function MobileListRow({ listing, onSelect, onArchive }: MobileListRowProps) {
  const sourceShort = String(listing.source).replace(/\.ch$/i, '');
  const swipeEnabled = !!onArchive;

  const swipe = useSwipeToArchive({
    threshold: SWIPE_THRESHOLD,
    onCommit: () => {
      onArchive?.(listing.id);
    }
  });

  const suppressClickRef = useRef(false);

  const open = () => {
    if (suppressClickRef.current) return;
    onSelect(listing.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  };

  const onPointerUpWrapped = (e: PointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = swipe.swiping || !!swipe.committed;
    swipe.handlers.onPointerUp(e);
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handlers = swipeEnabled
    ? {
        onPointerDown: swipe.handlers.onPointerDown,
        onPointerMove: swipe.handlers.onPointerMove,
        onPointerUp: onPointerUpWrapped,
        onPointerCancel: swipe.handlers.onPointerCancel
      }
    : null;

  const tx = swipeEnabled ? swipe.translateX : 0;
  const isDragging = swipeEnabled && swipe.swiping;
  const released = swipeEnabled && !swipe.swiping;
  const past = Math.abs(tx) > SWIPE_THRESHOLD;
  const actionOpacity = swipeEnabled ? Math.min(1, Math.abs(tx) / SWIPE_THRESHOLD) : 0;

  return (
    <div style={wrapperStyle}>
      {swipeEnabled && tx !== 0 ? (
        <div
          style={{
            ...actionLayerStyle,
            opacity: actionOpacity,
            color: past ? 'var(--atlas-ember, #c43d2a)' : 'var(--atlas-ink-2)'
          }}
          aria-hidden
        >
          <span style={{ ...actionPillStyle, opacity: tx > 0 ? 1 : 0 }}>
            <Icons.Close size={16} stroke={2} />
            Archiver
          </span>
          <span style={{ ...actionPillStyle, opacity: tx < 0 ? 1 : 0 }}>
            Archiver
            <Icons.Close size={16} stroke={2} />
          </span>
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-label={listing.title}
        onClick={open}
        onKeyDown={onKeyDown}
        {...(handlers ?? {})}
        style={{
          ...rowStyle,
          transform: tx !== 0 ? `translate3d(${tx}px, 0, 0)` : undefined,
          transition: released && !isDragging ? 'transform 220ms cubic-bezier(.2,.8,.2,1)' : undefined
        }}
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
              <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)', marginLeft: 3 }}>CHF</span>
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
    </div>
  );
}
