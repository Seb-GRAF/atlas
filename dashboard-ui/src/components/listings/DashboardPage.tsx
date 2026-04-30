import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  Flex,
  Grid,
  Group,
  Kbd,
  Modal,
  Paper,
  Select,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  Title,
  UnstyledButton
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBrandFacebook,
  IconCards,
  IconExternalLink,
  IconInfoCircle,
  IconMap,
  IconPinned,
  IconPinnedOff,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconTrash,
  IconX
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelProfileScan,
  deleteListing,
  getDashboardState,
  getProfileScanStatus,
  startProfileScan,
  toggleListingPin,
  updateListingStatus
} from '../../api/listings';
import { getProfileDetail } from '../../api/profiles';
import { Listing, ScanJob } from '../../api/schemas';
import { fullWhen, money, shortWhen } from '../../utils/format';
import {
  DEFAULT_STATUSES,
  DONE_STATUSES,
  STAGES,
  StageTab,
  filterListingsForStage,
  getImageUrls,
  isNewToday,
  listingSourceLabel,
  listingTitle,
  normalizeListingStatus,
  publishedLabel,
  stageCounts
} from '../../utils/listings';
import { formatNewApartmentsFound, formatScanProgressDetail, scanNotificationColor } from '../../utils/scanFeedback';
import { ProfileForm } from '../profile/ProfileForm';
import { ErrorAlert } from '../shared/ErrorAlert';
import { ScanOverlay } from '../shared/ScanOverlay';
import { StatusBadge } from '../status/StatusBadge';
import { ApartmentMap } from './ApartmentMap';
import { ListingImageGallery, ListingMasonryGallery } from './ListingImageGallery';
import { Lightbox, LightboxState } from './Lightbox';
import { SwipeStack } from './SwipeStack';

const SELECTED_DETAIL_ID = 'selected-listing-detail';
const PROFILE_SCAN_STORAGE_KEY = 'flat-scrapping-profile-scan-job';
const MARKETPLACE_LOCATION_ID = '108211865877609';
const MARKETPLACE_DEFAULT_MIN_PRICE = 1500;
const MARKETPLACE_DEFAULT_MAX_PRICE = 2300;

function isDesktopViewport() {
  return typeof window !== 'undefined' && window.matchMedia?.('(min-width: 961px)').matches;
}

function marketplaceSearchUrl({
  filters,
  isDesktop
}: {
  filters?: { minTotalChf?: number | null; maxTotalChf?: number | null; maxTotalHardChf?: number | null };
  isDesktop: boolean;
}) {
  const minPrice = Number(filters?.minTotalChf) || MARKETPLACE_DEFAULT_MIN_PRICE;
  const maxPrice = Number(filters?.maxTotalHardChf ?? filters?.maxTotalChf) || MARKETPLACE_DEFAULT_MAX_PRICE;
  const url = new URL(
    isDesktop
      ? `https://www.facebook.com/marketplace/${MARKETPLACE_LOCATION_ID}/search/`
      : 'https://m.facebook.com/marketplace/search/'
  );
  url.searchParams.set('minPrice', String(minPrice));
  url.searchParams.set('maxPrice', String(maxPrice));
  url.searchParams.set('daysSinceListed', '2');
  url.searchParams.set('query', 'louer appartement');
  url.searchParams.set('exact', 'false');
  url.searchParams.set('sortBy', 'creation_time_descend');
  return url.toString();
}

function statusOptions(statuses: string[]) {
  return [...new Set([...(statuses.length ? statuses : DEFAULT_STATUSES), ...DEFAULT_STATUSES].map(normalizeListingStatus))].map((status) => ({
    value: status,
    label: status
  }));
}

function commuteLabel(item: Listing) {
  return item.transitText || item.driveText || item.distanceText || '';
}

function surfaceLabel(item: Listing) {
  const bits = [];
  if (item.rooms != null) bits.push(`${item.rooms} pces`);
  if (item.surfaceM2 != null) bits.push(`${item.surfaceM2} m2`);
  return bits.join(' · ');
}

