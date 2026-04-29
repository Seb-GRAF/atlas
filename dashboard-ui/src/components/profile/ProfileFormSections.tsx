import { Checkbox, Fieldset, NumberInput, SimpleGrid, Stack, Switch, TagsInput } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { ProfileFormValues } from './ProfileForm';

export function RentFields({ form }: { form: UseFormReturnType<ProfileFormValues> }) {
  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <NumberInput label="Loyer min (CHF)" min={0} step={50} {...form.getInputProps('filters.minTotalChf')} />
        <NumberInput label="Loyer max (CHF)" min={0} step={50} {...form.getInputProps('filters.maxTotalChf')} />
        <NumberInput label="Seuil dur (CHF)" min={0} step={50} {...form.getInputProps('filters.maxTotalHardChf')} />
        <NumberInput label="Seuil perle (CHF)" min={0} step={50} {...form.getInputProps('filters.maxPearlTotalChf')} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <NumberInput label="Pièces min" min={1} max={10} step={0.5} {...form.getInputProps('filters.minRoomsPreferred')} />
        <NumberInput label="Surface min (m²)" min={0} step={5} {...form.getInputProps('filters.minSurfaceM2Preferred')} />
        <NumberInput label="Ancienneté max (jours)" min={1} max={365} step={1} {...form.getInputProps('filters.maxPublishedAgeDays')} />
      </SimpleGrid>
    </>
  );
}

export function PearlFields({ form, enabled }: { form: UseFormReturnType<ProfileFormValues>; enabled: boolean }) {
  return (
    <Fieldset legend="Perles">
      <Stack gap="sm">
        <Switch label="Activer la détection de perles" {...form.getInputProps('filters.pearl.enabled', { type: 'checkbox' })} />
        {enabled ? (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput label="Min pièces (perle)" min={1} max={10} step={0.5} {...form.getInputProps('filters.pearl.minRooms')} />
              <NumberInput label="Min surface m² (perle)" min={0} step={5} {...form.getInputProps('filters.pearl.minSurfaceM2')} />
            </SimpleGrid>
            <TagsInput label="Mots-clés perle" {...form.getInputProps('filters.pearl.keywords')} />
            <NumberInput label="Hits minimum" min={1} max={5} step={1} {...form.getInputProps('filters.pearl.minHits')} />
          </>
        ) : null}
      </Stack>
    </Fieldset>
  );
}

export function SourcesFields({ form }: { form: UseFormReturnType<ProfileFormValues> }) {
  return (
    <Fieldset legend="Sources">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        <Checkbox label="immobilier.ch" {...form.getInputProps('sources.immobilier', { type: 'checkbox' })} />
        <Checkbox label="flatfox.ch" {...form.getInputProps('sources.flatfox', { type: 'checkbox' })} />
        <Checkbox label="naef.ch (direct régie)" {...form.getInputProps('sources.naef', { type: 'checkbox' })} />
        <Checkbox label="bernard-nicod.ch (direct régie)" {...form.getInputProps('sources.bernardNicod', { type: 'checkbox' })} />
        <Checkbox label="Retraites Populaires (locations directes)" {...form.getInputProps('sources.retraitesListings', { type: 'checkbox' })} />
        <Checkbox label="Retraites Populaires (projets neufs / off-market)" {...form.getInputProps('sources.retraitesProjets', { type: 'checkbox' })} />
        <Checkbox label="anibis.ch" {...form.getInputProps('sources.anibis', { type: 'checkbox' })} />
      </SimpleGrid>
    </Fieldset>
  );
}
