import { useEffect, useState } from 'react';
import type { ProfilePayload } from '../../../api/schemas';
import { AtlasButton, Hairline } from '../../components';
import { MobileBottomSheet } from './MobileBottomSheet';
import { ProfileForm } from '../ProfileForm';
import { prepareProfilePayload } from '../profileEditorModel';

type ProfileEditSheetProps = {
  open: boolean;
  mode: 'create' | 'edit';
  draft: ProfilePayload | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: ProfilePayload) => void;
};

export function ProfileEditSheet({
  open,
  mode,
  draft: initialDraft,
  saving,
  error,
  onClose,
  onSave
}: ProfileEditSheetProps) {
  const [draft, setDraft] = useState<ProfilePayload | null>(initialDraft);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
    setLocalError(null);
  }, [initialDraft]);

  useEffect(() => {
    if (!open) setLocalError(null);
  }, [open]);

  const title = mode === 'create' ? 'Nouveau profil' : 'Modifier le profil';
  const visibleError = localError || error;

  const save = () => {
    if (!draft) return;
    const payload = prepareProfilePayload(mode, draft);
    if (!payload.shortTitle) {
      setLocalError('Titre requis');
      return;
    }
    if (!payload.areas.length) {
      setLocalError('Ajoutez au moins une zone');
      return;
    }
    setLocalError(null);
    onSave(payload);
  };

  return (
    <MobileBottomSheet open={open} onClose={onClose} title={title}>
      <div
        style={{
          padding: '6px 16px 12px',
          fontSize: 17,
          fontWeight: 500,
          letterSpacing: '-0.018em',
          color: 'var(--atlas-ink)',
          flexShrink: 0
        }}
      >
        {title}
      </div>
      <Hairline />

      <div
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          padding: '16px 16px 12px'
        }}
      >
        {draft ? <ProfileForm draft={draft} onChange={setDraft} layout="mobile" /> : null}
      </div>

      <Hairline />
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {visibleError ? (
          <div
            style={{
              marginRight: 'auto',
              color: 'var(--atlas-bad)',
              fontSize: 12
            }}
          >
            {visibleError}
          </div>
        ) : (
          <span style={{ marginRight: 'auto' }} />
        )}
        <AtlasButton
          variant="ghost"
          onClick={onClose}
          style={{ background: 'transparent', color: 'var(--atlas-ink-2)' }}
        >
          Annuler
        </AtlasButton>
        <AtlasButton
          variant="primary"
          disabled={saving || !draft}
          onClick={save}
          style={saving ? { opacity: 0.6, cursor: 'wait' } : undefined}
        >
          {saving ? 'Enregistrement…' : mode === 'create' ? 'Créer le profil' : 'Enregistrer'}
        </AtlasButton>
      </div>
    </MobileBottomSheet>
  );
}
