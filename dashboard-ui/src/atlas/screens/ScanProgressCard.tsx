import type { CSSProperties } from 'react';
import { GlassPanel } from '../components';
import type { ScanSourceRow } from '../scan';
import { ScanProgressContent } from './ScanProgressContent';

type ScanProgressCardProps = {
  done: number;
  total: number;
  sources: ScanSourceRow[];
  onCancel: () => void;
  onBackground: () => void;
  finished?: { kind: 'done' | 'error' | 'cancelled'; newCount?: number; message?: string };
};

const cardStyle: CSSProperties = {
  position: 'absolute',
  top: 76,
  left: 432,
  width: 360,
  padding: '18px 20px',
  zIndex: 4
};

export function ScanProgressCard(props: ScanProgressCardProps) {
  return (
    <GlassPanel variant="card" style={cardStyle}>
      <ScanProgressContent {...props} />
    </GlassPanel>
  );
}
