import {
  Button,
  Checkbox,
  Divider,
  Fieldset,
  Group,
  Paper,
  Stack,
  TextInput,
  Title,
  CloseButton,
  Pill,
  Text
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Area, ProfileDetail, ProfilePayload } from '../../api/schemas';
import { createProfile, updateProfile } from '../../api/profiles';
import { buildSlug } from '../../utils/format';
import { GeoAutocomplete } from './GeoAutocomplete';
import { PearlFields, RentFields, SourcesFields } from './ProfileFormSections';

const DEFAULT_KEYWORDS = ['rénové', 'balcon', 'terrasse', 'vue', 'quartier paisible', 'lac', 'centre'];

export type ProfileFormValues = ProfilePayload;

function defaults(profile?: ProfileDetail | null): ProfileFormValues {
  return {
    slug: profile?.slug || '',
    shortTitle: profile?.shortTitle || '',
    areas: profile?.areas || [],
    sources: {
      immobilier: profile?.sources?.immobilier !== false,
      flatfox: profile?.sources?.flatfox !== false,
      naef: profile?.sources?.naef !== false,
      bernardNicod: profile?.sources?.bernardNicod !== false,
      retraitesListings: profile?.sources?.retraitesListings !== false,
      retraitesProjets: profile?.sources?.retraitesProjets !== false,
      anibis: !!profile?.sources?.anibis
    },
    filters: {
      minTotalChf: profile?.filters?.minTotalChf ?? 0,
      maxTotalChf: profile?.filters?.maxTotalChf ?? 1400,
      maxTotalHardChf: profile?.filters?.maxTotalHardChf ?? 1550,
      maxPearlTotalChf: profile?.filters?.maxPearlTotalChf ?? 1650,
      minRoomsPreferred: profile?.filters?.minRoomsPreferred ?? 2,
      minSurfaceM2Preferred: profile?.filters?.minSurfaceM2Preferred ?? 0,
      maxPublishedAgeDays: profile?.filters?.maxPublishedAgeDays ?? 30,
      allowMissingSurface: profile?.filters?.allowMissingSurface !== false,
      pearl: {
        enabled: profile?.filters?.pearl?.enabled !== false,
        minRooms: profile?.filters?.pearl?.minRooms ?? 2,
        minSurfaceM2: profile?.filters?.pearl?.minSurfaceM2 ?? 50,
        keywords: profile?.filters?.pearl?.keywords || DEFAULT_KEYWORDS,
        minHits: profile?.filters?.pearl?.minHits ?? 1
      }
    },
    preferences: {
      workplaceAddress: profile?.preferences?.workplaceAddress || null
    }
  };
}

export function ProfileForm({
  profile,
  onCancel,
  onDone,
  presentation = 'page'
}: {
  profile?: ProfileDetail | null;
  onCancel: () => void;
  onDone: () => void;
  presentation?: 'page' | 'modal';
}) {
  const queryClient = useQueryClient();
  const isEdit = !!profile;
  const [zoneSearch, setZoneSearch] = useState('');
  const form = useForm<ProfileFormValues>({
    initialValues: defaults(profile),
    validate: {
      shortTitle: (value) => (!value.trim() ? 'Titre requis' : null),
      areas: (value) => (!value.length ? 'Ajoutez au moins une zone' : null)
    }
  });

  const mutation = useMutation({
    mutationFn: (payload: ProfilePayload) => (isEdit ? updateProfile(payload) : createProfile(payload)),
    onSuccess: async () => {
      notifications.show({ color: 'alpine', title: 'Profil enregistré', message: 'Les données ont été rechargées.' });
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });
      onDone();
    },
    onError: (err) => {
      notifications.show({ color: 'swiss', title: 'Erreur', message: (err as Error).message });
    }
  });

  const addZone = (area: Area) => {
      const current = form.getValues().areas;
    if (current.some((item) => item.slug === area.slug)) {
      setZoneSearch('');
      return;
    }
    form.setFieldValue('areas', [...current, area]);
    setZoneSearch('');
  };

  const submit = form.onSubmit((values) => {
    const slug = isEdit ? values.slug : buildSlug(values.shortTitle);
    mutation.mutate({ ...values, slug });
  });

  const values = form.values;
  const pearlEnabled = !!values.filters.pearl?.enabled;
  const content = (
    <form onSubmit={submit}>
      <Stack gap="md">
        {presentation === 'page' ? (
          <Group justify="space-between" align="center">
            <Title order={2}>{isEdit ? `Modifier - ${profile?.shortTitle || profile?.slug}` : 'Nouveau profil'}</Title>
            <CloseButton onClick={onCancel} aria-label="Fermer" />
          </Group>
        ) : null}

        <TextInput label="Titre court" placeholder="Ex: Vevey et environs" required {...form.getInputProps('shortTitle')} />

        <Fieldset legend="Zones de recherche">
          <Stack gap="sm">
            <Group gap={6}>
              {values.areas.length ? (
                values.areas.map((area) => (
                  <Pill
                    key={area.slug}
                    withRemoveButton
                    onRemove={() => form.setFieldValue('areas', values.areas.filter((item) => item.slug !== area.slug))}
                  >
                    {area.label}
                    {area.canton ? (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        {area.canton}
                      </Text>
                    ) : null}
                  </Pill>
                ))
              ) : (
                <Text size="sm" c={form.errors.areas ? 'swiss' : 'dimmed'}>
                  Aucune zone ajoutée - recherchez une commune ci-dessous
                </Text>
              )}
            </Group>
            <GeoAutocomplete
              label="Ajouter une commune"
              placeholder="Rechercher une commune..."
              origins="gg25"
              minChars={2}
              value={zoneSearch}
              onValueChange={setZoneSearch}
              onGeoSelect={addZone}
            />
          </Stack>
        </Fieldset>

        <RentFields form={form} />

        <Checkbox
          label="Inclure les annonces sans surface renseignée"
          {...form.getInputProps('filters.allowMissingSurface', { type: 'checkbox' })}
        />

        <GeoAutocomplete
          label="Adresse de travail (pour calcul distance)"
          placeholder="Rechercher une adresse..."
          minChars={3}
          value={values.preferences.workplaceAddress || ''}
          onValueChange={(value) => form.setFieldValue('preferences.workplaceAddress', value || null)}
          onGeoSelect={(item) => form.setFieldValue('preferences.workplaceAddress', item.label)}
        />

        <PearlFields form={form} enabled={pearlEnabled} />
        <SourcesFields form={form} />

        <Divider />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? 'Enregistrer' : 'Créer le profil'}
          </Button>
        </Group>
      </Stack>
    </form>
  );

  return presentation === 'modal' ? content : <Paper>{content}</Paper>;
}
