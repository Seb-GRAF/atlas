import {
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { deleteProfile, getProfileDetail, getScanAllStatus, listProfiles, runScanAll } from '../../api/profiles';
import { ProfileDetail, ScanAllJob } from '../../api/schemas';
import { ErrorAlert } from '../shared/ErrorAlert';
import { ProfileCard } from './ProfileCard';
import { ProfileForm } from './ProfileForm';
import { ScanAllProgress } from './ScanAllProgress';

const STORAGE_KEY = 'flat-scrapping-scan-job';

export function ProfilesHome() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProfileDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [scanJobId, setScanJobId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [scanJob, setScanJob] = useState<ScanAllJob | null>(null);

  const profilesQuery = useQuery({ queryKey: ['profiles'], queryFn: listProfiles });

  const editMutation = useMutation({
    mutationFn: getProfileDetail,
    onSuccess: (profile) => {
      setCreating(false);
      setEditing(profile);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur', message: (err as Error).message })
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: async () => {
      notifications.show({ color: 'alpine', title: 'Profil supprimé', message: 'La liste a été rechargée.' });
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur', message: (err as Error).message })
  });

  const scanAllMutation = useMutation({
    mutationFn: runScanAll,
    onSuccess: (job) => {
      const jobId = job.jobId;
      if (!jobId) throw new Error('Réponse API invalide: jobId manquant');
      localStorage.setItem(STORAGE_KEY, jobId);
      setScanJobId(jobId);
    },
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur scan', message: (err as Error).message })
  });

  useEffect(() => {
    if (!scanJobId) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const job = await getScanAllStatus(scanJobId);
        if (cancelled) return;
        setScanJob(job);
        if (job.status === 'done') {
          localStorage.removeItem(STORAGE_KEY);
          setScanJobId(null);
          await queryClient.invalidateQueries({ queryKey: ['profiles'] });
          return;
        }
      } catch (err) {
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY);
          setScanJobId(null);
          notifications.show({ color: 'swiss', title: 'Scan interrompu', message: (err as Error).message });
        }
      }
    };

    poll();
    const interval = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [queryClient, scanJobId]);

  const profiles = profilesQuery.data || [];
  const formVisible = creating || editing;
  const canScan = profiles.length > 0 && !scanJobId;
  const title = useMemo(() => (profiles.length === 1 ? 'Mon profil de recherche' : 'Mes profils de recherche'), [profiles.length]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <Stack gap={4}>
          <Text tt="uppercase" fz="xs" fw={800} c="lake.7" lts="0.08em" mb={4}>
            Profils
          </Text>
          <Title order={1}>{title}</Title>
          <Text c="dimmed" mt={6}>
            Chaque profil surveille des zones et des critères différents.
          </Text>
        </Stack>
        <Group>
          <Button leftSection={<IconRefresh size={16} />} loading={scanAllMutation.isPending || !!scanJobId} disabled={!canScan} onClick={() => scanAllMutation.mutate()}>
            Tout scanner
          </Button>
          <Button leftSection={<IconPlus size={16} />} variant="light" onClick={() => { setEditing(null); setCreating(true); }}>
            Créer un profil
          </Button>
        </Group>
      </Group>

      {profilesQuery.error ? <ErrorAlert error={profilesQuery.error} title="Impossible de charger les profils" /> : null}
      {scanJob ? <ScanAllProgress job={scanJob} profiles={profiles} /> : null}
      {formVisible ? <ProfileForm profile={editing} onCancel={() => { setCreating(false); setEditing(null); }} onDone={() => { setCreating(false); setEditing(null); }} /> : null}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.slug}
            profile={profile}
            onEdit={(slug) => editMutation.mutate(slug)}
            onDelete={(item) => {
              if (window.confirm(`Supprimer le profil « ${item.shortTitle || item.slug} » et toutes ses données ?\n\nCette action est irréversible.`)) {
                deleteMutation.mutate(item.slug);
              }
            }}
          />
        ))}
        <Card
          component="button"
          onClick={() => {
            setEditing(null);
            setCreating(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          style={{ minHeight: 180, borderStyle: 'dashed', cursor: 'pointer' }}
        >
          <Stack align="center" justify="center" h="100%" gap="xs">
            <IconPlus size={32} color="var(--mantine-color-lake-7)" />
            <Text fw={700}>Créer un profil</Text>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
