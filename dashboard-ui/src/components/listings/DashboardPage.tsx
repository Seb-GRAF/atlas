import {
  Alert,
  Button,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRefresh, IconSearch, IconSettings, IconSparkles } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getDashboardState, runProfileScan } from '../../api/listings';
import { getProfileDetail } from '../../api/profiles';
import { Listing } from '../../api/schemas';
import { filterAndSortListings } from '../../utils/listings';
import { shortWhen } from '../../utils/format';
import { ProfileForm } from '../profile/ProfileForm';
import { ErrorAlert } from '../shared/ErrorAlert';
import { PageEyebrow } from '../shared/PageEyebrow';
import { KanbanBoard } from './KanbanBoard';
import { Lightbox, LightboxState } from './Lightbox';
import { ListingCards } from './ListingCards';
import { ListingTable } from './ListingTable';

const VIEW_KEY = 'apartment-dashboard:view';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'table' | 'kanban'>(() =>
    localStorage.getItem(VIEW_KEY) === 'kanban' ? 'kanban' : 'table'
  );
  const [scanOutput, setScanOutput] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const stateQuery = useQuery({
    queryKey: ['state'],
    queryFn: () => getDashboardState()
  });

  const profileQuery = useQuery({
    queryKey: ['profile-detail'],
    queryFn: () => getProfileDetail(),
    enabled: settingsOpen
  });

  const scanMutation = useMutation({
    mutationFn: () => runProfileScan(),
    onMutate: () => setScanOutput('Scan en cours...'),
    onSuccess: async (summary) => {
      setScanOutput(summary || 'Scan terminé.');
      await queryClient.invalidateQueries({ queryKey: ['state'] });
    },
    onError: (err) => {
      setScanOutput(`Erreur: ${(err as Error).message}`);
      notifications.show({ color: 'swiss', title: 'Erreur scan', message: (err as Error).message });
    }
  });

  const state = stateQuery.data;
  const rawListings = (state?.tracker.listings || []).filter((item) => item.display !== false);
  const listings = useMemo(() => filterAndSortListings(rawListings as Listing[], query), [rawListings, query]);
  const statuses = state?.tracker.statuses || [];
  const activeCount = rawListings.filter((item) => !item.isRemoved).length;
  const removedCount = rawListings.filter((item) => item.isRemoved).length;
  const activeProfile = state?.profile || profileQuery.data?.slug || '';
  const profileTitle = state?.profile ? `Suivi ${state.profile}` : 'Suivi appartement';
  const closeSettings = () => setSettingsOpen(false);
  const finishSettings = () => {
    setSettingsOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['state'] });
    void queryClient.invalidateQueries({ queryKey: ['profile-detail'] });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <Stack gap={4}>
          <PageEyebrow>Dashboard</PageEyebrow>
          <Title order={1}>{profileTitle}</Title>
          <Text c="dimmed" mt={6}>
            {state?.areas ? `Zones: ${state.areas}` : 'Zones: chargement...'}
          </Text>
          <Text c="dimmed" size="sm" mt={2}>
            Profil: {state?.profile || 'chargement'} · Dernier scan: {shortWhen(state?.latest.generatedAt)} · {activeCount} actives · {removedCount} retirées
          </Text>
        </Stack>
        <Group>
          <Button
            variant={settingsOpen ? 'filled' : 'light'}
            leftSection={<IconSettings size={16} />}
            onClick={() => setSettingsOpen((open) => !open)}
            loading={profileQuery.isFetching && settingsOpen}
          >
            Réglages
          </Button>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => stateQuery.refetch()}
            loading={stateQuery.isFetching && !scanMutation.isPending}
          >
            Rafraîchir
          </Button>
          <Button
            leftSection={<IconSparkles size={16} />}
            onClick={() => scanMutation.mutate()}
            loading={scanMutation.isPending}
          >
            Scanner
          </Button>
        </Group>
      </Group>

      {stateQuery.error ? <ErrorAlert error={stateQuery.error} title="Impossible de charger le dashboard" /> : null}
      {scanOutput ? (
        <Alert color={scanOutput.startsWith('Erreur') ? 'swiss' : 'lake'} title="Résultat du scan">
          <Text component="pre" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
            {scanOutput}
          </Text>
        </Alert>
      ) : null}
      <Modal
        opened={settingsOpen}
        onClose={closeSettings}
        title="Réglages du profil"
        size="xl"
        centered
        overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
      >
        {profileQuery.error ? (
          <ErrorAlert error={profileQuery.error} title="Impossible de charger les réglages" />
        ) : profileQuery.data ? (
          <ProfileForm profile={profileQuery.data} onCancel={closeSettings} onDone={finishSettings} presentation="modal" />
        ) : (
          <Text c="dimmed">Chargement des réglages...</Text>
        )}
      </Modal>

      <Paper p="sm">
        <Group align="flex-end" justify="space-between">
          <TextInput
            label="Recherche"
            placeholder="adresse, type, zone..."
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            w={{ base: '100%', sm: 420 }}
          />
          <SegmentedControl
            value={view}
            onChange={(value) => {
              const next = value === 'kanban' ? 'kanban' : 'table';
              setView(next);
              localStorage.setItem(VIEW_KEY, next);
            }}
            data={[
              { value: 'table', label: 'Vue tableau' },
              { value: 'kanban', label: 'Vue kanban' }
            ]}
          />
        </Group>
      </Paper>

      {stateQuery.isLoading ? (
        <Paper>
          <Text c="dimmed">Chargement des annonces...</Text>
        </Paper>
      ) : view === 'kanban' ? (
          <KanbanBoard
          profile={activeProfile}
          listings={listings}
          statuses={statuses}
          onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
        />
      ) : (
        <>
          <ListingTable
            profile={activeProfile}
            listings={listings}
            statuses={statuses}
            onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
          />
          <ListingCards
            profile={activeProfile}
            listings={listings}
            statuses={statuses}
            onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
          />
        </>
      )}

      <Lightbox state={lightbox} onClose={() => setLightbox(null)} />
    </Stack>
  );
}