function ListingThumb({
  item,
  onOpenLightbox,
  size = 64
}: {
  item: Listing;
  onOpenLightbox: (urls: string[], index: number) => void;
  size?: number;
}) {
  return (
    <ListingImageGallery
      item={item}
      onOpen={onOpenLightbox}
      variant="row"
      size={size}
      stopPropagation
    />
  );
}

function ListingRow({
  item,
  selected,
  onSelect,
  onOpenLightbox
}: {
  item: Listing;
  selected: boolean;
  onSelect: () => void;
  onOpenLightbox: (urls: string[], index: number) => void;
}) {
  const location = item.area || item.address || listingSourceLabel(item) || 'Lieu non renseigné';
  const meta = [surfaceLabel(item), commuteLabel(item), listingSourceLabel(item)].filter(Boolean);
  const isNew = isNewToday(item);

  return (
    <Box
      className="listing-row-motion"
      data-selected={selected || undefined}
      w="100%"
    >
      <Flex className="listing-row-content" gap={0} align="stretch" wrap="nowrap">
        <Box className="listing-row-thumb">
          <ListingThumb item={item} onOpenLightbox={onOpenLightbox} />
        </Box>
        <UnstyledButton
          type="button"
          className="listing-row-select"
          aria-pressed={selected}
          aria-controls={selected ? SELECTED_DETAIL_ID : undefined}
          aria-label={`${listingTitle(item)}, ${money(item.totalChf)}, ${location}`}
          onClick={onSelect}
        >
          <Flex gap="md" align="center" wrap="nowrap" w="100%">
            <Stack gap={4} miw={0} flex={1}>
              <Group gap={6} wrap="nowrap">
                {item.pinned ? <IconPinned size={14} aria-label="Épinglée" /> : null}
                <Text fw={700} size="sm" lineClamp={1}>
                  {listingTitle(item)}
                </Text>
                {isNew ? (
                  <Badge color="alpine" variant="filled" size="xs">
                    Nouveau
                  </Badge>
                ) : null}
              </Group>
              <Group gap="xs">
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {location}
                </Text>
                {meta.map((value) => (
                  <Badge key={value} color="slate" variant="subtle" size="xs">
                    {value}
                  </Badge>
                ))}
              </Group>
              <Text size="xs" c="dimmed" hiddenFrom="xs">
                Publié {publishedLabel(item)}
              </Text>
            </Stack>
            <Stack gap={4} align="flex-end" visibleFrom="xs">
              <Text fw={800} size="sm" ff="var(--mantine-font-family-monospace)">
                {money(item.totalChf)}
              </Text>
              <Text size="xs" c="dimmed">
                Publié {publishedLabel(item)}
              </Text>
            </Stack>
          </Flex>
        </UnstyledButton>
        <Box className="listing-row-action">
          {item.url ? (
            <Tooltip label="Ouvrir l’annonce">
              <ActionIcon
                component="a"
                href={item.url}
                target="_blank"
                rel="noreferrer"
                variant="subtle"
                color="slate"
                aria-label={`Ouvrir l’annonce ${listingTitle(item)}`}
              >
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Lien indisponible">
              <ActionIcon variant="subtle" color="slate" disabled aria-label="Lien indisponible">
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

function SelectedListingPanel({
  profile,
  item,
  statuses,
  onOpenLightbox,
  onClose
}: {
  profile: string;
  item: Listing | null;
  statuses: string[];
  onOpenLightbox: (urls: string[], index: number) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  useEffect(() => setNotes(item?.notes || ''), [item?.id, item?.notes]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['state'] });
  const statusMutation = useMutation({
    mutationFn: ({ status, nextNotes = item?.notes || '', reopen = false }: { status: string; nextNotes?: string; reopen?: boolean }) => {
      if (!item) throw new Error('Annonce manquante');
      return updateListingStatus(profile, item.id, status, nextNotes, { reopen });
    },
    onSuccess: invalidate,
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur statut', message: (err as Error).message })
  });
  const pinMutation = useMutation({
    mutationFn: () => {
      if (!item) throw new Error('Annonce manquante');
      return toggleListingPin(profile, item.id);
    },
    onSuccess: invalidate,
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur épingle', message: (err as Error).message })
  });
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!item) throw new Error('Annonce manquante');
      return deleteListing(profile, item.id);
    },
    onSuccess: invalidate,
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur suppression', message: (err as Error).message })
  });

  if (!item) {
    return (
      <Box className="selected-listing-panel is-empty">
        <Text c="dimmed">Sélectionnez une annonce.</Text>
      </Box>
    );
  }

  const currentStatus = normalizeListingStatus(item.status);
  const urls = getImageUrls(item);
  const canReopen = item.isRemoved || DONE_STATUSES.has(currentStatus);

  return (
    <Box id={SELECTED_DETAIL_ID} component="aside" className="selected-listing-panel" aria-labelledby="selected-listing-title" aria-live="polite">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
          <Stack gap={6}>
            <Group gap={6}>
              <IconInfoCircle size={16} aria-hidden />
              <Text id="selected-listing-title" fw={800}>
                Annonce sélectionnée
              </Text>
            </Group>
            <Text fw={700}>{listingTitle(item)}</Text>
            <Text size="sm" c="dimmed">
              {[item.address || item.area, surfaceLabel(item), commuteLabel(item)].filter(Boolean).join(' · ')}
            </Text>
            <Group gap={6}>
              <StatusBadge status={item.isRemoved ? 'Retirée' : currentStatus} />
            </Group>
          </Stack>
          <Group gap="xs" wrap="nowrap">
            <Text fw={800} ff="var(--mantine-font-family-monospace)">
              {money(item.totalChf)}
            </Text>
            <Tooltip label="Fermer">
              <ActionIcon variant="subtle" color="slate" onClick={onClose} aria-label="Fermer le détail de l’annonce">
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Group gap="xs">
          {item.url ? (
            <Button
              component="a"
              href={item.url}
              target="_blank"
              rel="noreferrer"
              leftSection={<IconExternalLink size={16} />}
              disabled={item.isRemoved}
            >
              Ouvrir l’annonce
            </Button>
          ) : (
            <Button leftSection={<IconExternalLink size={16} />} disabled>
              Lien indisponible
            </Button>
          )}
          {urls.length ? (
            <Button variant="light" onClick={() => onOpenLightbox(urls, 0)}>
              Photos
            </Button>
          ) : null}
          <Tooltip label={item.pinned ? 'Désépingler' : 'Épingler'}>
            <ActionIcon variant="light" loading={pinMutation.isPending} onClick={() => pinMutation.mutate()} aria-label={item.pinned ? 'Désépingler cette annonce' : 'Épingler cette annonce'}>
              {item.pinned ? <IconPinnedOff size={16} /> : <IconPinned size={16} />}
            </ActionIcon>
          </Tooltip>
          {canReopen ? (
            <Button
              color="dark"
              variant="light"
              leftSection={<IconRefresh size={15} />}
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: 'À contacter', nextNotes: notes, reopen: true })}
            >
              Réouvrir
            </Button>
          ) : null}
          {item.isRemoved ? (
            <Button
              color="swiss"
              variant="light"
              leftSection={<IconTrash size={15} />}
              loading={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm('Supprimer cette annonce retirée du suivi ?')) deleteMutation.mutate();
              }}
            >
              Supprimer
            </Button>
          ) : null}
        </Group>

      <ListingMasonryGallery item={item} onOpen={onOpenLightbox} />

      <Group grow align="flex-end">
        <Select
          label="Statut"
          aria-label="Statut de l’annonce sélectionnée"
          data={statusOptions(statuses)}
          value={currentStatus}
          disabled={item.isRemoved || statusMutation.isPending}
          onChange={(status) => status && statusMutation.mutate({ status })}
        />
        <Button
          variant="light"
          loading={statusMutation.isPending}
          disabled={item.isRemoved}
          onClick={() => statusMutation.mutate({ status: currentStatus === 'À trier' ? 'À contacter' : 'Contacté' })}
        >
          {currentStatus === 'À trier' ? 'Garder' : 'Marquer contacté'}
        </Button>
      </Group>

      <TextInput
        label="Notes"
        value={notes}
        disabled={item.isRemoved}
        onChange={(event) => setNotes(event.currentTarget.value)}
        rightSectionWidth={86}
        rightSection={
          <Button
            size="compact-sm"
            variant="subtle"
            loading={statusMutation.isPending}
            disabled={item.isRemoved}
            onClick={() => statusMutation.mutate({ status: currentStatus, nextNotes: notes })}
          >
            Sauver
          </Button>
        }
      />

      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Vu: {shortWhen(item.firstSeenAt)} · MAJ: {fullWhen(item.updatedAt)}
        </Text>
        {!item.isRemoved ? (
          <Button
            variant="subtle"
            color="swiss"
            leftSection={<IconX size={15} />}
            loading={statusMutation.isPending}
            onClick={() => {
              if (window.confirm('Écarter cette annonce du suivi ?')) statusMutation.mutate({ status: 'Écartée' });
            }}
          >
            Écarter
          </Button>
        ) : null}
      </Group>
      </Stack>
    </Box>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StageTab>('triage');
  const [query, setQuery] = useState('');
  const [selectedListingId, setSelectedListingId] = useState<string | number | null>(null);
  const [scanJobId, setScanJobId] = useState<string | null>(() => localStorage.getItem(PROFILE_SCAN_STORAGE_KEY));
  const [scanJob, setScanJob] = useState<ScanJob | null>(null);
  const [cancellingScan, setCancellingScan] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [gridView, setGridView] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 961px)', isDesktopViewport());

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
    mutationFn: () => startProfileScan(),
    onSuccess: (job) => {
      const jobId = job.jobId;
      if (!jobId) throw new Error('Réponse API invalide: jobId manquant');
      localStorage.setItem(PROFILE_SCAN_STORAGE_KEY, jobId);
      setScanJobId(jobId);
      setScanJob({
        ok: true,
        status: 'running',
        total: job.total,
        done: job.done,
        currentStep: job.currentStep,
        startedAt: job.startedAt
      });
    },
    onError: (err) => {
      notifications.show({ color: 'swiss', title: 'Erreur scan', message: (err as Error).message, autoClose: false });
    }
  });

  useEffect(() => {
    if (!scanJobId) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const job = await getProfileScanStatus(scanJobId);
        if (cancelled) return;
        setScanJob(job);

        if (job.status === 'done') {
          localStorage.removeItem(PROFILE_SCAN_STORAGE_KEY);
          setScanJobId(null);
          setScanJob(null);
          setCancellingScan(false);
          await queryClient.invalidateQueries({ queryKey: ['state'] });
          const refreshed = await queryClient.fetchQuery({ queryKey: ['state'], queryFn: () => getDashboardState() });
          const newCount = job.newCount ?? refreshed.latest.newCount ?? 0;
          notifications.show({
            color: scanNotificationColor(newCount),
            title: 'Scan terminé',
            message: formatNewApartmentsFound(newCount)
          });
          return;
        }

        if (job.status === 'cancelled') {
          localStorage.removeItem(PROFILE_SCAN_STORAGE_KEY);
          setScanJobId(null);
          setScanJob(null);
          setCancellingScan(false);
          notifications.show({ color: 'slate', title: 'Scan annulé', message: 'Le scan a été interrompu.' });
          return;
        }

        if (job.status === 'error') {
          localStorage.removeItem(PROFILE_SCAN_STORAGE_KEY);
          setScanJobId(null);
          setScanJob(null);
          setCancellingScan(false);
          notifications.show({ color: 'swiss', title: 'Erreur scan', message: job.error || 'Scan interrompu', autoClose: false });
        }
      } catch (err) {
        if (!cancelled) {
          localStorage.removeItem(PROFILE_SCAN_STORAGE_KEY);
          setScanJobId(null);
          setScanJob(null);
          setCancellingScan(false);
          notifications.show({ color: 'swiss', title: 'Scan interrompu', message: (err as Error).message, autoClose: false });
        }
      }
    };

    poll();
    const interval = window.setInterval(poll, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [queryClient, scanJobId]);

  const state = stateQuery.data;
  const rawListings = useMemo(() => (state?.tracker.listings || []).filter((item) => item.display !== false), [state?.tracker.listings]);
  const counts = useMemo(() => stageCounts(rawListings as Listing[]), [rawListings]);
  const listings = useMemo(() => filterListingsForStage(rawListings as Listing[], activeTab, query), [activeTab, query, rawListings]);
  const selectedListingInList = useMemo(() => listings.find((item) => String(item.id) === String(selectedListingId)) || null, [listings, selectedListingId]);
  const selectedListing = selectedListingInList;

  useEffect(() => {
    if (!listings.length) {
      if (selectedListingId != null) setSelectedListingId(null);
      return;
    }
    if (selectedListingId != null && !selectedListingInList) {
      setSelectedListingId(null);
    }
  }, [listings, selectedListingId, selectedListingInList]);

  const activeProfile = state?.profile || profileQuery.data?.slug || '';
  const statuses = state?.tracker.statuses || DEFAULT_STATUSES;
  const activeCount = rawListings.filter((item) => !item.isRemoved).length;

  const selectListing = useCallback((id: string | number) => {
    setSelectedListingId((current) => (String(current) === String(id) ? null : id));
  }, []);
  const closeListing = useCallback(() => {
    setSelectedListingId(null);
  }, []);
  const closeSettings = () => setSettingsOpen(false);
  const finishSettings = () => {
    setSettingsOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['state'] });
    void queryClient.invalidateQueries({ queryKey: ['profile-detail'] });
  };

  const mapWithCoordinates = listings.filter((item) => !!item.mapLocation).length;
  const mapMissing = listings.length - mapWithCoordinates;
  const selectedMissingCoordinates = !!selectedListing && !selectedListing.mapLocation;
  const activeTitle = activeTab === 'triage' ? 'À trier maintenant' : STAGES.find((stage) => stage.value === activeTab)?.label || 'Suivi';
  const marketplaceUrl = marketplaceSearchUrl({ filters: state?.filters, isDesktop });
  const isGridView = isDesktop && gridView;
  const showInlineMap = isDesktop && !isGridView;
  const showFloatingMapButton = !isDesktop || isGridView;
  const mapPanelContent = (
    <Box pos="relative" h="100%">
      {mapMissing ? (
        <Alert color="amber" variant="light" pos="absolute" left={14} bottom={86} py={6} px="sm" style={{ zIndex: 4 }}>
          <Text size="xs" fw={700}>
            Carte partielle · {mapMissing} sans coordonnées
          </Text>
        </Alert>
      ) : null}
      {selectedMissingCoordinates ? (
        <Alert color="slate" variant="light" pos="absolute" right={14} bottom={86} py={6} px="sm" style={{ zIndex: 4 }}>
          <Text size="xs" fw={700}>
            Annonce sélectionnée sans coordonnées cartographiques.
          </Text>
        </Alert>
      ) : null}
      <ApartmentMap
        listings={listings}
        workplace={state?.map?.workplace || null}
        selectedListingId={selectedListing?.id || null}
        onSelectListing={selectListing}
        onClearSelection={closeListing}
        onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
        open
      />
    </Box>
  );

  return (
    <Container component="main" size={1520} py={{ base: 'md', sm: 'xl' }}>
      <ScanOverlay
        open={scanMutation.isPending || !!scanJobId}
        title="Scan en cours"
        subtitle={scanJob?.currentStep || 'Recherche des nouvelles annonces sur les sources actives.'}
        detail={formatScanProgressDetail(scanJob?.done || 0, scanJob?.total || 0, scanJob?.startedAt, 'étapes', scanJob?.currentStep)}
        progress={scanJob?.total ? ((scanJob.done || 0) / scanJob.total) * 100 : null}
        onCancel={scanJobId && !cancellingScan ? async () => {
          if (!scanJobId) return;
          setCancellingScan(true);
          try {
            await cancelProfileScan(scanJobId);
          } catch (err) {
            setCancellingScan(false);
            notifications.show({ color: 'swiss', title: 'Annulation impossible', message: (err as Error).message, autoClose: false });
          }
        } : undefined}
        cancelling={cancellingScan}
      />

      <Group component="header" justify="space-between" pb="md" mb="xl" bd="0 0 1px 0 solid var(--mantine-color-slate-2)">
        <Group gap="xs" aria-label="Atlas">
          <ThemeIcon color="dark" radius="sm" size={24}>
            <Text size="xs" fw={800}>
              A
            </Text>
          </ThemeIcon>
          <Text fw={800}>Atlas</Text>
        </Group>
        <Group gap="xs" ml="auto">
          <Tooltip label="Marketplace Facebook">
            <ActionIcon
              component="a"
              href={marketplaceUrl}
              target="_blank"
              rel="noreferrer"
              variant="subtle"
              size={38}
              aria-label="Ouvrir Facebook Marketplace"
            >
              <IconBrandFacebook size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Réglages">
            <ActionIcon variant="subtle" size={38} onClick={() => setSettingsOpen(true)} loading={profileQuery.isFetching && settingsOpen} aria-label="Réglages">
              <IconSettings size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Rafraîchir">
            <ActionIcon variant="subtle" size={38} onClick={() => stateQuery.refetch()} loading={stateQuery.isFetching && !scanMutation.isPending} aria-label="Rafraîchir">
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            color="dark"
            radius="xl"
            leftSection={<Box w={6} h={6} bg="alpine.3" bdrs="xl" />}
            onClick={() => scanMutation.mutate()}
            loading={scanMutation.isPending || !!scanJobId}
            disabled={scanMutation.isPending || !!scanJobId}
          >
            Scanner
          </Button>
        </Group>
      </Group>

      <Stack gap="xl">
        <Stack gap={6}>
          <Text tt="uppercase" fz="xs" fw={800} c="dimmed" lts="0.08em">
            Recherche en cours
          </Text>
          <Title order={1}>{activeTitle}</Title>
          <Text c="dimmed" size="sm">
            <Text span fw={800} c="dark">
              {state?.latest.newCount || 0} nouvelles annonces
            </Text>{' '}
            depuis {shortWhen(state?.latest.generatedAt)}
          </Text>
        </Stack>

      {stateQuery.error ? <ErrorAlert error={stateQuery.error} title="Impossible de charger le dashboard" /> : null}

      <TextInput
        aria-label="Filtrer les annonces"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Filtrer par titre, lieu, source..."
        leftSection={<IconSearch size={16} />}
        rightSection={<Kbd size="xs">/</Kbd>}
        size="md"
      />

      <Group justify="space-between" align="center" gap="md" wrap="wrap">
        <SegmentedControl
          value={activeTab}
          onChange={(value) => setActiveTab(value as StageTab)}
          data={STAGES.map((stage) => ({
            value: stage.value,
            label: `${stage.label} (${counts[stage.value]})`
          }))}
        />
        <Group gap="xs">
          {isDesktop ? (
            <Switch
              label="Vue grille"
              checked={gridView}
              onChange={(event) => setGridView(event.currentTarget.checked)}
              aria-label="Vue grille"
            />
          ) : null}
          {counts.triage > 0 ? (
            <Button
              variant="light"
              color="amber"
              radius="xl"
              leftSection={<IconCards size={16} />}
              onClick={() => setSwipeOpen(true)}
            >
              Trier ({counts.triage})
            </Button>
          ) : null}
        </Group>
      </Group>

      {stateQuery.isLoading ? (
        <Paper>
          <Text c="dimmed">Chargement des annonces...</Text>
        </Paper>
      ) : (
        <Grid gutter="md" align="flex-start">
          <Grid.Col span={{ base: 12, sm: isGridView ? 12 : 6 }} style={{ order: 1 }}>
            <Stack gap="sm" component="section" aria-label="Liste des annonces">
              <Group gap="xs">
                <Badge color="slate" variant="subtle">
                  {listings.length} affichées
                </Badge>
                <Badge color="slate" variant="subtle">
                  {activeCount} actives
                </Badge>
                {state?.map ? (
                  <Badge color="slate" variant="subtle">
                    {mapWithCoordinates} sur carte
                  </Badge>
                ) : null}
              </Group>
              <Box className={isGridView ? 'listing-results-grid' : 'listing-results-list'}>
                {listings.length ? (
                  listings.map((item) => {
                    const selected = String(item.id) === String(selectedListing?.id);
                    return (
                      <Paper
                        key={String(item.id)}
                        className="listing-list-card"
                        data-selected={selected || undefined}
                        p={0}
                      >
                        <ListingRow
                          item={item}
                          selected={selected}
                          onSelect={() => selectListing(item.id)}
                          onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
                        />
                        {selected && !isGridView ? (
                          <Box className="listing-card-accordion selected-detail-motion">
                            <SelectedListingPanel
                              profile={activeProfile}
                              item={item}
                              statuses={statuses}
                              onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
                              onClose={closeListing}
                            />
                          </Box>
                        ) : null}
                      </Paper>
                    );
                  })
                ) : (
                  <Paper>
                    <Text c="dimmed">Aucune annonce pour ce filtre.</Text>
                  </Paper>
                )}
              </Box>
            </Stack>
          </Grid.Col>

          {showInlineMap ? (
            <Grid.Col span={{ base: 12, sm: 6 }} style={{ order: 3 }}>
              <Paper
                data-testid="listing-map-panel"
                className="listing-map-panel"
                p={0}
                pos="sticky"
                top={24}
              >
                {mapPanelContent}
              </Paper>
            </Grid.Col>
          ) : null}
        </Grid>
      )}

      {showFloatingMapButton ? (
        <Button
          color="dark"
          radius="xl"
          size="md"
          leftSection={<IconMap size={18} />}
          onClick={() => setMapModalOpen(true)}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            zIndex: 200,
            boxShadow: 'var(--mantine-shadow-lg)'
          }}
        >
          Carte
        </Button>
      ) : null}

      <Drawer
        opened={isGridView && !!selectedListing}
        onClose={closeListing}
        position="right"
        size="lg"
        title="Détail de l’annonce"
        lockScroll
      >
        <SelectedListingPanel
          profile={activeProfile}
          item={selectedListing}
          statuses={statuses}
          onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
          onClose={closeListing}
        />
      </Drawer>

      <Drawer opened={settingsOpen} onClose={closeSettings} position="right" size="lg" title="Réglages du profil" lockScroll>
        {profileQuery.error ? (
          <ErrorAlert error={profileQuery.error} title="Impossible de charger les réglages" />
        ) : profileQuery.data ? (
          <ProfileForm profile={profileQuery.data} onCancel={closeSettings} onDone={finishSettings} presentation="modal" />
        ) : (
          <Text c="dimmed">Chargement des réglages...</Text>
        )}
      </Drawer>

      <Modal
        opened={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        fullScreen
        withCloseButton={false}
        padding={0}
        lockScroll
        transitionProps={{ duration: 0 }}
        classNames={{ root: 'atlas-map-modal', body: 'atlas-map-modal-body', content: 'atlas-map-modal-content', inner: 'atlas-map-modal-inner' }}
      >
        {mapModalOpen ? (
          <Box pos="relative" style={{ height: '100dvh', width: '100vw' }}>
            {mapPanelContent}
            <ActionIcon
              size={44}
              radius="xl"
              color="dark"
              variant="filled"
              pos="absolute"
              top={16}
              right={16}
              onClick={() => setMapModalOpen(false)}
              aria-label="Fermer la carte"
              style={{ zIndex: 10 }}
            >
              <IconX size={20} />
            </ActionIcon>
          </Box>
        ) : null}
      </Modal>

      <SwipeStack
        opened={swipeOpen}
        onClose={() => setSwipeOpen(false)}
        profile={activeProfile}
        triageListings={filterListingsForStage(rawListings as Listing[], 'triage', '')}
        onShowSaved={() => {
          setSwipeOpen(false);
          setActiveTab('active');
        }}
      />

      <Lightbox state={lightbox} onClose={() => setLightbox(null)} />
      </Stack>
    </Container>
  );
}
