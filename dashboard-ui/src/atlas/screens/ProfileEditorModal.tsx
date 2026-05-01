import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProfilePayload } from '../../api/schemas';
import { AtlasButton, AtlasIconButton, Hairline, Icons } from '../components';
import { ProfileForm } from './ProfileForm';
import { prepareProfilePayload } from './profileEditorModel';
import { dialogStyle, labelStyle, scrimStyle, shellStyle } from './profileEditorStyles';

type ProfileEditorModalProps = {
  mode: 'create' | 'edit';
  draft: ProfilePayload;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: ProfilePayload) => void;
};

export function ProfileEditorModal({ mode, draft: initialDraft, saving, error, onClose, onSave }: ProfileEditorModalProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
    setLocalError(null);
  }, [initialDraft]);

  const title = mode === 'create' ? 'Nouveau profil' : 'Modifier le profil';
  const visibleError = localError || error;

  const save = () => {
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

  return createPortal(
    <div style={shellStyle}>
      <button type="button" aria-label="Fermer" onClick={onClose} style={scrimStyle} />
      <section role="dialog" aria-modal="true" aria-label={title} style={dialogStyle}>
        <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={labelStyle}>Profil</div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: 0 }}>{title}</h2>
          </div>
          <AtlasIconButton onClick={onClose} aria-label="Fermer">
            <Icons.Close size={15} stroke={1.7} />
          </AtlasIconButton>
        </div>
        <Hairline />
        <div style={{ overflowY: 'auto', padding: 22 }}>
          <ProfileForm draft={draft} onChange={setDraft} layout="desktop" />
        </div>
        <Hairline />
        <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {visibleError ? <div style={{ marginRight: 'auto', color: 'var(--atlas-bad)', fontSize: 12 }}>{visibleError}</div> : null}
          <AtlasButton variant="ghost" onClick={onClose}>Annuler</AtlasButton>
          <AtlasButton variant="primary" disabled={saving} onClick={save}>
            {saving ? 'Enregistrement...' : mode === 'create' ? 'Créer le profil' : 'Enregistrer'}
          </AtlasButton>
        </div>
      </section>
    </div>,
    document.body
  );
}
