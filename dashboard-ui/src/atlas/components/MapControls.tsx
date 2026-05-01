import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icons } from '../icons';
import type { Basemap } from '../mapPrefs';

type MapControlsProps = {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onCompass?: () => void;
  basemap?: Basemap;
  onBasemapChange?: (next: Basemap) => void;
  style?: CSSProperties;
  size?: 38 | 40;
};

const buttonBase = (size: number, active = false): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: 12,
  background: active ? 'var(--atlas-ink)' : 'rgba(255,255,255,.94)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow:
    '0 8px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.04)',
  border: 0,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  color: active ? '#fff' : 'var(--atlas-ink)',
  padding: 0,
  transition: 'background 140ms ease, color 140ms ease'
});

function ControlButton({
  onClick,
  children,
  ariaLabel,
  size,
  active,
  innerRef
}: {
  onClick?: () => void;
  children: ReactNode;
  ariaLabel: string;
  size: number;
  active?: boolean;
  innerRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={innerRef}
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={buttonBase(size, active)}
    >
      {children}
    </button>
  );
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onCompass,
  basemap = 'vector',
  onBasemapChange,
  style,
  size = 38
}: MapControlsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const layersBtnRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click or Escape.
  useEffect(() => {
    if (!popoverOpen) return;
    const onDocPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (layersBtnRef.current?.contains(target)) return;
      setPopoverOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPopoverOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [popoverOpen]);

  return (
    <div
      style={{
        position: style?.position ? undefined : 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        ...style
      }}
    >
      <ControlButton onClick={onZoomIn} ariaLabel="Zoom avant" size={size}>
        <span
          style={{
            fontFamily: 'var(--atlas-mono)',
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1
          }}
        >
          +
        </span>
      </ControlButton>
      <ControlButton onClick={onZoomOut} ariaLabel="Zoom arrière" size={size}>
        <span
          style={{
            fontFamily: 'var(--atlas-mono)',
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1
          }}
        >
          −
        </span>
      </ControlButton>
      <ControlButton onClick={onCompass} ariaLabel="Boussole" size={size}>
        <Icons.Compass size={16} stroke={1.6} />
      </ControlButton>
      <div style={{ position: 'relative' }}>
        <ControlButton
          innerRef={(el) => (layersBtnRef.current = el)}
          onClick={() => setPopoverOpen((open) => !open)}
          ariaLabel="Style de carte"
          size={size}
          active={popoverOpen}
        >
          <Icons.Layers size={16} stroke={1.6} />
        </ControlButton>

        {popoverOpen ? (
          <div
            ref={popoverRef}
            role="menu"
            style={{
              position: 'absolute',
              right: size + 8,
              bottom: 0,
              minWidth: 168,
              padding: 6,
              borderRadius: 14,
              background: 'rgba(255,255,255,.96)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow:
                '0 16px 32px -16px rgba(22,20,15,.28), 0 0 0 1px rgba(22,20,15,.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <BasemapOption
              label="Carte"
              hint="Plan vectoriel"
              selected={basemap === 'vector'}
              onClick={() => {
                onBasemapChange?.('vector');
                setPopoverOpen(false);
              }}
            />
            <BasemapOption
              label="Satellite"
              hint="Imagerie aérienne"
              selected={basemap === 'satellite'}
              onClick={() => {
                onBasemapChange?.('satellite');
                setPopoverOpen(false);
              }}
            />
            <BasemapOption
              label="Relief"
              hint="Bâtiments en 3D"
              selected={basemap === 'relief'}
              onClick={() => {
                onBasemapChange?.('relief');
                setPopoverOpen(false);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BasemapOption({
  label,
  hint,
  selected,
  onClick
}: {
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 10,
        background: selected ? 'rgba(22,20,15,.06)' : 'transparent',
        border: 0,
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--atlas-ink)',
        fontFamily: 'var(--atlas-sans)'
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          border: `1.5px solid ${selected ? 'var(--atlas-ink)' : 'rgba(22,20,15,.32)'}`,
          background: selected ? 'var(--atlas-ink)' : 'transparent',
          boxShadow: selected ? 'inset 0 0 0 2.5px #fff' : 'none',
          flex: '0 0 auto'
        }}
      />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.005em' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)' }}>{hint}</span>
      </span>
    </button>
  );
}
