import type { CSSProperties, ReactNode } from 'react';
import { Icons } from '../icons';

type MapControlsProps = {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onCompass?: () => void;
  onLayers?: () => void;
  style?: CSSProperties;
  size?: 38 | 40;
};

const buttonBase = (size: number): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: 12,
  background: 'rgba(255,255,255,.94)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow:
    '0 8px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.04)',
  border: 0,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  color: 'var(--atlas-ink)',
  padding: 0
});

function ControlButton({
  onClick,
  children,
  ariaLabel,
  size
}: {
  onClick?: () => void;
  children: ReactNode;
  ariaLabel: string;
  size: number;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={buttonBase(size)}
    >
      {children}
    </button>
  );
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onCompass,
  onLayers,
  style,
  size = 38
}: MapControlsProps) {
  return (
    <div
      style={{
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
      <ControlButton onClick={onLayers} ariaLabel="Couches de carte" size={size}>
        <Icons.Layers size={16} stroke={1.6} />
      </ControlButton>
    </div>
  );
}
