import { useEffect } from 'react';

type Handlers = {
  onNext?: () => void;
  onPrev?: () => void;
  onEscape?: () => void;
  onEnter?: () => void;
  onSlash?: () => void;
  onScan?: () => void;
  onSettings?: () => void;
  onStatusKey?: (digit: 1 | 2 | 3 | 4 | 5) => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useAtlasKeyboard(handlers: Handlers) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Always allow Escape to bubble even from inputs.
      if (event.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }
      if (isTypingTarget(event.target)) return;

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          event.preventDefault();
          handlers.onNext?.();
          return;
        case 'k':
        case 'ArrowUp':
          event.preventDefault();
          handlers.onPrev?.();
          return;
        case 'Enter':
          handlers.onEnter?.();
          return;
        case '/':
          event.preventDefault();
          handlers.onSlash?.();
          return;
        case 's':
          handlers.onScan?.();
          return;
        case ',':
          handlers.onSettings?.();
          return;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          handlers.onStatusKey?.(Number(event.key) as 1 | 2 | 3 | 4 | 5);
          return;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
