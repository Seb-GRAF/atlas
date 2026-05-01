import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GlassPill, AtlasButton, Icons } from '../components';
import type { AtlasStage, AtlasStageValue } from '../types';
import { ProfileChooserMenu } from './ProfileChooserMenu';

type TopBarProps = {
  profileSlug: string;
  profileTitle: string;
  zones: string[];
  query: string;
  onQueryChange: (value: string) => void;
  stages: AtlasStage[];
  stage: AtlasStageValue;
  onStageChange: (stage: AtlasStageValue) => void;
  onOpenSettings: () => void;
  onScan: () => void;
  scanning: boolean;
  onProfileSelect: (slug: string) => void;
};

const TOPBAR_STAGE_LABELS: Record<AtlasStageValue, string> = {
  triage: 'À trier',
  active: 'En cours',
  visits: 'Visité',
  files: 'Dossiers',
  done: 'Clos'
};

const containerStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  right: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  zIndex: 5
};

export function TopBar({
  profileSlug,
  profileTitle,
  query,
  onQueryChange,
  stages,
  stage,
  onStageChange,
  onOpenSettings,
  onScan,
  scanning,
  onProfileSelect
}: TopBarProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (profileMenuRef.current?.contains(event.target as Node)) return;
      setProfileMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileMenuOpen]);

  return (
    <div style={containerStyle}>
      <div ref={profileMenuRef} style={{ position: 'relative' }}>
        <GlassPill
          as="button"
          padding="6px 10px"
          aria-label="Choisir un profil"
          aria-expanded={profileMenuOpen}
          onClick={() => setProfileMenuOpen((open) => !open)}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'var(--atlas-ink)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--atlas-mono)',
              fontSize: 11,
              fontWeight: 600
            }}
          >
            A
          </span>
          <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--atlas-ink)' }}>Atlas</span>
          <span style={{ width: 1, height: 16, background: 'var(--atlas-line)' }} />
          <span style={{ fontSize: 13, color: 'var(--atlas-ink-2)' }}>{profileTitle}</span>
          <Icons.ChevronDown size={12} stroke={1.6} style={{ color: 'var(--atlas-ink-3)' }} />
        </GlassPill>

        {profileMenuOpen ? (
          <ProfileChooserMenu
            activeSlug={profileSlug}
            onSelect={(slug) => {
              setProfileMenuOpen(false);
              onProfileSelect(slug);
            }}
            onClose={() => setProfileMenuOpen(false)}
          />
        ) : null}
      </div>

      <GlassPill
        padding="6px 12px"
        style={{ flex: 1, maxWidth: 380, gap: 8 }}
      >
        <Icons.Search size={15} stroke={1.6} style={{ color: 'var(--atlas-ink-3)' }} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Vevey, Lutry, Pully…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: 'var(--atlas-ink)',
            fontFamily: 'var(--atlas-sans)',
            fontSize: 13
          }}
        />
        <span
          style={{
            fontFamily: 'var(--atlas-mono)',
            fontSize: 11,
            color: 'var(--atlas-ink-3)',
            padding: '1px 5px',
            border: '1px solid var(--atlas-line)',
            borderRadius: 4,
            lineHeight: 1
          }}
        >
          /
        </span>
      </GlassPill>

      <span style={{ flex: 1 }} />

      <GlassPill padding="4px" style={{ gap: 0 }}>
        {(['triage', 'active', 'visits', 'done'] as AtlasStageValue[])
          .map((value) => {
            const found = stages.find((s) => s.value === value);
            return found ? { ...found, label: TOPBAR_STAGE_LABELS[value] } : null;
          })
          .filter((s): s is AtlasStage => s !== null)
          .map((s) => {
            const active = s.value === stage;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onStageChange(s.value)}
                style={{
                  border: 0,
                  background: active ? 'var(--atlas-ink)' : 'transparent',
                  color: active ? '#fff' : 'var(--atlas-ink-2)',
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--atlas-sans)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background 140ms ease, color 140ms ease'
                }}
              >
                {s.label}
                <span
                  style={{
                    fontFamily: 'var(--atlas-mono)',
                    fontSize: 10.5,
                    opacity: 0.6
                  }}
                >
                  {s.count}
                </span>
              </button>
            );
          })}
      </GlassPill>

      <GlassPill as="button" padding="8px 10px" onClick={onOpenSettings} aria-label="Réglages">
        <Icons.Settings size={15} stroke={1.6} />
      </GlassPill>

      <AtlasButton
        variant="primary"
        onClick={onScan}
        disabled={scanning}
        leftSection={
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: scanning ? 'var(--atlas-ember)' : 'oklch(78% 0.12 150)',
              animation: scanning ? 'v2pulse 1.4s ease-in-out infinite' : undefined,
              display: 'inline-block'
            }}
          />
        }
      >
        {scanning ? 'Scan en cours…' : 'Scanner'}
      </AtlasButton>
    </div>
  );
}
