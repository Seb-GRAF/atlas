import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AtlasButton, Hairline } from '../components';
import { dialogStyle, scrimStyle, shellStyle } from './profileEditorStyles';

type ConfirmDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div style={shellStyle}>
      <button type="button" aria-label="Fermer" onClick={onCancel} style={scrimStyle} />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{ ...dialogStyle, width: 'min(420px, calc(100vw - 36px))' }}
      >
        <div style={{ padding: '20px 22px 16px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, letterSpacing: 0 }}>{title}</h2>
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: 'var(--atlas-ink-2)',
              lineHeight: 1.5
            }}
          >
            {message}
          </div>
        </div>
        <Hairline />
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8
          }}
        >
          <AtlasButton variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </AtlasButton>
          <AtlasButton
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </AtlasButton>
        </div>
      </section>
    </div>,
    document.body
  );
}
