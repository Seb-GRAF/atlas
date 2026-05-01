import type { CSSProperties } from 'react';

type UndoToastProps = {
  count: number;
  onUndo: () => void;
  bottomOffset?: number;
};

const wrapperStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  background: 'rgba(22,20,15,.92)',
  color: '#fff',
  padding: '10px 8px 10px 16px',
  borderRadius: 999,
  boxShadow: '0 10px 28px -10px rgba(22,20,15,.45), 0 0 0 1px rgba(255,255,255,.04)',
  fontFamily: 'var(--atlas-sans)',
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  zIndex: 50,
  pointerEvents: 'auto'
};

const undoBtnStyle: CSSProperties = {
  background: 'transparent',
  color: '#fff',
  border: 0,
  padding: '6px 14px',
  borderRadius: 999,
  fontFamily: 'var(--atlas-sans)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '0.01em'
};

export function UndoToast({ count, onUndo, bottomOffset = 24 }: UndoToastProps) {
  const label = count > 1 ? `${count} annonces archivées` : 'Annonce archivée';
  return (
    <div role="status" aria-live="polite" style={{ ...wrapperStyle, bottom: bottomOffset }}>
      <span>{label}</span>
      <button type="button" onClick={onUndo} style={undoBtnStyle}>
        Annuler
      </button>
    </div>
  );
}
