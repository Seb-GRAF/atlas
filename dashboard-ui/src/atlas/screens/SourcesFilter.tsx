import { useMemo, type CSSProperties } from 'react';
import { SourceMono } from '../components';
import type { AtlasListing } from '../types';

type SourcesFilterProps = {
  listings: AtlasListing[];
  selected: string[];
  onChange: (next: string[]) => void;
  style?: CSSProperties;
  compact?: boolean;
  padInline?: number;
};

type SourceCount = { source: string; count: number };

function countSources(listings: AtlasListing[]): SourceCount[] {
  const map = new Map<string, number>();
  for (const l of listings) {
    const key = String(l.source || '').trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

function shortLabel(source: string): string {
  return source.replace(/\.ch$/i, '');
}

export function SourcesFilter({
  listings,
  selected,
  onChange,
  style,
  compact = false,
  padInline = 0
}: SourcesFilterProps) {
  const sources = useMemo(() => countSources(listings), [listings]);
  if (sources.length <= 1) return null;

  const selectedSet = new Set(selected);
  const allActive = selected.length === 0;

  const toggle = (source: string) => {
    if (selectedSet.has(source)) {
      const next = selected.filter((s) => s !== source);
      onChange(next);
    } else {
      onChange([...selected, source]);
    }
  };

  const pillBase: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: compact ? '4px 8px 4px 4px' : '4px 10px 4px 4px',
    borderRadius: 999,
    fontSize: compact ? 11.5 : 12,
    fontFamily: 'var(--atlas-sans)',
    fontWeight: 500,
    cursor: 'pointer',
    border: 0,
    whiteSpace: 'nowrap',
    transition: 'background 140ms ease, color 140ms ease, opacity 140ms ease'
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'nowrap',
        overflowX: 'auto',
        paddingLeft: padInline,
        paddingRight: padInline,
        scrollPaddingLeft: padInline,
        scrollPaddingRight: padInline,
        ...style
      }}
      className="atlas-no-scrollbar"
    >
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={allActive}
        style={{
          ...pillBase,
          padding: compact ? '4px 10px' : '4px 12px',
          background: allActive ? 'var(--atlas-ink)' : 'var(--atlas-glass-pill-bg)',
          color: allActive ? '#fff' : 'var(--atlas-ink-2)',
          boxShadow: allActive ? 'none' : 'inset 0 0 0 1px var(--atlas-line)'
        }}
      >
        Toutes
      </button>
      {sources.map(({ source, count }) => {
        const active = selectedSet.has(source);
        const dimmed = !allActive && !active;
        return (
          <button
            key={source}
            type="button"
            onClick={() => toggle(source)}
            aria-pressed={active}
            title={source}
            style={{
              ...pillBase,
              background: active ? 'var(--atlas-ink)' : 'var(--atlas-glass-pill-bg)',
              color: active ? '#fff' : 'var(--atlas-ink-2)',
              opacity: dimmed ? 0.55 : 1,
              boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--atlas-line)'
            }}
          >
            <SourceMono source={source} size={20} />
            <span>{shortLabel(source)}</span>
            <span
              style={{
                fontFamily: 'var(--atlas-mono)',
                fontSize: 10.5,
                opacity: 0.6
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
