import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Area, ProfilePayload } from '../../api/schemas';
import { AtlasInput, AtlasToggle, Icons, RangeSlider } from '../components';
import { GeoAutocompleteField } from './GeoAutocompleteField';
import { parseGeoAddressResult, parseGeoAreaResult, type GeoAddress } from './geoAutocomplete';
import { PROFILE_SOURCE_OPTIONS, type ProfileSourceKey } from './profileEditorModel';
import { labelStyle, sliderValueStyle } from './profileEditorStyles';
import { mobileEyebrowStyle } from './mobile/mobileFormStyles';

type Layout = 'desktop' | 'mobile';

type ProfileFormProps = {
  draft: ProfilePayload;
  onChange: (next: ProfilePayload) => void;
  layout: Layout;
};

const PRICE_STEP = 50;
const PRICE_MAX = 3000;
const ROOMS_MIN = 1;
const ROOMS_MAX = 7;
const ROOMS_STEP = 0.5;

export function ProfileForm({ draft, onChange, layout }: ProfileFormProps) {
  const [zoneQuery, setZoneQuery] = useState('');

  const update = (mutator: (current: ProfilePayload) => ProfilePayload) => {
    onChange(mutator(draft));
  };

  const setSource = (key: ProfileSourceKey, next: boolean) => {
    update((current) => ({ ...current, sources: { ...current.sources, [key]: next } }));
  };

  const addZone = (area: Area) => {
    update((current) => {
      const exists = current.areas.some((item) => item.slug === area.slug || item.label === area.label);
      return exists ? current : { ...current, areas: [...current.areas, area] };
    });
    setZoneQuery('');
  };

  const removeZone = (slugOrLabel: string) => {
    update((current) => ({
      ...current,
      areas: current.areas.filter((item) => item.slug !== slugOrLabel && item.label !== slugOrLabel)
    }));
  };

  const selectWorkplace = (address: GeoAddress) => {
    update((current) => ({
      ...current,
      preferences: { ...current.preferences, workplaceAddress: address.label }
    }));
  };

  const priceMin = draft.filters.minTotalChf ?? 0;
  const priceMax = draft.filters.maxTotalChf ?? 1400;
  const roomsMin = draft.filters.minRoomsPreferred ?? 2;
  const roomsMax = draft.filters.maxRoomsPreferred ?? 5;

  const fieldLabelStyle = layout === 'mobile' ? mobileEyebrowStyle : labelStyle;

  const titleField = (
    <Field label="Titre" labelStyle={fieldLabelStyle}>
      <AtlasInput
        aria-label="Titre"
        value={draft.shortTitle}
        onChange={(event) => update((current) => ({ ...current, shortTitle: event.target.value }))}
      />
    </Field>
  );

  const zonesField = (
    <Field label="Zones" labelStyle={fieldLabelStyle}>
      {draft.areas.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {draft.areas.map((area) => (
            <span
              key={area.slug || area.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 4px 5px 10px',
                borderRadius: 999,
                background: 'var(--atlas-soft)',
                fontFamily: 'var(--atlas-sans)',
                fontSize: 12.5,
                color: 'var(--atlas-ink)'
              }}
            >
              {area.label}
              <button
                type="button"
                onClick={() => removeZone(area.slug || area.label)}
                aria-label={`Retirer ${area.label}`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: 'rgba(22,20,15,.06)',
                  display: 'grid',
                  placeItems: 'center',
                  border: 0,
                  color: 'var(--atlas-ink-2)',
                  cursor: 'pointer'
                }}
              >
                <Icons.Close size={10} stroke={2} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
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
  );

  const workplaceField = (
    <Field label="Lieu de travail" labelStyle={fieldLabelStyle}>
      <GeoAutocompleteField<GeoAddress>
        ariaLabel="Lieu de travail"
        value={draft.preferences.workplaceAddress ?? ''}
        placeholder="Adresse ou lieu"
        minChars={3}
        parseResult={parseGeoAddressResult}
        onValueChange={(value) =>
          update((current) => ({
            ...current,
            preferences: { ...current.preferences, workplaceAddress: value }
          }))
        }
        onSelect={selectWorkplace}
      />
    </Field>
  );

  const priceField = (
    <Field label="Loyer" labelStyle={fieldLabelStyle}>
      <div style={sliderValueStyle}>
        <span>CHF {priceMin}</span>
        <span>CHF {priceMax}</span>
      </div>
      <RangeSlider
        min={0}
        max={PRICE_MAX}
        step={PRICE_STEP}
        valueMin={priceMin}
        valueMax={priceMax}
        ariaLabelMin="Loyer minimum"
        ariaLabelMax="Loyer maximum"
        onChange={(next) =>
          update((current) => ({
            ...current,
            filters: { ...current.filters, minTotalChf: next.min, maxTotalChf: next.max }
          }))
        }
      />
    </Field>
  );

  const roomsField = (
    <Field label="Pièces" labelStyle={fieldLabelStyle}>
      <div style={sliderValueStyle}>
        <span>{roomsMin}</span>
        <span>{roomsMax}</span>
      </div>
      <RangeSlider
        min={ROOMS_MIN}
        max={ROOMS_MAX}
        step={ROOMS_STEP}
        valueMin={roomsMin}
        valueMax={roomsMax}
        ariaLabelMin="Pièces minimum"
        ariaLabelMax="Pièces maximum"
        onChange={(next) =>
          update((current) => ({
            ...current,
            filters: {
              ...current.filters,
              minRoomsPreferred: next.min,
              maxRoomsPreferred: next.max
            }
          }))
        }
      />
    </Field>
  );

  const limitsField = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Field label="Plafond dur" labelStyle={fieldLabelStyle}>
        <AtlasInput
          type="number"
          aria-label="Plafond dur"
          value={draft.filters.maxTotalHardChf ?? 1550}
          onChange={(event) =>
            update((current) => ({
              ...current,
              filters: { ...current.filters, maxTotalHardChf: Number(event.target.value) || 0 }
            }))
          }
        />
      </Field>
      <Field label="Surface min" labelStyle={fieldLabelStyle}>
        <AtlasInput
          type="number"
          aria-label="Surface minimum"
          value={draft.filters.minSurfaceM2Preferred ?? 0}
          onChange={(event) =>
            update((current) => ({
              ...current,
              filters: { ...current.filters, minSurfaceM2Preferred: Number(event.target.value) || 0 }
            }))
          }
        />
      </Field>
    </div>
  );

  const sourcesField = (
    <Field label="Sources" labelStyle={fieldLabelStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: layout === 'mobile' ? '1fr' : '1fr 1fr',
          gap: 8
        }}
      >
        {PROFILE_SOURCE_OPTIONS.map((source) => (
          <label
            key={source.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              padding: layout === 'mobile' ? '4px 0' : 0
            }}
          >
            {source.label}
            <AtlasToggle
              on={draft.sources[source.key] !== false}
              onChange={(next) => setSource(source.key, next)}
              ariaLabel={source.label}
            />
          </label>
        ))}
      </div>
    </Field>
  );

  if (layout === 'mobile') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {titleField}
        {zonesField}
        {workplaceField}
        {priceField}
        {roomsField}
        {limitsField}
        {sourcesField}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        {titleField}
        {zonesField}
        {workplaceField}
      </div>
      <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        {priceField}
        {roomsField}
        {limitsField}
        {sourcesField}
      </div>
    </div>
  );
}

function Field({
  label,
  labelStyle: providedLabelStyle,
  children
}: {
  label: string;
  labelStyle: CSSProperties;
  children: ReactNode;
}) {
  const isMobile = providedLabelStyle === mobileEyebrowStyle;
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={providedLabelStyle}>{label}</span>
        {children}
      </div>
    );
  }
  return (
    <div>
      <div style={providedLabelStyle}>{label}</div>
      {children}
    </div>
  );
}
