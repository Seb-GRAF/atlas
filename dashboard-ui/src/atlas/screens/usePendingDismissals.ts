import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const UNDO_WINDOW_MS = 5000;

type Pending = {
  id: string;
  expiresAt: number;
  timer: number;
};

export function usePendingDismissals(commit: (id: string) => void) {
  const [ids, setIds] = useState<string[]>([]);
  const pendingRef = useRef<Map<string, Pending>>(new Map());

  // Latest committer; stored in a ref so timers always call the current one
  // and we can flush on unmount without dependency churn.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  const flush = useCallback((id: string) => {
    const entry = pendingRef.current.get(id);
    if (!entry) return;
    window.clearTimeout(entry.timer);
    pendingRef.current.delete(id);
    setIds((prev) => prev.filter((x) => x !== id));
    commitRef.current(id);
  }, []);

  const schedule = useCallback(
    (id: string) => {
      // If the same id is already pending, do nothing.
      if (pendingRef.current.has(id)) return;

      const timer = window.setTimeout(() => {
        flush(id);
      }, UNDO_WINDOW_MS);

      pendingRef.current.set(id, {
        id,
        expiresAt: Date.now() + UNDO_WINDOW_MS,
        timer
      });
      setIds((prev) => [...prev, id]);
    },
    [flush]
  );

  const undoAll = useCallback(() => {
    for (const entry of pendingRef.current.values()) {
      window.clearTimeout(entry.timer);
    }
    pendingRef.current.clear();
    setIds([]);
  }, []);

  // On unmount: flush any pending dismissals so the user doesn't lose them.
  useEffect(() => {
    return () => {
      const entries = Array.from(pendingRef.current.values());
      pendingRef.current.clear();
      for (const entry of entries) {
        window.clearTimeout(entry.timer);
        commitRef.current(entry.id);
      }
    };
  }, []);

  const idSet = useMemo(() => new Set(ids), [ids]);

  return {
    pendingIds: idSet,
    pendingCount: ids.length,
    schedule,
    undoAll
  };
}
