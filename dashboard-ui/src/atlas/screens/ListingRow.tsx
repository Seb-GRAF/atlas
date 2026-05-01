import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent
} from 'react';
import { Icons, Mono, SourceMono, formatCHF } from '../components';
import type { AtlasListing } from '../types';
import { CommuteChips } from './CommuteChips';
import { useSwipeToArchive } from './useSwipeToArchive';

type ListingRowProps = {
  listing: AtlasListing;
  selected: boolean;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
  pending?: boolean;
  // True for one render when an undo restored this id. Distinguishes a
  // genuine "come back" transition (re-expand) from the natural flush at
  // the end of the undo window (don't re-expand; parent will unmount).
  restoring?: boolean;
  registerRef?: (el: HTMLDivElement | null) => void;
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

const wrapperStyle: CSSProperties = {
  position: 'relative',
  borderRadius: 14,
  flexShrink: 0,
  overflow: 'hidden',
  marginBottom: 4,
  contain: 'layout'
};

const actionLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  background: 'var(--atlas-soft, rgba(22,20,15,.06))',
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  pointerEvents: 'none',
  borderRadius: 14,
  opacity: 0,
  color: 'var(--atlas-ink-2)',
  willChange: 'opacity, color'
};

const actionPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  opacity: 0,
  willChange: 'opacity'
};

const SWIPE_THRESHOLD = 96;
const COLLAPSE_MS = 240;
const COLLAPSE_EASING = 'cubic-bezier(.2,.7,.2,1)';

export function ListingRow({
  listing,
  selected,
  onSelect,
  onArchive,
  pending = false,
  restoring = false,
  registerRef
}: ListingRowProps) {
  const cover = listing.images[0];
  const meta = [
    listing.rooms != null ? `${listing.rooms} pces` : null,
    listing.surfaceM2 != null ? `${listing.surfaceM2} m²` : null
  ]
    .filter(Boolean)
    .join(' · ');

  const swipeEnabled = !!onArchive;
  const swipe = useSwipeToArchive({
    threshold: SWIPE_THRESHOLD,
    imperative: true,
    onCommit: () => {
      onArchive?.(listing.id);
    }
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [collapsing, setCollapsing] = useState(false);
  const swipeReset = swipe.reset;
  // Latched once the row has begun collapsing due to a commit. Cleared only
  // by an explicit undo (restoring=true).
  const leavingRef = useRef(false);
  const restoringInFlightRef = useRef(false);
  const setWrapperRef = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      registerRef?.(node);
    },
    [registerRef]
  );

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    if (pending) {
      leavingRef.current = true;

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

    // pending=false branch: skip re-expand on natural flush. Parent will
    // unmount the row imminently; not animating prevents the brief flash.
    if (leavingRef.current && !restoring) {
      return;
    }

    if (restoringInFlightRef.current) return;

    const wasLeaving = leavingRef.current;
    if (!wasLeaving && !collapsing && !node.style.height) {
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

  // Active = gesture in progress or just committed. Used only for the row's
  // background tint — a state-driven boolean, not per-frame.
  const swipeActive = swipeEnabled && (swipe.swiping || !!swipe.committed);

  const fadeOnCollapse = collapsing && !leavingRef.current;
  const collapseStyle: CSSProperties = {
    transition: `height ${COLLAPSE_MS}ms ${COLLAPSE_EASING}, opacity 200ms ease, margin-bottom ${COLLAPSE_MS}ms ${COLLAPSE_EASING}`,
    opacity: fadeOnCollapse ? 0 : 1,
    marginBottom: collapsing ? 0 : 4,
    pointerEvents: pending ? 'none' : undefined
  };

  return (
    <div
      ref={setWrapperRef}
      style={{ ...wrapperStyle, ...collapseStyle }}
      aria-hidden={pending || undefined}
    >
      {swipeEnabled ? (
        <div ref={swipe.registerOverlay} style={actionLayerStyle} aria-hidden>
          <span ref={swipe.registerLeftPill} style={actionPillStyle}>
            <Icons.Close size={14} stroke={2} />
            Archiver
          </span>
          <span ref={swipe.registerRightPill} style={actionPillStyle}>
            Archiver
            <Icons.Close size={14} stroke={2} />
          </span>
        </div>
      ) : null}
      <div
        ref={swipe.registerTarget}
        role="button"
        tabIndex={0}
        aria-label={listing.title}
        onClick={open}
        onKeyDown={onKeyDown}
        {...(handlers ?? {})}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          textAlign: 'left',
          padding: 8,
          borderRadius: 14,
          background: selected
            ? 'var(--atlas-ember-2)'
            : swipeActive
              ? 'var(--atlas-bg, #f6f3ee)'
              : 'transparent',
          boxShadow: 'none',
          border: 0,
          cursor: 'pointer',
          touchAction: 'pan-y',
          transition: 'background 140ms ease, box-shadow 140ms ease',
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '92px 1fr',
            gap: 12,
            alignItems: 'start'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 92,
              height: 92,
              borderRadius: 10,
              background: cover ? `center/cover url(${JSON.stringify(cover)})` : 'var(--atlas-soft)',
              overflow: 'hidden'
            }}
          >
            {listing.pinned ? (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: 'var(--atlas-ink)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <Icons.Pin size={11} stroke={2} />
              </span>
            ) : null}
            <span
              title={String(listing.source)}
              style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                background: 'rgba(255,255,255,.92)',
                borderRadius: 6,
                boxShadow: '0 1px 2px rgba(22,20,15,.18)',
                lineHeight: 0
              }}
            >
              <SourceMono source={String(listing.source)} size={20} />
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  ...eyebrowStyle,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {listing.area || '—'}
              </span>
              {listing.isNew ? (
                <>
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 999,
                      background: 'var(--atlas-ember)'
                    }}
                  />
                  <span style={{ ...eyebrowStyle, color: 'var(--atlas-ember)' }}>NOUVEAU</span>
                </>
              ) : null}
            </div>

            <div
              style={{
                fontFamily: 'var(--atlas-sans)',
                fontSize: 13.5,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--atlas-ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {listing.title}
            </div>

            <div
              style={{
                fontFamily: 'var(--atlas-sans)',
                fontSize: 12,
                color: 'var(--atlas-ink-3)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {meta || '—'}
            </div>

            <CommuteChips listing={listing} compact style={{ marginTop: 3 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              {listing.totalChf != null ? (
                <>
                  <Mono style={{ fontSize: 14, fontWeight: 500 }}>{formatCHF(listing.totalChf)}</Mono>
                  <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)' }}>CHF</span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--atlas-ink-3)' }}>Prix n/a</span>
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)' }}>{listing.publishedLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
