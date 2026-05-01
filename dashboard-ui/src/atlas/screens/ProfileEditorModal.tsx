import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Area, ProfilePayload } from '../../api/schemas';
import { AtlasButton, AtlasIconButton, AtlasInput, AtlasToggle, Hairline, Icons, RangeSlider } from '../components';
import { GeoAutocompleteField } from './GeoAutocompleteField';
import { parseGeoAddressResult, parseGeoAreaResult, type GeoAddress } from './geoAutocomplete';
import { PROFILE_SOURCE_OPTIONS, prepareProfilePayload, type ProfileSourceKey } from './profileEditorModel';
import { dialogStyle, labelStyle, scrimStyle, shellStyle, sliderValueStyle } from './profileEditorStyles';

type ProfileEditorModalProps = {
  mode: 'create' | 'edit';
  draft: ProfilePayload;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: ProfilePayload) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><div style={labelStyle}>{label}</div>{children}</div>;
}

export function ProfileEditorModal({ mode, draft: initialDraft, saving, error, onClose, onSave }: ProfileEditorModalProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [zoneQuery, setZoneQuery] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
    setLocalError(null);
  }, [initialDraft]);

  const setSource = (key: ProfileSourceKey, next: boolean) => {
    setDraft((current) => ({ ...current, sources: { ...current.sources, [key]: next } }));
  };

  const addZone = (area: Area) => {
    setDraft((current) => {
      const exists = current.areas.some((item) => item.slug === area.slug || item.label === area.label);
      return exists ? current : { ...current, areas: [...current.areas, area] };
    });
    setZoneQuery('');
  };

  const selectWorkplace = (address: GeoAddress) => {
    setDraft((current) => ({
      ...current,
      preferences: { ...current.preferences, workplaceAddress: address.label }
    }));
  };

  const title = mode === 'create' ? 'Nouveau profil' : 'Modifier le profil';
  const priceMin = draft.filters.minTotalChf ?? 0;
  const priceMax = draft.filters.maxTotalChf ?? 1400;
  const roomsMin = draft.filters.minRoomsPreferred ?? 2;
  const roomsMax = draft.filters.maxRoomsPreferred ?? 5;
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
        <div style={{ overflowY: 'auto', padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <Field label="Titre">
              <AtlasInput
                aria-label="Titre"
                value={draft.shortTitle}
                onChange={(event) => setDraft((current) => ({ ...current, shortTitle: event.target.value }))}
              />
            </Field>
            <Field label="Zones">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {draft.areas.map((area) => (
                  <span key={area.slug || area.label} style={{ borderRadius: 999, padding: '5px 9px', background: 'var(--atlas-soft)', fontSize: 12 }}>
                    {area.label}
                  </span>
                ))}
              </div>
              <GeoAutocompleteField<Area>
                ariaLabel="Ajouter une zone"
                value={zoneQuery}
                placeholder="Ajouter une commune"
                origins="gg25"
                parseResult={parseGeoAreaResult}
                onValueChange={setZoneQuery}
                onSelect={addZone}
              />
            </Field>
            <Field label="Lieu de travail">
              <GeoAutocompleteField<GeoAddress>
                ariaLabel="Lieu de travail"
                value={draft.preferences.workplaceAddress ?? ''}
                placeholder="Adresse ou lieu"
                minChars={3}
                parseResult={parseGeoAddressResult}
                onValueChange={(value) => setDraft((current) => ({ ...current, preferences: { ...current.preferences, workplaceAddress: value } }))}
                onSelect={selectWorkplace}
              />
            </Field>
          </div>
          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <Field label="Loyer">
              <div style={sliderValueStyle}><span>CHF {priceMin}</span><span>CHF {priceMax}</span></div>
              <RangeSlider
                min={0}
                max={3000}
                step={50}
                valueMin={priceMin}
                valueMax={priceMax}
                ariaLabelMin="Loyer minimum"
                ariaLabelMax="Loyer maximum"
                onChange={(next) => setDraft((current) => ({ ...current, filters: { ...current.filters, minTotalChf: next.min, maxTotalChf: next.max } }))}
              />
            </Field>
            <Field label="Pièces">
              <div style={sliderValueStyle}><span>{roomsMin}</span><span>{roomsMax}</span></div>
              <RangeSlider
                min={1}
                max={7}
                step={0.5}
                valueMin={roomsMin}
                valueMax={roomsMax}
                ariaLabelMin="Pièces minimum"
                ariaLabelMax="Pièces maximum"
                onChange={(next) => setDraft((current) => ({ ...current, filters: { ...current.filters, minRoomsPreferred: next.min, maxRoomsPreferred: next.max } }))}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Plafond dur">
                <AtlasInput
                  type="number"
                  aria-label="Plafond dur"
                  value={draft.filters.maxTotalHardChf ?? 1550}
                  onChange={(event) => setDraft((current) => ({ ...current, filters: { ...current.filters, maxTotalHardChf: Number(event.target.value) || 0 } }))}
                />
              </Field>
              <Field label="Surface min">
                <AtlasInput
                  type="number"
                  aria-label="Surface minimum"
                  value={draft.filters.minSurfaceM2Preferred ?? 0}
                  onChange={(event) => setDraft((current) => ({ ...current, filters: { ...current.filters, minSurfaceM2Preferred: Number(event.target.value) || 0 } }))}
                />
              </Field>
            </div>
            <Field label="Sources">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PROFILE_SOURCE_OPTIONS.map((source) => (
                  <label key={source.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    {source.label}
                    <AtlasToggle on={draft.sources[source.key] !== false} onChange={(next) => setSource(source.key, next)} ariaLabel={source.label} />
                  </label>
                ))}
              </div>
            </Field>
          </div>
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
