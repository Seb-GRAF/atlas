import type { CSSProperties, ReactNode } from 'react';
import type { ProfileSummary } from '../../api/schemas';
import { Icons } from '../components';

type ProfileChooserRowProps = {
  profile: ProfileSummary;
  active: boolean;
  confirmingDelete: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDeleteIntent: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
};

const rowStyle: CSSProperties = {
  borderRadius: 10,
  padding: 4,
  display: 'grid',
  gridTemplateColumns: '1fr auto auto auto',
  gap: 4,
  alignItems: 'center'
};

const selectStyle: CSSProperties = {
  minWidth: 0,
  border: 0,
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--atlas-ink)',
  padding: '7px 6px',
  textAlign: 'left',
  fontFamily: 'var(--atlas-sans)'
};

const confirmButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 999,
  background: 'var(--atlas-bad)',
  color: '#fff',
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer'
};

const cancelButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 999,
  background: 'var(--atlas-paper)',
  color: 'var(--atlas-ink-2)',
  boxShadow: 'inset 0 0 0 1px var(--atlas-line)',
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer'
};

export function ProfileChooserRow({
  profile,
  active,
  confirmingDelete,
  onSelect,
  onEdit,
  onDeleteIntent,
  onCancelDelete,
  onConfirmDelete
}: ProfileChooserRowProps) {
  const title = profile.shortTitle || profile.name || profile.slug;
  const subtitle = profile.areas || `${profile.listingsCount ?? 0} annonce(s)`;

  return (
    <div>
      <div style={{ ...rowStyle, background: active ? 'var(--atlas-soft)' : 'transparent' }}>
        <button
          type="button"
          role="menuitem"
          onClick={onSelect}
          style={{ ...selectStyle, cursor: active ? 'default' : 'pointer' }}
        >
          <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </span>
            <span
              style={{
                fontSize: 11.5,
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
        {active ? <span style={{ fontSize: 11, color: 'var(--atlas-good)', fontWeight: 600 }}>Actif</span> : <span />}
        <MenuIconButton label={`Modifier ${title}`} onClick={onEdit}>
          <Icons.Settings size={13} stroke={1.7} />
        </MenuIconButton>
        <MenuIconButton tone="danger" label={`Supprimer ${title}`} onClick={onDeleteIntent}>
          <Icons.X size={13} stroke={1.8} />
        </MenuIconButton>
      </div>
      {confirmingDelete ? (
        <div style={{ padding: '7px 8px 8px', color: 'var(--atlas-bad)', fontSize: 12, display: 'grid', gap: 7 }}>
          Supprimer ce profil et ses données ?
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={onConfirmDelete} style={confirmButtonStyle}>
              Supprimer
            </button>
            <button type="button" onClick={onCancelDelete} style={cancelButtonStyle}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuIconButton({ label, tone, onClick, children }: { label: string; tone?: 'danger'; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        border: 0,
        borderRadius: 8,
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
