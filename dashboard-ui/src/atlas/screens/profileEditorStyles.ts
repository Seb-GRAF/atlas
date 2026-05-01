import type { CSSProperties } from 'react';

export const shellStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'grid',
  placeItems: 'center',
  padding: 24
};

export const scrimStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  border: 0,
  padding: 0,
  background: 'rgba(22,20,15,.32)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)'
};

export const dialogStyle: CSSProperties = {
  position: 'relative',
  width: 'min(860px, calc(100vw - 36px))',
  maxHeight: 'calc(100vh - 48px)',
  overflow: 'hidden',
  borderRadius: 18,
  background: 'var(--atlas-paper)',
  boxShadow: '0 36px 90px -42px rgba(22,20,15,.72), inset 0 0 0 1px rgba(22,20,15,.08)',
  display: 'flex',
  flexDirection: 'column'
};

export const labelStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)',
  marginBottom: 7
};

export const sliderValueStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  color: 'var(--atlas-ink)',
  fontFamily: 'var(--atlas-mono)',
  fontSize: 12.5,
  marginBottom: 5
};
