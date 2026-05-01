import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icons } from '../components';
import type { AtlasSortValue } from '../url';

export const SORT_LABELS: Record<AtlasSortValue, string> = {
  recent: 'Plus récents',
  priceAsc: 'Prix ↑',
  priceDesc: 'Prix ↓'
};

const OPTIONS: AtlasSortValue[] = ['recent', 'priceAsc', 'priceDesc'];

type SortMenuProps = {
  sort: AtlasSortValue;
  onChange: (sort: AtlasSortValue) => void;
  buttonStyle?: CSSProperties;
  align?: 'left' | 'right';
};

export function SortMenu({ sort, onChange, buttonStyle, align = 'right' }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const defaultBtnStyle: CSSProperties = {
    background: 'transparent',
    border: 0,
    fontFamily: 'var(--atlas-sans)',
    fontSize: 12,
    color: 'var(--atlas-ink-2)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: 0,
    marginInlineEnd: -6
  };

  const menuStyle: CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: align === 'left' ? 0 : undefined,
    right: align === 'right' ? 0 : undefined,
    minWidth: 160,
    background: 'var(--atlas-paper)',
    boxShadow: 'var(--atlas-shadow-2), 0 0 0 1px var(--atlas-line)',
    borderRadius: 10,
    padding: 4,
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--atlas-sans)'
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ ...defaultBtnStyle, ...buttonStyle }}
      >
        {SORT_LABELS[sort]}
        <Icons.ChevronDown size={11} stroke={1.6} />
      </button>
      {open ? (
        <div role="listbox" style={menuStyle}>
          {OPTIONS.map((value) => {
            const active = value === sort;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(value);
                  setOpen(false);
                }}
                style={{
                  background: active ? 'var(--atlas-soft)' : 'transparent',
                  border: 0,
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 12.5,
                  color: active ? 'var(--atlas-ink)' : 'var(--atlas-ink-2)',
                  fontWeight: active ? 500 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                {SORT_LABELS[value]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
