import { useCallback, useEffect, useRef, useState } from 'react';

export type SwipeDirection = 'left' | 'right';

type GestureOptions = {
  enabled?: boolean;
  onCommit: (direction: SwipeDirection) => void;
  onTap?: () => void;
  onProgress?: (dx: number) => void;
  distanceRatio?: number;
  velocityThreshold?: number;
};

type PointerHandlers = {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
};

const TAP_DISTANCE = 6;
const TAP_DURATION = 250;
const MAX_ROTATION_DEG = 18;
const ROTATION_FACTOR = 0.07;
const VERTICAL_DAMPENING = 0.35;
const SPRING_BACK_MS = 320;
const EXIT_MS = 320;
const EXIT_OVERSHOOT = 1.5;
const EXIT_ROTATION_DEG = 26;
const HORIZONTAL_LOCK_PX = 8;

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    !!target.closest('a, button, input, textarea, select, [role="button"], [contenteditable="true"]')
  );
}

export function useSwipeGesture({
  enabled = true,
  onCommit,
  onTap,
  onProgress,
  distanceRatio = 0.35,
  velocityThreshold = 0.6
}: GestureOptions) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastRef = useRef<{ x: number; t: number } | null>(null);
  const dragRef = useRef({ dx: 0, dy: 0 });
  const rafRef = useRef<number | null>(null);
  const exitedRef = useRef(false);
  const axisRef = useRef<'horizontal' | 'vertical' | null>(null);
  const onCommitRef = useRef(onCommit);
  const onTapRef = useRef(onTap);
  const onProgressRef = useRef(onProgress);

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);
  useEffect(() => { onTapRef.current = onTap; }, [onTap]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const applyTransform = useCallback((dx: number, dy: number) => {
    const node = cardRef.current;
    if (!node) return;
    const rotation = Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, dx * ROTATION_FACTOR));
    node.style.transform = `translate3d(${dx}px, ${dy * VERTICAL_DAMPENING}px, 0) rotate(${rotation}deg)`;
  }, []);

  const scheduleFrame = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyTransform(dragRef.current.dx, dragRef.current.dy);
      onProgressRef.current?.(dragRef.current.dx);
    });
  }, [applyTransform]);

  const resetTransform = useCallback((withTransition: boolean) => {
    const node = cardRef.current;
    if (!node) return;
    if (withTransition) {
      node.style.transition = `transform ${SPRING_BACK_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    } else {
      node.style.transition = '';
    }
    node.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    onProgressRef.current?.(0);
  }, []);

  const beginExit = useCallback((direction: SwipeDirection) => {
    if (exitedRef.current) return;
    const node = cardRef.current;
    if (!node) {
      onCommitRef.current(direction);
      return;
    }
    exitedRef.current = true;
    const width = window.innerWidth || 800;
    const targetX = direction === 'right' ? width * EXIT_OVERSHOOT : -width * EXIT_OVERSHOOT;
    const rotation = direction === 'right' ? EXIT_ROTATION_DEG : -EXIT_ROTATION_DEG;
    node.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${EXIT_MS}ms ease-out, box-shadow ${EXIT_MS}ms ease-out`;
    node.style.transform = `translate3d(${targetX}px, -40px, 0) rotate(${rotation}deg)`;
    node.style.opacity = '0';

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      node.removeEventListener('transitionend', fire);
      onCommitRef.current(direction);
    };
    node.addEventListener('transitionend', fire);
    window.setTimeout(fire, EXIT_MS + 60);
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || exitedRef.current) return;
    if (isInteractiveTarget(event.target)) return;
    const node = cardRef.current;
    if (!node) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      // ignore — capture is best-effort
    }
    startRef.current = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    lastRef.current = { x: event.clientX, t: event.timeStamp };
    dragRef.current = { dx: 0, dy: 0 };
    axisRef.current = event.pointerType === 'mouse' ? 'horizontal' : null;
    node.style.transition = '';
    setIsDragging(true);
  }, [enabled]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;

    if (axisRef.current == null) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < HORIZONTAL_LOCK_PX && absY < HORIZONTAL_LOCK_PX) return;
      axisRef.current = absX > absY ? 'horizontal' : 'vertical';
    }
    if (axisRef.current === 'vertical') return;

    dragRef.current = { dx, dy };
    lastRef.current = { x: event.clientX, t: event.timeStamp };
    scheduleFrame();
  }, [scheduleFrame]);

  const finishDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    const last = lastRef.current;
    const axis = axisRef.current;
    startRef.current = null;
    lastRef.current = null;
    axisRef.current = null;
    if (!start) return;

    const node = cardRef.current;
    try {
      node?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);

    const dx = dragRef.current.dx;
    const dy = dragRef.current.dy;
    const dt = Math.max(1, event.timeStamp - start.t);
    const isTap = Math.abs(dx) < TAP_DISTANCE && Math.abs(dy) < TAP_DISTANCE && dt < TAP_DURATION;

    if (isTap) {
      resetTransform(false);
      onTapRef.current?.();
      return;
    }

    if (axis === 'vertical') {
      resetTransform(true);
      return;
    }

    const width = node?.offsetWidth || window.innerWidth || 800;
    const recentDx = last && last.t !== start.t ? (last.x - start.x) / Math.max(1, last.t - start.t) : 0;
    const overDistance = Math.abs(dx) > distanceRatio * width;
    const overVelocity = Math.abs(recentDx) > velocityThreshold;

    if (overDistance || overVelocity) {
      beginExit(dx >= 0 ? 'right' : 'left');
    } else {
      resetTransform(true);
    }
  }, [beginExit, distanceRatio, resetTransform, velocityThreshold]);

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    startRef.current = null;
    lastRef.current = null;
    axisRef.current = null;
    setIsDragging(false);
    try {
      cardRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    resetTransform(true);
  }, [resetTransform]);

  const reset = useCallback(() => {
    exitedRef.current = false;
    dragRef.current = { dx: 0, dy: 0 };
    axisRef.current = null;
    const node = cardRef.current;
    if (!node) return;
    node.style.transition = '';
    node.style.transform = '';
    node.style.opacity = '';
  }, []);

  const handlers: PointerHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: handlePointerCancel
  };

  return {
    cardRef,
    handlers,
    isDragging,
    beginExit,
    reset
  };
}
