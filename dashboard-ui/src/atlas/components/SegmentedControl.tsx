import type { ReactNode } from 'react';

type SegmentedItem<T extends string> = {
  value: T;
  label: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
};

export function AtlasSegmentedControl<T extends string>({
  items,
  value,
  onChange,
  ariaLabel
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 4,
        padding: 3,
        borderRadius: 10,
        background: 'var(--atlas-soft)'
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            key={item.value}
            onClick={() => onChange(item.value)}
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              border: 0,
              fontFamily: 'var(--atlas-sans)',
              fontSize: 11.5,
              fontWeight: 500,
              letterSpacing: '-0.005em',
              cursor: 'pointer',
              background: active ? 'var(--atlas-ink)' : 'transparent',
              color: active ? '#fff' : 'var(--atlas-ink-2)',
              transition: 'background 140ms ease, color 140ms ease'
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
