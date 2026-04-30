import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  AtlasButton,
  AtlasIconButton,
  AtlasInput,
  AtlasToggle,
  GlassPanel,
  Hairline,
  Icons,
  Mono,
  SourceMono,
  formatCHF
} from '../components';
import type { AtlasListingSource, AtlasProfile } from '../types';

type SettingsDrawerProps = {
  profile: AtlasProfile;
  onClose: () => void;
  onSave: (next: AtlasProfile) => void;
};

const SOURCES: AtlasListingSource[] = [
  'immobilier.ch',
  'flatfox.ch',
  'naef.ch',
  'bernard-nicod',
  'Retraites Populaires',
  'anibis.ch'
];

const drawerStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  bottom: 16,
  width: 480,
  zIndex: 6,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: 'atlas-drawer-in 220ms cubic-bezier(.2,.8,.2,1)'
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)',
  marginBottom: 6
};

const titleStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 18,
  fontWeight: 500,
  letterSpacing: '-0.018em',
  color: 'var(--atlas-ink)',
  margin: 0
};

const headerEyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 4px 5px 10px',
  borderRadius: 999,
  background: 'var(--atlas-soft)',
  fontFamily: 'var(--atlas-sans)',
  fontSize: 12.5,
  color: 'var(--atlas-ink)'
};

const chipRemoveStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  background: 'rgba(22,20,15,.06)',
  display: 'grid',
  placeItems: 'center',
  border: 0,
  color: 'var(--atlas-ink-2)',
  cursor: 'pointer'
};

const addChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  borderRadius: 999,
  background: 'transparent',
  boxShadow: 'inset 0 0 0 1px var(--atlas-line)',
  fontFamily: 'var(--atlas-sans)',
  fontSize: 12.5,
  color: 'var(--atlas-ink-2)',
  border: 0,
  cursor: 'pointer'
};

const budgetCardStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--atlas-paper)',
  boxShadow: 'inset 0 0 0 1px var(--atlas-line)'
};

const budgetEyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 10.5,
  color: 'var(--atlas-ink-3)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={eyebrowStyle}>{label}</div>
      {children}
    </div>
  );
}

export function SettingsDrawer({ profile, onClose, onSave }: SettingsDrawerProps) {
  const [draft, setDraft] = useState<AtlasProfile>(profile);

  const removeZone = (zone: string) => {
    setDraft((d) => ({ ...d, zones: d.zones.filter((z) => z !== zone) }));
  };

  const toggleSource = (source: AtlasListingSource, next: boolean) => {
    setDraft((d) => ({
      ...d,
      enabledSources: { ...d.enabledSources, [source]: next }
    }));
  };

  const isSourceOn = (source: AtlasListingSource): boolean => {
    const entry = draft.enabledSources[source];
    return entry !== false; // default-on if undefined
  };

  return (
    <GlassPanel variant="panel" style={drawerStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px'
        }}
      >
        <div>
          <div style={headerEyebrowStyle}>Profil</div>
          <h3 style={{ ...titleStyle, marginTop: 4 }}>{draft.shortTitle}</h3>
        </div>
        <AtlasIconButton onClick={onClose} aria-label="Fermer">
          <Icons.Close size={15} stroke={1.7} />
        </AtlasIconButton>
      </div>
      <Hairline />

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22
        }}
      >
        <Field label="Titre">
          <AtlasInput
            value={draft.shortTitle}
            onChange={(event) => setDraft((d) => ({ ...d, shortTitle: event.target.value }))}
          />
        </Field>

        <Field label="Lieu de travail">
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--atlas-paper)',
              boxShadow: 'inset 0 0 0 1px var(--atlas-line)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--atlas-sans)',
              fontSize: 13.5,
              color: 'var(--atlas-ink)'
            }}
          >
            <Icons.Compass size={14} stroke={1.7} style={{ color: 'var(--atlas-ink-3)' }} />
            <span>{draft.workplace ?? '—'}</span>
          </div>
        </Field>

        <Field label="Zones surveillées">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {draft.zones.map((zone) => (
              <span key={zone} style={chipStyle}>
                {zone}
                <button
                  type="button"
                  onClick={() => removeZone(zone)}
                  style={chipRemoveStyle}
                  aria-label={`Retirer ${zone}`}
                >
                  <Icons.Close size={10} stroke={2} />
                </button>
              </span>
            ))}
            <button type="button" style={addChipStyle}>
              <Icons.Plus size={12} stroke={1.8} />
              Ajouter
            </button>
          </div>
        </Field>

        <Field label="Budget">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={budgetCardStyle}>
              <div style={budgetEyebrowStyle}>Loyer max</div>
              <div style={{ marginTop: 2 }}>
                <Mono style={{ fontSize: 16, fontWeight: 500, color: 'var(--atlas-ink)' }}>
                  {draft.budgetMaxChf != null ? formatCHF(draft.budgetMaxChf) : '—'}
                  <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)', marginLeft: 4 }}>CHF</span>
                </Mono>
              </div>
            </div>
            <div style={budgetCardStyle}>
              <div style={budgetEyebrowStyle}>Plafond</div>
              <div style={{ marginTop: 2 }}>
                <Mono style={{ fontSize: 16, fontWeight: 500, color: 'var(--atlas-ink)' }}>
                  {draft.budgetCeilingChf != null ? formatCHF(draft.budgetCeilingChf) : '—'}
                  <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)', marginLeft: 4 }}>CHF</span>
                </Mono>
              </div>
            </div>
          </div>
        </Field>

        <Field label="Sources">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SOURCES.map((source) => (
              <div
                key={source}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 4px'
                }}
              >
                <SourceMono source={source} dim size={22} />
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'var(--atlas-sans)',
                    fontSize: 13,
                    color: 'var(--atlas-ink)'
                  }}
                >
                  {source}
                </span>
                <AtlasToggle
                  on={isSourceOn(source)}
                  onChange={(next) => toggleSource(source, next)}
                  ariaLabel={source}
                />
              </div>
            ))}
          </div>
        </Field>
      </div>

      <Hairline />
      {/* Footer */}
      <div
        style={{
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8
        }}
      >
        <AtlasButton variant="ghost" onClick={onClose} style={{ background: 'transparent', color: 'var(--atlas-ink-2)' }}>
          Annuler
        </AtlasButton>
        <AtlasButton variant="primary" onClick={() => onSave(draft)}>
          Enregistrer
        </AtlasButton>
      </div>
    </GlassPanel>
  );
}

type SettingsScrimProps = {
  onClick: () => void;
};

const scrimStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(22,20,15,.32)',
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
  zIndex: 3,
  border: 0,
  cursor: 'pointer',
  padding: 0
};

export function SettingsScrim({ onClick }: SettingsScrimProps) {
  return <button type="button" aria-label="Fermer" onClick={onClick} style={scrimStyle} />;
}
