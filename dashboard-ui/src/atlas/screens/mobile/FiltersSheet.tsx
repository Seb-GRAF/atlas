import { useEffect, useState, type CSSProperties } from 'react';
import {
  AtlasButton,
  AtlasInput,
  AtlasToggle,
  Hairline,
  Mono,
  RangeSlider,
  SourceMono,
  formatCHF
} from '../../components';
import { MobileBottomSheet } from './MobileBottomSheet';
import type {
  AtlasListingSource,
  AtlasProfile,
  AtlasStage,
  AtlasStageValue
} from '../../types';

type FiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: AtlasProfile;
  stages: AtlasStage[];
  stage: AtlasStageValue;
  onStageChange: (stage: AtlasStageValue) => void;
  onSave: (next: AtlasProfile) => void;
  saving?: boolean;
};

const SOURCES: AtlasListingSource[] = [
  'immobilier.ch',
  'flatfox.ch',
  'naef.ch',
  'bernard-nicod',
  'Retraites Populaires',
  'anibis.ch'
];

const PRICE_STEP = 50;
const PRICE_FALLBACK_CEILING = 3000;
const ROOMS_MIN = 1;
const ROOMS_MAX = 6;
const ROOMS_STEP = 0.5;

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)',
  fontWeight: 500
};

const subEyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 10.5,
  color: 'var(--atlas-ink-3)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase'
};

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatRooms(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function FiltersSheet({
  open,
  onOpenChange,
  profile,
  stages,
  stage,
  onStageChange,
  onSave,
  saving
}: FiltersSheetProps) {
  const [draft, setDraft] = useState<AtlasProfile>(profile);

  // Refresh draft when reopening or when the underlying profile changes while closed.
  useEffect(() => {
    if (!open) setDraft(profile);
  }, [open, profile]);

  const isSourceOn = (source: AtlasListingSource) =>
    draft.enabledSources[source] !== false;

  const toggleSource = (source: AtlasListingSource, next: boolean) => {
    setDraft((d) => ({
      ...d,
      enabledSources: { ...d.enabledSources, [source]: next }
    }));
  };

  const priceCeiling = Math.max(
    PRICE_STEP,
    draft.budgetCeilingChf ?? draft.budgetMaxChf ?? PRICE_FALLBACK_CEILING
  );
  const priceMin = Math.max(0, Math.min(draft.budgetMinChf ?? 0, priceCeiling - PRICE_STEP));
  const priceMax = Math.max(
    priceMin + PRICE_STEP,
    Math.min(draft.budgetMaxChf ?? priceCeiling, priceCeiling)
  );

  const roomsMin = draft.roomsMin ?? ROOMS_MIN;
  const roomsMax = draft.roomsMax ?? ROOMS_MAX;
  const roomsCapped = roomsMax >= ROOMS_MAX;

  return (
    <MobileBottomSheet
      open={open}
      onClose={() => onOpenChange(false)}
      title="Filtres"
    >
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
        Filtres
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
          padding: '16px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22
        }}
      >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={eyebrowStyle}>Étape</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stages.map((s) => {
                  const active = s.value === stage;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => onStageChange(s.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: 'var(--atlas-sans)',
                        whiteSpace: 'nowrap',
                        background: active
                          ? 'rgba(22,20,15,.92)'
                          : 'var(--atlas-glass-pill-bg)',
                        backdropFilter: 'var(--atlas-glass-pill-blur)',
                        WebkitBackdropFilter: 'var(--atlas-glass-pill-blur)',
                        color: active ? '#fff' : 'var(--atlas-ink-2)',
                        boxShadow: 'var(--atlas-shadow-1)',
                        border: 0,
                        cursor: 'pointer'
                      }}
                    >
                      {s.label} ·{' '}
                      <span style={{ fontFamily: 'var(--atlas-mono)' }}>{s.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={eyebrowStyle}>Budget</span>
              <RangeSlider
                min={0}
                max={priceCeiling}
                step={PRICE_STEP}
                valueMin={priceMin}
                valueMax={priceMax}
                ariaLabelMin="Loyer min"
                ariaLabelMax="Loyer max"
                onChange={({ min, max }) =>
                  setDraft((d) => ({ ...d, budgetMinChf: min, budgetMaxChf: max }))
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={subEyebrowStyle}>Min</div>
                  <AtlasInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={priceMax - PRICE_STEP}
                    step={PRICE_STEP}
                    value={priceMin}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      if (!Number.isFinite(raw)) return;
                      const next = Math.max(0, Math.min(roundToStep(raw, PRICE_STEP), priceMax - PRICE_STEP));
                      setDraft((d) => ({ ...d, budgetMinChf: next }));
                    }}
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div>
                  <div style={subEyebrowStyle}>Max</div>
                  <AtlasInput
                    type="number"
                    inputMode="numeric"
                    min={priceMin + PRICE_STEP}
                    max={priceCeiling}
                    step={PRICE_STEP}
                    value={priceMax}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      if (!Number.isFinite(raw)) return;
                      const next = Math.max(
                        priceMin + PRICE_STEP,
                        Math.min(roundToStep(raw, PRICE_STEP), priceCeiling)
                      );
                      setDraft((d) => ({ ...d, budgetMaxChf: next }));
                    }}
                    style={{ marginTop: 4 }}
                  />
                </div>
              </div>
              {draft.budgetCeilingChf != null ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 10,
                    boxShadow: 'inset 0 0 0 1px var(--atlas-line)'
                  }}
                >
                  <span style={subEyebrowStyle}>Plafond</span>
                  <Mono style={{ fontSize: 14, fontWeight: 500, color: 'var(--atlas-ink-2)' }}>
                    {formatCHF(draft.budgetCeilingChf)}
                    <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)', marginLeft: 4 }}>CHF</span>
                  </Mono>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={eyebrowStyle}>Pièces</span>
              <RangeSlider
                min={ROOMS_MIN}
                max={ROOMS_MAX}
                step={ROOMS_STEP}
                valueMin={roomsMin}
                valueMax={roomsMax}
                ariaLabelMin="Pièces min"
                ariaLabelMax="Pièces max"
                onChange={({ min, max }) =>
                  setDraft((d) => ({
                    ...d,
                    roomsMin: min,
                    roomsMax: max >= ROOMS_MAX ? null : max
                  }))
                }
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--atlas-sans)',
                  fontSize: 12.5,
                  color: 'var(--atlas-ink-2)'
                }}
              >
                <span>
                  {roomsCapped ? `≥ ${formatRooms(roomsMin)}` : `${formatRooms(roomsMin)} – ${formatRooms(roomsMax)}`}
                  <span style={{ color: 'var(--atlas-ink-3)', marginLeft: 4 }}>pièces</span>
                </span>
                <span style={{ fontFamily: 'var(--atlas-mono)', color: 'var(--atlas-ink-3)' }}>
                  {ROOMS_MIN.toFixed(1)}–{ROOMS_MAX.toFixed(1)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={eyebrowStyle}>Sources</span>
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
            </div>
          </div>

      <Hairline />
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8
        }}
      >
        <AtlasButton
          variant="ghost"
          onClick={() => onOpenChange(false)}
          style={{ background: 'transparent', color: 'var(--atlas-ink-2)' }}
        >
          Annuler
        </AtlasButton>
        <AtlasButton
          variant="primary"
          onClick={() => onSave(draft)}
          disabled={saving}
          style={saving ? { opacity: 0.6, cursor: 'wait' } : undefined}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </AtlasButton>
      </div>
    </MobileBottomSheet>
  );
}
