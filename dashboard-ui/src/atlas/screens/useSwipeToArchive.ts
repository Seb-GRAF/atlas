import { useCallback, useRef, useState, type PointerEvent } from 'react';

type Options = {
  onCommit: (direction: 'left' | 'right') => void;
  threshold?: number;
  /**
   * When true, the hook stops updating `translateX` state on each pointermove
   * and instead writes `transform` / `opacity` directly to elements registered
   * via `registerTarget` and `registerOverlay`. Avoids per-frame React renders
   * during the gesture. Consumers in imperative mode should not read
   * `translateX` (it stays at 0).
   */
  imperative?: boolean;
};

type DragState = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  active: boolean;
};

const TOUCH_ACTIVATION = 8;
const MOUSE_ACTIVATION = 14;

export function useSwipeToArchive({
  onCommit,
  threshold = 96,
  imperative = false
}: Options) {
  const [translateX, setTranslateX] = useState(0);
  const [swipingState, setSwipingState] = useState(false);
  const [committed, setCommitted] = useState<null | 'left' | 'right'>(null);
  const dragRef = useRef<DragState | null>(null);
  const widthRef = useRef(0);

  // Imperative-mode targets. Direct DOM writes bypass React rendering.
  const targetRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);
  const leftPillRef = useRef<HTMLElement | null>(null);
  const rightPillRef = useRef<HTMLElement | null>(null);

  const registerTarget = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
  }, []);
  const registerOverlay = useCallback((el: HTMLElement | null) => {
    overlayRef.current = el;
  }, []);
  const registerLeftPill = useCallback((el: HTMLElement | null) => {
    leftPillRef.current = el;
  }, []);
  const registerRightPill = useCallback((el: HTMLElement | null) => {
    rightPillRef.current = el;
  }, []);

  const writeImperative = useCallback(
    (dx: number) => {
      const target = targetRef.current;
      if (target) {
        if (dx === 0) {
          target.style.transform = '';
        } else {
          target.style.transform = `translate3d(${dx}px, 0, 0)`;
        }
      }
      const overlay = overlayRef.current;
      if (overlay) {
        const opacity = Math.min(1, Math.abs(dx) / threshold);
        overlay.style.opacity = String(opacity);
        overlay.style.color =
          Math.abs(dx) > threshold
            ? 'var(--atlas-ember, #c43d2a)'
            : 'var(--atlas-ink-2)';
      }
      const left = leftPillRef.current;
      if (left) left.style.opacity = dx > 0 ? '1' : '0';
      const right = rightPillRef.current;
      if (right) right.style.opacity = dx < 0 ? '1' : '0';
    },
    [threshold]
  );

  const reset = useCallback(
    (opts?: { animate?: boolean }) => {
      dragRef.current = null;
      setTranslateX(0);
      setCommitted(null);
      setSwipingState(false);
      if (imperative) {
        const target = targetRef.current;
        if (target) {
          if (opts?.animate) {
            // Slide the inner element back to its rest position; the wrapper
            // is also animating so the two move together.
            target.style.transition =
              'transform 240ms cubic-bezier(.2,.7,.2,1)';
            target.style.transform = '';
          } else {
            target.style.transition = '';
            target.style.transform = '';
          }
          target.style.willChange = '';
        }
        writeImperative(0);
      }
    },
    [imperative, writeImperative]
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (committed) return;
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      dragRef.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        active: false
      };
      widthRef.current = event.currentTarget.getBoundingClientRect().width;
      if (imperative) {
        const target = targetRef.current;
        if (target) {
          // Cancel any in-flight snap-back so the new gesture is responsive.
          target.style.transition = '';
          target.style.willChange = 'transform';
        }
      }
    },
    [committed, imperative]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const activation = drag.pointerType === 'mouse' ? MOUSE_ACTIVATION : TOUCH_ACTIVATION;

      if (!drag.active) {
        if (Math.abs(dx) > activation && Math.abs(dx) > Math.abs(dy)) {
          drag.active = true;
          setSwipingState(true);
          if (event.currentTarget.setPointerCapture) {
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // ignore — some browsers refuse capture mid-gesture
            }
          }
        } else if (Math.abs(dy) > activation) {
          // user is scrolling vertically; abort the gesture
          dragRef.current = null;
          return;
        } else {
          return;
        }
      }

      if (imperative) {
        writeImperative(dx);
      } else {
        setTranslateX(dx);
      }
    },
    [imperative, writeImperative]
  );

  const onPointerEnd = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const wasActive = drag.active;
      dragRef.current = null;

      if (!wasActive) {
        setSwipingState(false);
        if (imperative) writeImperative(0);
        else setTranslateX(0);
        return;
      }

      if (Math.abs(dx) > threshold) {
        const direction: 'left' | 'right' = dx < 0 ? 'left' : 'right';
        const exitX = direction === 'left' ? -widthRef.current - 32 : widthRef.current + 32;
        if (imperative) {
          const target = targetRef.current;
          if (target) {
            target.style.transition =
              'transform 220ms cubic-bezier(.2,.8,.2,1)';
            target.style.transform = `translate3d(${exitX}px, 0, 0)`;
          }
          // Keep overlay visible at the committed direction, full opacity.
          writeImperative(exitX);
        } else {
          setTranslateX(exitX);
        }
        setSwipingState(false);
        setCommitted(direction);
        onCommit(direction);
      } else {
        if (imperative) {
          const target = targetRef.current;
          if (target) {
            target.style.transition =
              'transform 220ms cubic-bezier(.2,.8,.2,1)';
            target.style.transform = '';
          }
          writeImperative(0);
        } else {
          setTranslateX(0);
        }
        setSwipingState(false);
      }
    },
    [imperative, onCommit, threshold, writeImperative]
  );

  return {
    translateX,
    swiping: swipingState,
    committed,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd
    },
    reset,
    registerTarget,
    registerOverlay,
    registerLeftPill,
    registerRightPill
  };
}
