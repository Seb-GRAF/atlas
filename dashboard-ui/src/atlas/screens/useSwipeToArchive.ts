import { useCallback, useRef, useState, type PointerEvent } from 'react';

type Options = {
  onCommit: (direction: 'left' | 'right') => void;
  threshold?: number;
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

export function useSwipeToArchive({ onCommit, threshold = 96 }: Options) {
  const [translateX, setTranslateX] = useState(0);
  const [committed, setCommitted] = useState<null | 'left' | 'right'>(null);
  const dragRef = useRef<DragState | null>(null);
  const widthRef = useRef(0);

  const reset = useCallback(() => {
    dragRef.current = null;
    setTranslateX(0);
    setCommitted(null);
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
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
  }, [committed]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const activation = drag.pointerType === 'mouse' ? MOUSE_ACTIVATION : TOUCH_ACTIVATION;

    if (!drag.active) {
      if (Math.abs(dx) > activation && Math.abs(dx) > Math.abs(dy)) {
        drag.active = true;
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

    setTranslateX(dx);
  }, []);

  const onPointerEnd = useCallback((event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const wasActive = drag.active;
    dragRef.current = null;

    if (!wasActive) {
      setTranslateX(0);
      return;
    }

    if (Math.abs(dx) > threshold) {
      const direction: 'left' | 'right' = dx < 0 ? 'left' : 'right';
      const exitX = direction === 'left' ? -widthRef.current - 32 : widthRef.current + 32;
      setCommitted(direction);
      setTranslateX(exitX);
      onCommit(direction);
    } else {
      setTranslateX(0);
    }
  }, [onCommit, threshold]);

  return {
    translateX,
    swiping: dragRef.current?.active ?? false,
    committed,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd
    },
    reset
  };
}
