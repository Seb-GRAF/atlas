import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  createProfile,
  deleteProfile,
  getProfileDetail,
  listProfiles,
  updateProfile
} from '../../../api/profiles';
import type { ProfilePayload, ProfileSummary } from '../../../api/schemas';
import { Hairline, Icons } from '../../components';
import { buildProfileDashboardUrl } from '../../profileRouting';
import { createEmptyProfileDraft, profileDetailToDraft } from '../profileEditorModel';
import { MobileBottomSheet } from './MobileBottomSheet';
import { ProfileEditSheet } from './ProfileEditSheet';

type ProfileSwitcherSheetProps = {
  open: boolean;
  onClose: () => void;
  activeSlug: string | undefined;
};

type EditorState = { mode: 'create' | 'edit'; draft: ProfilePayload } | null;

const newProfileButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  border: 0,
  borderRadius: 12,
  background: 'var(--atlas-soft)',
  color: 'var(--atlas-ink)',
  padding: '12px 14px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--atlas-sans)',
  cursor: 'pointer'
};

export function ProfileSwitcherSheet({ open, onClose, activeSlug }: ProfileSwitcherSheetProps) {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<EditorState>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ['atlas', 'profiles'],
    queryFn: listProfiles,
    enabled: open
  });
  const profiles = profilesQuery.data ?? [];
  const loadError = profilesQuery.error instanceof Error ? profilesQuery.error.message : null;
  const invalidateProfiles = () => qc.invalidateQueries({ queryKey: ['atlas', 'profiles'] });

  const saveProfile = useMutation({
    mutationFn: (payload: ProfilePayload) =>
      editor?.mode === 'edit' ? updateProfile(payload) : createProfile(payload),
    onSuccess: (_result, payload) => {
      setEditor(null);
      setEditorOpen(false);
      invalidateProfiles();
      window.location.href = buildProfileDashboardUrl(payload.slug);
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : 'Impossible de sauvegarder le profil')
  });

  const removeProfile = useMutation({
    mutationFn: deleteProfile,
    onSuccess: (_result, slug) => {
      setConfirmDeleteSlug(null);
      invalidateProfiles();
      if (slug === activeSlug) {
        window.location.href = '/';
      }
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : 'Impossible de supprimer le profil')
  });

  // Reset transient state when the sheet closes.
  useEffect(() => {
    if (!open) {
      setConfirmDeleteSlug(null);
      setActionError(null);
    }
  }, [open]);

  const openCreate = () => {
    setActionError(null);
    setEditor({ mode: 'create', draft: createEmptyProfileDraft() });
    setEditorOpen(true);
  };

  const openEdit = async (slug: string) => {
    setActionError(null);
    try {
      const detail = await getProfileDetail(slug);
      setEditor({ mode: 'edit', draft: profileDetailToDraft(detail) });
      setEditorOpen(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Impossible de charger le profil');
    }
  };

  const handleSelect = (slug: string) => {
    if (slug === activeSlug) {
      onClose();
      return;
    }
    window.location.href = buildProfileDashboardUrl(slug);
  };

  return (
    <>
      <MobileBottomSheet open={open && !editorOpen} onClose={onClose} title="Profils">
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
          Profils
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
            padding: '12px 12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          {profilesQuery.isLoading ? <SheetStatus>Chargement…</SheetStatus> : null}
          {loadError ? (
            <SheetStatus tone="bad">Impossible de charger les profils: {loadError}</SheetStatus>
          ) : null}
          {!profilesQuery.isLoading && !loadError && profiles.length === 0 ? (
            <SheetStatus>Aucun profil trouvé.</SheetStatus>
          ) : null}

          {!loadError
            ? profiles.map((profile) => (
                <ProfileSwitcherRow
                  key={profile.slug}
                  profile={profile}
                  active={profile.slug === activeSlug}
                  confirmingDelete={confirmDeleteSlug === profile.slug}
                  onSelect={() => handleSelect(profile.slug)}
                  onEdit={() => openEdit(profile.slug)}
                  onDeleteIntent={() => {
                    setActionError(null);
                    setConfirmDeleteSlug(profile.slug);
                  }}
                  onCancelDelete={() => setConfirmDeleteSlug(null)}
                  onConfirmDelete={() => removeProfile.mutate(profile.slug)}
                  deletePending={removeProfile.isPending && removeProfile.variables === profile.slug}
                />
              ))
            : null}
        </div>

        <Hairline />
        <div
          style={{
            flexShrink: 0,
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {actionError ? (
            <div style={{ color: 'var(--atlas-bad)', fontSize: 12 }}>{actionError}</div>
          ) : null}
          <button type="button" onClick={openCreate} style={newProfileButtonStyle}>
            <Icons.Plus size={14} stroke={1.7} />
            Nouveau profil
          </button>
        </div>
      </MobileBottomSheet>

      <ProfileEditSheet
        open={editorOpen}
        mode={editor?.mode ?? 'create'}
        draft={editor?.draft ?? null}
        saving={saveProfile.isPending}
        error={actionError}
        onClose={() => {
          setEditorOpen(false);
          // Defer clearing draft until the sheet has slid away; otherwise the
          // form briefly renders empty during the close animation.
          window.setTimeout(() => {
            setEditor(null);
            setActionError(null);
          }, 220);
        }}
        onSave={(payload) => {
          setActionError(null);
          saveProfile.mutate(payload);
        }}
      />
    </>
  );
}

type ProfileSwitcherRowProps = {
  profile: ProfileSummary;
  active: boolean;
  confirmingDelete: boolean;
  deletePending: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDeleteIntent: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
};

function ProfileSwitcherRow({
  profile,
  active,
  confirmingDelete,
  deletePending,
  onSelect,
  onEdit,
  onDeleteIntent,
  onCancelDelete,
  onConfirmDelete
}: ProfileSwitcherRowProps) {
  const title = profile.shortTitle || profile.name || profile.slug;
  const subtitle = profile.areas || `${profile.listingsCount ?? 0} annonce(s)`;

  return (
    <div
      style={{
        borderRadius: 12,
        background: active ? 'var(--atlas-soft)' : 'transparent',
        boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--atlas-line)',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          alignItems: 'center',
          gap: 8
        }}
      >
        <button
          type="button"
          onClick={onSelect}
          style={{
            minWidth: 0,
            border: 0,
            background: 'transparent',
            padding: '8px 8px',
            textAlign: 'left',
            color: 'var(--atlas-ink)',
            fontFamily: 'var(--atlas-sans)',
            cursor: active ? 'default' : 'pointer'
          }}
        >
          <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--atlas-ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {title}
              {active ? (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: 'var(--atlas-good)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                  }}
                >
                  Actif
                </span>
              ) : null}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--atlas-ink-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {subtitle}
            </span>
          </span>
        </button>
        <RowIconButton label={`Modifier ${title}`} onClick={onEdit}>
          <Icons.Settings size={14} stroke={1.7} />
        </RowIconButton>
        <RowIconButton tone="danger" label={`Supprimer ${title}`} onClick={onDeleteIntent}>
          <Icons.X size={14} stroke={1.8} />
        </RowIconButton>
      </div>
      {confirmingDelete ? (
        <div
          style={{
            padding: '4px 8px 6px',
            color: 'var(--atlas-bad)',
            fontSize: 12.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          Supprimer ce profil et ses données ?
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={deletePending}
              style={{
                border: 0,
                borderRadius: 999,
                background: 'var(--atlas-bad)',
                color: '#fff',
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: deletePending ? 'wait' : 'pointer',
                opacity: deletePending ? 0.7 : 1
              }}
            >
              {deletePending ? 'Suppression…' : 'Supprimer'}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              style={{
                border: 0,
                borderRadius: 999,
                background: 'var(--atlas-paper)',
                color: 'var(--atlas-ink-2)',
                boxShadow: 'inset 0 0 0 1px var(--atlas-line)',
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RowIconButton({
  label,
  tone,
  onClick,
  children
}: {
  label: string;
  tone?: 'danger';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        border: 0,
        borderRadius: 10,
        background: tone === 'danger' ? 'var(--atlas-bad-2)' : 'var(--atlas-paper)',
        color: tone === 'danger' ? 'var(--atlas-bad)' : 'var(--atlas-ink-2)',
        boxShadow: tone === 'danger' ? 'none' : 'inset 0 0 0 1px var(--atlas-line)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  );
}

function SheetStatus({ children, tone }: { children: ReactNode; tone?: 'bad' }) {
  return (
    <div
      style={{
        padding: '14px 12px',
        borderRadius: 10,
        color: tone === 'bad' ? 'var(--atlas-bad)' : 'var(--atlas-ink-3)',
        fontSize: 12.5,
        lineHeight: 1.4,
        textAlign: 'center'
      }}
    >
      {children}
    </div>
  );
}
