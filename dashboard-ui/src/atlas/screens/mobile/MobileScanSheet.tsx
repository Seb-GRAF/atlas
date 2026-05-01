import type { CSSProperties } from 'react';
import type { ScanJob } from '../../../api/schemas';
import type { AtlasProfile } from '../../types';
import { buildScanSources } from '../../scan';
import { ScanProgressContent } from '../ScanProgressContent';
import { MobileBottomSheet } from './MobileBottomSheet';

type MobileScanSheetProps = {
  open: boolean;
  onClose: () => void;
  scan: ScanJob | null;
  profile: AtlasProfile;
  onCancel: () => void;
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 18px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14
};

const noticeBaseStyle: CSSProperties = {
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 13,
  fontFamily: 'var(--atlas-sans)',
  lineHeight: 1.4
};

const successNoticeStyle: CSSProperties = {
  ...noticeBaseStyle,
  background: 'rgba(46, 160, 67, 0.10)',
  color: 'var(--atlas-good)'
};

const errorNoticeStyle: CSSProperties = {
  ...noticeBaseStyle,
  background: 'rgba(220, 38, 38, 0.10)',
  color: 'var(--atlas-bad)'
};

function doneSummary(scan: ScanJob): string {
  if (scan.summary) return scan.summary;
  const n = scan.newCount ?? 0;
  if (n === 0) return 'Scan terminé — aucune nouvelle annonce.';
  if (n === 1) return 'Scan terminé — 1 nouvelle annonce.';
  return `Scan terminé — ${n} nouvelles annonces.`;
}

export function MobileScanSheet({
  open,
  onClose,
  scan,
  profile,
  onCancel
}: MobileScanSheetProps) {
  const { total, done, sources } = buildScanSources(profile, scan);
  const status = scan?.status;

  return (
    <MobileBottomSheet open={open} onClose={onClose} title="Scan">
      <div style={bodyStyle}>
        {status === 'done' && scan ? (
          <div style={successNoticeStyle}>{doneSummary(scan)}</div>
        ) : null}
        {status === 'error' ? (
          <div style={errorNoticeStyle}>
            {scan?.error ? `Échec du scan : ${scan.error}` : 'Le scan a échoué.'}
          </div>
        ) : null}
        {status === 'cancelled' ? (
          <div style={noticeBaseStyle}>Scan annulé.</div>
        ) : null}

        <ScanProgressContent
          total={total}
          done={done}
          sources={sources}
          onCancel={onCancel}
          onBackground={onClose}
        />
      </div>
    </MobileBottomSheet>
  );
}
