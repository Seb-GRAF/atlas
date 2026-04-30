import type { CSSProperties, ReactNode } from 'react';
import { GlassPanel, Icons } from '../../components';

export type MobileTab = 'list' | 'map';

type MobileTabBarProps = {
  active: MobileTab;
  onSelect: (mode: MobileTab) => void;
  counts?: { newCount?: number };
};

type TabDef = {
  key: MobileTab;
  label: string;
  icon: ReactNode;
};

const wrapperStyle: CSSProperties = {
  position: 'absolute',
  left: 12,
  right: 12,
  bottom: `calc(env(safe-area-inset-bottom, 16px) + 8px)`,
  zIndex: 7,
  borderRadius: 999,
  padding: 4,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr'
};

const tabBaseStyle: CSSProperties = {
  position: 'relative',
  padding: '8px 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontFamily: 'var(--atlas-sans)',
  fontSize: 13,
  fontWeight: 500,
  border: 0,
  cursor: 'pointer',
  transition: 'background 140ms ease, color 140ms ease'
};

export function MobileTabBar({ active, onSelect, counts }: MobileTabBarProps) {
  const newCount = counts?.newCount ?? 0;

  const tabs: TabDef[] = [
    { key: 'list', label: 'Liste', icon: <Icons.List size={15} stroke={1.7} /> },
    { key: 'map', label: 'Carte', icon: <Icons.Map size={15} stroke={1.7} /> }
  ];

  return (
    <GlassPanel variant="panel" style={wrapperStyle}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const showDot = tab.key === 'list' && newCount > 0;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            aria-pressed={isActive}
            style={{
              ...tabBaseStyle,
              background: isActive ? 'var(--atlas-ink)' : 'transparent',
              color: isActive ? '#fff' : 'var(--atlas-ink-2)'
            }}
          >
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              {tab.icon}
              {showDot ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--atlas-ember)',
                    boxShadow: isActive
                      ? '0 0 0 1.5px var(--atlas-ink)'
                      : '0 0 0 1.5px var(--atlas-paper)'
                  }}
                />
              ) : null}
            </span>
            {tab.label}
          </button>
        );
      })}
    </GlassPanel>
  );
}
