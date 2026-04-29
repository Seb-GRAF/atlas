import { ActionIcon, Box, Button, Group, Modal, Progress, Stack, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconArrowRight, IconBookmark, IconCircleCheck, IconPin, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toggleListingPin, updateListingStatus } from '../../api/listings';
import { Listing } from '../../api/schemas';
import { SwipeDirection } from '../../hooks/useSwipeGesture';
import { Lightbox, LightboxState } from './Lightbox';
import { SwipeCard, SwipeCardHandle } from './SwipeCard';

type SwipeStackProps = {
  opened: boolean;
  onClose: () => void;
  profile: string;
  triageListings: Listing[];
  onShowSaved: () => void;
};

const STATUS_FOR_DIRECTION: Record<SwipeDirection, string> = {
  right: 'À contacter',
  left: 'Écartée'
};

export function SwipeStack({ opened, onClose, profile, triageListings, onShowSaved }: SwipeStackProps) {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [queue, setQueue] = useState<Listing[]>([]);
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [pinningId, setPinningId] = useState<string | number | null>(null);
  const cardRef = useRef<SwipeCardHandle | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (opened) {
      setQueue(triageListings);
      setIndex(0);
      dirtyRef.current = false;
    }
    // intentionally only re-snapshot on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string | number; status: string }) =>
      updateListingStatus(profile, id, status, ''),
    onError: (err) => {
      notifications.show({
        color: 'swiss',
        title: 'Échec du tri',
        message: (err as Error).message || 'Impossible d’enregistrer le statut.',
        autoClose: 6000
      });
    }
  });

  const pinMutation = useMutation({
    mutationFn: (id: string | number) => toggleListingPin(profile, id),
    onMutate: (id) => setPinningId(id),
    onSettled: () => setPinningId(null),
    onError: (err) => {
      notifications.show({
        color: 'swiss',
        title: 'Erreur épingle',
        message: (err as Error).message || 'Impossible de modifier l’épingle.'
      });
    }
  });

  const current = queue[index];
  const next = queue[index + 1];

  const commit = useCallback(
    (direction: SwipeDirection) => {
      const item = queue[index];
      if (!item) return;
      dirtyRef.current = true;
      statusMutation.mutate({ id: item.id, status: STATUS_FOR_DIRECTION[direction] });
      setIndex((i) => i + 1);
    },
    [index, queue, statusMutation]
  );

  const triggerExit = useCallback((direction: SwipeDirection) => {
    if (cardRef.current) {
      cardRef.current.triggerExit(direction);
    } else {
      commit(direction);
    }
  }, [commit]);

  const togglePin = useCallback(() => {
    const item = queue[index];
    if (!item) return;
    dirtyRef.current = true;
    pinMutation.mutate(item.id);
    setQueue((current) =>
      current.map((listing, i) => (i === index ? { ...listing, pinned: !listing.pinned } : listing))
    );
  }, [index, pinMutation, queue]);

  const handleClose = useCallback(() => {
    if (dirtyRef.current) {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
    }
    setLightbox(null);
    onClose();
  }, [onClose, queryClient]);

  useEffect(() => {
    if (!opened) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (lightbox) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        triggerExit('left');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        triggerExit('right');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        togglePin();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [opened, lightbox, triggerExit, togglePin, handleClose]);

  const total = queue.length;
  const remaining = Math.max(0, total - index);
  const progressPercent = total ? (Math.min(index, total) / total) * 100 : 0;
  const isExhausted = !current;

  const openLightbox = useCallback((urls: string[], i: number) => {
    setLightbox({ urls, index: i });
  }, []);

  const lightboxOpen = !!lightbox;

  const stackContent = useMemo(() => {
    if (isExhausted) {
      return (
        <Stack align="center" justify="center" gap="md" py="xl" style={{ height: 'fit-content' }}>
          <IconCircleCheck size={64} color="var(--mantine-color-alpine-6)" />
          <Stack gap={4} align="center">
            <Text fw={800} size="lg">
              {total === 0 ? 'Aucune annonce à trier' : 'File de tri vide'}
            </Text>
            <Text c="dimmed" size="sm" ta="center" maw={360}>
              {total === 0
                ? 'Toutes les annonces ont déjà été triées. Lancez un scan pour en découvrir de nouvelles.'
                : `${total} annonce${total > 1 ? 's' : ''} traitée${total > 1 ? 's' : ''}.`}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button variant="light" onClick={onShowSaved}>
              Voir à contacter
            </Button>
            <Button onClick={handleClose}>Fermer</Button>
          </Group>
        </Stack>
      );
    }

    return (
      <Box
        pos="relative"
        style={{
          width: '100%',
          maxWidth: 480,
          height: '100%',
          margin: 'auto',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gridTemplateRows: '1fr',
          alignItems: 'center',
          justifyItems: 'center'
        }}
      >
        {next ? (
          <SwipeCard
            key={`back-${String(next.id)}`}
            item={next}
            position="back"
            enabled={false}
            onCommit={() => undefined}
            onTogglePin={() => undefined}
            onOpenLightbox={openLightbox}
          />
        ) : null}
        {current ? (
          <SwipeCard
            key={`front-${String(current.id)}`}
            ref={cardRef}
            item={current}
            position="front"
            enabled={!lightboxOpen}
            pinning={pinningId === current.id}
            onCommit={commit}
            onTogglePin={togglePin}
            onOpenLightbox={openLightbox}
          />
        ) : null}
      </Box>
    );
  }, [commit, current, handleClose, isExhausted, lightboxOpen, next, onShowSaved, openLightbox, pinningId, togglePin, total]);

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        fullScreen={isMobile}
        size="lg"
        centered
        withCloseButton={false}
        closeOnEscape={false}
        trapFocus
        lockScroll
        padding={0}
        classNames={isMobile ? { content: 'atlas-swipe-modal-content', body: 'atlas-swipe-modal-body', inner: 'atlas-swipe-modal-inner' } : undefined}
        styles={{
          body: {
            padding: 0,
            height: isMobile ? '100dvh' : '60dvh',
            maxHeight: isMobile ? '100dvh' : '60dvh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          },
          content: {
            background: 'var(--mantine-color-slate-0)',
            height: isMobile ? '100dvh' : undefined,
            maxHeight: isMobile ? '100dvh' : undefined,
            overflow: 'hidden'
          }
        }}
      >
        <Stack gap={0} h="100%">
          <Group justify="space-between" align="center" px="lg" py="md" wrap="nowrap">
            <Stack gap={2} miw={0}>
              <Text tt="uppercase" fz="xs" fw={800} c="dimmed" lts="0.08em">
                Tri rapide
              </Text>
              <Text fw={700} size="sm">
                {isExhausted
                  ? `${total} annonce${total > 1 ? 's' : ''} triée${total > 1 ? 's' : ''}`
                  : `Annonce ${Math.min(index + 1, total)} / ${total}`}
              </Text>
            </Stack>
            <ActionIcon variant="subtle" size="lg" onClick={handleClose} aria-label="Fermer">
              <IconX size={18} />
            </ActionIcon>
          </Group>
          {total > 0 ? (
            <Progress value={progressPercent} color="alpine" size={3} radius={0} />
          ) : null}

          <Box
            style={{
              flex: 1,
              minHeight: 0,
              padding: isMobile ? '14px 24px 8px' : '20px 40px 12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {stackContent}
          </Box>

          {!isExhausted ? (
            <Group
              justify="center"
              gap={isMobile ? 'lg' : 'xl'}
              py={isMobile ? 'sm' : 'lg'}
              px="lg"
              wrap="nowrap"
            >
              <Tooltip label="Écarter (←)">
                <ActionIcon
                  size={isMobile ? 52 : 64}
                  radius="xl"
                  variant="white"
                  color="swiss"
                  onClick={() => triggerExit('left')}
                  aria-label="Écarter"
                  style={{ boxShadow: '0 8px 24px -12px rgba(15,23,42,0.4)' }}
                >
                  <IconArrowLeft size={isMobile ? 22 : 28} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Épingler (↑)">
                <ActionIcon
                  size={isMobile ? 40 : 48}
                  radius="xl"
                  variant="white"
                  color="slate"
                  onClick={togglePin}
                  loading={pinningId != null}
                  aria-label="Épingler"
                  style={{ boxShadow: '0 6px 18px -10px rgba(15,23,42,0.35)' }}
                >
                  <IconPin size={isMobile ? 18 : 20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Garder (→)">
                <ActionIcon
                  size={isMobile ? 52 : 64}
                  radius="xl"
                  variant="white"
                  color="amber"
                  onClick={() => triggerExit('right')}
                  aria-label="Garder"
                  style={{ boxShadow: '0 8px 24px -12px rgba(15,23,42,0.4)' }}
                >
                  <IconBookmark size={isMobile ? 22 : 26} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : null}
        </Stack>
      </Modal>
      <Lightbox state={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
