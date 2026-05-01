import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent
} from 'react';
import { Icons, Mono, PhotoFrame, SourceMono, formatCHF } from '../../components';
import type { AtlasListing } from '../../types';
import { CommuteChips } from '../CommuteChips';
import { useSwipeToArchive } from '../useSwipeToArchive';

type MobileListRowProps = {
  listing: AtlasListing;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
  pending?: boolean;
  // True for one render when an undo restored this id. Distinguishes a
  // genuine "come back" transition (re-expand) from the natural flush at
  // the end of the undo window (don't re-expand; parent will unmount).
  restoring?: boolean;
};

const wrapperStyle: CSSProperties = {
  position: 'relative',
  flexShrink: 0,
  overflow: 'hidden',
  contain: 'layout'
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
  pointerEvents: 'none',
  opacity: 0,
  color: 'var(--atlas-ink-2)',
  willChange: 'opacity, color'
};

const actionPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  opacity: 0,
  willChange: 'opacity'
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
const COLLAPSE_MS = 240;
const COLLAPSE_EASING = 'cubic-bezier(.2,.7,.2,1)';

export function MobileListRow({
  listing,
  onSelect,
  onArchive,
  pending = false,
  restoring = false
}: MobileListRowProps) {
  const swipeEnabled = !!onArchive;

  const swipe = useSwipeToArchive({
    threshold: SWIPE_THRESHOLD,
    imperative: true,
    onCommit: () => {
      onArchive?.(listing.id);
    }
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [collapsing, setCollapsing] = useState(false);
  // Once a row has started collapsing due to commit, latch this. While
  // latched, we never re-expand on pending=false — only the explicit undo
  // path (restoring=true) clears the latch and triggers re-expansion.
  const leavingRef = useRef(false);
  // Tracks whether a re-expand animation is in flight, so subsequent effect
  // runs (e.g. when `restoring` flips back to false) don't restart it.
  const restoringInFlightRef = useRef(false);
  const swipeReset = swipe.reset;

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    if (pending) {
      leavingRef.current = true;

      // Pin current rendered height, then drop to 0 next frame.
      const h = node.getBoundingClientRect().height;
      node.style.height = `${h}px`;
      node.style.willChange = 'height';
      void node.offsetHeight;
      const id = requestAnimationFrame(() => {
        node.style.height = '0px';
        setCollapsing(true);
      });

      const onCollapseEnd = (e: TransitionEvent) => {
        if (e.target !== node) return;
        if (e.propertyName !== 'height') return;
        node.style.willChange = '';
        node.removeEventListener('transitionend', onCollapseEnd);
      };
      node.addEventListener('transitionend', onCollapseEnd);

      return () => {
        cancelAnimationFrame(id);
        node.removeEventListener('transitionend', onCollapseEnd);
      };
    }

    // pending=false branch.
    // If we're leaving but it's not an explicit undo, do nothing — the
    // parent will unmount us imminently. This kills the "appears and
    // disappears" flash that used to happen at the end of the undo window.
    if (leavingRef.current && !restoring) {
      return;
    }

    // If a re-expand animation is already in flight from a previous effect
    // run (e.g. `restoring` flipped back to false), don't restart it.
    if (restoringInFlightRef.current) return;

    // Genuine undo (or first mount with no prior collapse). Animate the inner
    // button back to translate=0 in lockstep with the wrapper re-expanding.
    const wasLeaving = leavingRef.current;
    if (!wasLeaving && !collapsing && !node.style.height) {
      // Nothing to undo — fresh mount or already at rest.
      return;
    }
    leavingRef.current = false;
    restoringInFlightRef.current = true;
    swipeReset({ animate: wasLeaving });

    node.style.height = '';
    const target = node.scrollHeight;
    node.style.height = '0px';
    node.style.willChange = 'height';
    void node.offsetHeight;
    setCollapsing(false);
    const id = requestAnimationFrame(() => {
      node.style.height = `${target}px`;
    });

    const onEnd = (e: TransitionEvent) => {
      if (e.target !== node) return;
      if (e.propertyName !== 'height') return;
      node.style.height = '';
      node.style.willChange = '';
      restoringInFlightRef.current = false;
      node.removeEventListener('transitionend', onEnd);
    };
    node.addEventListener('transitionend', onEnd);
    return () => {
      cancelAnimationFrame(id);
      node.removeEventListener('transitionend', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, restoring, swipeReset]);

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

  // Fade only when collapsing without a swipe commit (e.g. tap-to-archive in
  // some other future path). After a swipe, the inner element is already
  // translated offscreen, so a fade would look wrong.
  const fadeOnCollapse = collapsing && !leavingRef.current;
  const collapseStyle: CSSProperties = {
    transition: `height ${COLLAPSE_MS}ms ${COLLAPSE_EASING}, opacity 200ms ease`,
    opacity: fadeOnCollapse ? 0 : 1,
    pointerEvents: pending ? 'none' : undefined
  };

  return (
    <div
      ref={wrapperRef}
      style={{ ...wrapperStyle, ...collapseStyle }}
      aria-hidden={pending || undefined}
    >
      {swipeEnabled ? (
        <div ref={swipe.registerOverlay} style={actionLayerStyle} aria-hidden>
          <span ref={swipe.registerLeftPill} style={actionPillStyle}>
            <Icons.Close size={16} stroke={2} />
            Archiver
          </span>
          <span ref={swipe.registerRightPill} style={actionPillStyle}>
            Archiver
            <Icons.Close size={16} stroke={2} />
          </span>
        </div>
      ) : null}

      <div
        ref={(el) => {
          innerRef.current = el;
          swipe.registerTarget(el);
        }}
        role="button"
        tabIndex={0}
        aria-label={listing.title}
        onClick={open}
        onKeyDown={onKeyDown}
        {...(handlers ?? {})}
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
          <span
            title={String(listing.source)}
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              background: 'rgba(255,255,255,.92)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: 7,
              boxShadow: '0 2px 6px rgba(22,20,15,.22)',
              lineHeight: 0
            }}
          >
            <SourceMono source={String(listing.source)} size={24} />
          </span>
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
            <div style={eyebrowStyle}>{listing.area || '—'}</div>
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
