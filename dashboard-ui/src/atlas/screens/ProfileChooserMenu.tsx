import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { createProfile, deleteProfile, getProfileDetail, listProfiles, updateProfile } from '../../api/profiles';
import type { ProfilePayload } from '../../api/schemas';
import { Hairline, Icons } from '../components';
import { buildProfileDashboardUrl } from '../profileRouting';
import { ProfileEditorModal } from './ProfileEditorModal';
import { ProfileChooserRow } from './ProfileChooserRow';
import { createEmptyProfileDraft, profileDetailToDraft } from './profileEditorModel';

type ProfileChooserMenuProps = {
  activeSlug: string;
  onSelect: (slug: string) => void;
  onClose: () => void;
};

const menuLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 0,
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--atlas-ink)',
  textDecoration: 'none',
  padding: '9px 10px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--atlas-sans)',
  cursor: 'pointer'
};

export function ProfileChooserMenu({ activeSlug, onSelect, onClose }: ProfileChooserMenuProps) {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; draft: ProfilePayload } | null>(null);
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const profilesQuery = useQuery({
    queryKey: ['atlas', 'profiles'],
    queryFn: listProfiles
  });
  const profiles = profilesQuery.data ?? [];
  const error = profilesQuery.error instanceof Error ? profilesQuery.error.message : null;
  const invalidateProfiles = () => qc.invalidateQueries({ queryKey: ['atlas', 'profiles'] });

  const saveProfile = useMutation({
    mutationFn: (payload: ProfilePayload) => (editor?.mode === 'edit' ? updateProfile(payload) : createProfile(payload)),
    onSuccess: (_result, payload) => {
      setEditor(null);
      invalidateProfiles();
      window.location.href = buildProfileDashboardUrl(payload.slug);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Impossible de sauvegarder le profil')
  });

  const removeProfile = useMutation({
    mutationFn: deleteProfile,
    onSuccess: (_result, slug) => {
      setConfirmDeleteSlug(null);
      invalidateProfiles();
      if (slug === activeSlug) window.location.href = '/';
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Impossible de supprimer le profil')
  });

  const editProfile = async (slug: string) => {
    setActionError(null);
    try {
      const detail = await getProfileDetail(slug);
      setEditor({ mode: 'edit', draft: profileDetailToDraft(detail) });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Impossible de charger le profil');
    }
  };

  return (
    <div
      role="menu"
      aria-label="Profils"
      style={{
        position: 'absolute',
        top: 42,
        left: 0,
        minWidth: 250,
        padding: 6,
        borderRadius: 14,
        background: 'var(--atlas-glass-panel-bg)',
        backdropFilter: 'var(--atlas-glass-panel-blur)',
        WebkitBackdropFilter: 'var(--atlas-glass-panel-blur)',
        boxShadow: 'var(--atlas-shadow-2)',
        zIndex: 20,
        display: 'grid',
        gap: 4
      }}
    >
      {profilesQuery.isLoading ? <MenuStatus>Chargement...</MenuStatus> : null}
      {error ? <MenuStatus tone="bad">Impossible de charger les profils: {error}</MenuStatus> : null}
      {!profilesQuery.isLoading && !error && profiles.length === 0 ? <MenuStatus>Aucun profil trouvé.</MenuStatus> : null}

      {!error
        ? profiles.map((profile) => (
            <ProfileChooserRow
              key={profile.slug}
              profile={profile}
              active={profile.slug === activeSlug}
              confirmingDelete={confirmDeleteSlug === profile.slug}
              onSelect={() => {
                if (profile.slug === activeSlug) onClose();
                else onSelect(profile.slug);
              }}
              onEdit={() => editProfile(profile.slug)}
              onDeleteIntent={() => setConfirmDeleteSlug(profile.slug)}
              onCancelDelete={() => setConfirmDeleteSlug(null)}
              onConfirmDelete={() => removeProfile.mutate(profile.slug)}
            />
          ))
        : null}

      <Hairline />
      {actionError ? <MenuStatus tone="bad">{actionError}</MenuStatus> : null}
      <button
        role="menuitem"
        type="button"
        onClick={() => {
          setActionError(null);
          setEditor({ mode: 'create', draft: createEmptyProfileDraft() });
        }}
        style={menuLinkStyle}
      >
        <Icons.Plus size={14} stroke={1.7} />
        Nouveau profil
      </button>
      {editor ? (
        <ProfileEditorModal
          mode={editor.mode}
          draft={editor.draft}
          saving={saveProfile.isPending}
          error={actionError}
          onClose={() => setEditor(null)}
          onSave={(payload) => {
            setActionError(null);
            saveProfile.mutate(payload);
          }}
        />
      ) : null}
    </div>
  );
}

function MenuStatus({ children, tone }: { children: ReactNode; tone?: 'bad' }) {
  return (
    <div
      style={{
        padding: '10px',
        borderRadius: 10,
        color: tone === 'bad' ? 'var(--atlas-bad)' : 'var(--atlas-ink-3)',
        fontSize: 12.5,
        lineHeight: 1.35
      }}
    >
      {children}
    </div>
  );
}
