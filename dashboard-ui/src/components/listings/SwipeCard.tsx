import { ActionIcon, Badge, Box, Button, Group, Image, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconBookmarkFilled, IconExternalLink, IconPhoto, IconPin, IconX } from '@tabler/icons-react';
import { useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { Listing } from '../../api/schemas';
import { useSwipeGesture, SwipeDirection } from '../../hooks/useSwipeGesture';
import { money } from '../../utils/format';
import { getImageUrls, listingTitle, normalizeListingStatus, publishedLabel } from '../../utils/listings';
import { ListingBadges } from './ListingBadges';
import { StatusBadge } from '../status/StatusBadge';

export type SwipeCardHandle = {
  triggerExit: (direction: SwipeDirection) => void;
};

type SwipeCardProps = {
  item: Listing;
  position: 'front' | 'back';
  enabled: boolean;
  pinning?: boolean;
  onCommit: (direction: SwipeDirection) => void;
  onTogglePin: () => void;
  onOpenLightbox: (urls: string[], index: number) => void;
};

function factsLine(item: Listing) {
  const bits: string[] = [];
  if (item.surfaceM2 != null) bits.push(`${item.surfaceM2} m²`);
  const commute = item.transitText || item.driveText || item.distanceText;
  if (commute) bits.push(commute);
  return bits.join(' · ');
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { item, position, enabled, pinning, onCommit, onTogglePin, onOpenLightbox },
  ref
) {
  const urls = getImageUrls(item);
  const heroUrl = urls[0];
  const [progress, setProgress] = useState(0);

  const { cardRef, handlers, isDragging, beginExit, reset } = useSwipeGesture({
    enabled: enabled && position === 'front',
    onCommit,
    onProgress: setProgress
  });

  useImperativeHandle(ref, () => ({ triggerExit: beginExit }), [beginExit]);

  useEffect(() => {
    reset();
    setProgress(0);
  }, [item.id, reset]);

  // Show badges almost immediately so user sees intent before card flies away.
  const REVEAL_AT = 4;
  const FULL_AT = 90;
  const absProgress = Math.abs(progress);
  const overlayOpacity = Math.min(1, Math.max(0, (absProgress - REVEAL_AT) / (FULL_AT - REVEAL_AT)));
  const overlayScale = 0.7 + Math.min(0.3, absProgress / 220);
  const showSavedOverlay = progress > REVEAL_AT;
  const showNopeOverlay = progress < -REVEAL_AT;
  const tintLeft = progress < 0 ? Math.min(0.32, absProgress / 280) : 0;
  const tintRight = progress > 0 ? Math.min(0.32, absProgress / 280) : 0;

  const isFront = position === 'front';
  // Back card subtly scales up as front card travels — feels like it's rising forward.
  const backScale = 0.94 + Math.min(0.06, absProgress / 600);
  const backLift = Math.max(0, 8 - absProgress / 30);
  const baseTransform = isFront ? undefined : `scale(${backScale}) translateY(${backLift}px)`;

  return (
    <Box
      ref={cardRef}
      {...(isFront ? handlers : {})}
      style={{
        gridArea: '1 / 1',
        alignSelf: 'center',
        justifySelf: 'stretch',
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        background: 'var(--mantine-color-body)',
        boxShadow: isFront
          ? isDragging
            ? '0 36px 80px -28px rgba(15, 23, 42, 0.55), 0 8px 20px -8px rgba(15, 23, 42, 0.22)'
            : '0 24px 64px -32px rgba(15, 23, 42, 0.45), 0 4px 16px -4px rgba(15, 23, 42, 0.18)'
          : '0 16px 40px -28px rgba(15, 23, 42, 0.35), 0 2px 8px -4px rgba(15, 23, 42, 0.12)',
        touchAction: isFront ? 'pan-y' : 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        cursor: isFront ? (isDragging ? 'grabbing' : 'grab') : 'default',
        zIndex: isFront ? 2 : 1,
        transform: baseTransform,
        transition: !isFront
          ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
          : isDragging
            ? 'box-shadow 120ms ease'
            : 'box-shadow 200ms ease',
        willChange: isFront ? 'transform' : undefined,
        backfaceVisibility: 'hidden',
        height: 'fit-content',
      }}
      data-position={position}
    >
      <Stack gap={0} h="100%">
        <Box pos="relative" style={{ flex: '1 1 auto', height: 280, maxHeight: 280, overflow: 'hidden' }}>
          {heroUrl ? (
            <UnstyledButton
              onClick={(event) => {
                event.stopPropagation();
                onOpenLightbox(urls, 0);
              }}
              style={{ display: 'block', width: '100%', height: '100%' }}
              aria-label="Ouvrir les photos"
            >
              <Image
                src={heroUrl}
                alt={listingTitle(item)}
                h="100%"
                w="100%"
                fit="cover"
                draggable={false}
                style={{ pointerEvents: 'none', userSelect: 'none', display: 'block', aspectRatio: '16/9' }}
              />
            </UnstyledButton>
          ) : (
            <Box
              h="100%"
              bg="slate.1"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <IconPhoto size={42} color="var(--mantine-color-slate-5)" />
            </Box>
          )}
          {urls.length > 1 ? (
            <Badge
              variant="filled"
              color="dark"
              size="sm"
              pos="absolute"
              top={12}
              right={12}
              leftSection={<IconPhoto size={12} />}
            >
              {urls.length}
            </Badge>
          ) : null}

          {/* Edge tint: subtle directional glow that confirms intent during drag */}
          <Box
            pos="absolute"
            inset={0}
            style={{
              pointerEvents: 'none',
              background: `linear-gradient(90deg, rgba(217, 67, 59, ${tintLeft}) 0%, rgba(217, 67, 59, 0) 45%, rgba(227, 169, 30, 0) 55%, rgba(227, 169, 30, ${tintRight}) 100%)`,
              transition: isDragging ? 'none' : 'background 200ms ease',
              mixBlendMode: 'multiply'
            }}
            aria-hidden
          />

          <Box
            pos="absolute"
            top={24}
            left={24}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transform: `rotate(-14deg) scale(${showNopeOverlay ? overlayScale : 0.7})`,
              padding: '8px 18px 8px 14px',
              border: '4px solid var(--mantine-color-swiss-6)',
              borderRadius: 12,
              color: 'var(--mantine-color-swiss-6)',
              fontWeight: 900,
              fontSize: 30,
              letterSpacing: '0.1em',
              background: 'rgba(255, 255, 255, 0.94)',
              boxShadow: `0 12px 32px -12px rgba(217, 67, 59, ${showNopeOverlay ? overlayOpacity * 0.6 : 0})`,
              opacity: showNopeOverlay ? overlayOpacity : 0,
              transition: isDragging ? 'none' : 'opacity 180ms ease, transform 180ms ease',
              transformOrigin: 'top left'
            }}
            aria-hidden
          >
            <IconX size={28} stroke={3} />
            ÉCARTÉE
          </Box>
          <Box
            pos="absolute"
            top={24}
            right={24}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transform: `rotate(14deg) scale(${showSavedOverlay ? overlayScale : 0.7})`,
              padding: '8px 14px 8px 18px',
              border: '4px solid var(--mantine-color-amber-6)',
              borderRadius: 12,
              color: 'var(--mantine-color-amber-7)',
              fontWeight: 900,
              fontSize: 30,
              letterSpacing: '0.1em',
              background: 'rgba(255, 255, 255, 0.94)',
              boxShadow: `0 12px 32px -12px rgba(227, 169, 30, ${showSavedOverlay ? overlayOpacity * 0.7 : 0})`,
              opacity: showSavedOverlay ? overlayOpacity : 0,
              transition: isDragging ? 'none' : 'opacity 180ms ease, transform 180ms ease',
              transformOrigin: 'top right'
            }}
            aria-hidden
          >
            GARDER
            <IconBookmarkFilled size={26} />
          </Box>
        </Box>

        <Stack
          gap="sm"
          px="xl"
          pt="lg"
          pb="lg"
          style={{ flex: '0 0 auto', background: 'var(--mantine-color-body)' }}
        >
          <Group justify="space-between" align="baseline" wrap="nowrap" gap="sm">
            <Text fw={800} size="lg" lineClamp={1} lh={1.2} style={{ flex: 1, minWidth: 0 }}>
              {listingTitle(item)}
            </Text>
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {publishedLabel(item)}
            </Text>
          </Group>

          <Text size="sm" c="dimmed" lineClamp={1}>
            {item.address || item.area || 'Lieu non renseigné'}
          </Text>

          <Group justify="space-between" align="flex-end" wrap="nowrap" gap="md">
            <Text fw={900} size="xl" ff="var(--mantine-font-family-monospace)" lh={1.1}>
              {money(item.totalChf)}
            </Text>
            {factsLine(item) ? (
              <Text size="sm" c="dimmed" ta="right" lineClamp={1} style={{ minWidth: 0 }}>
                {factsLine(item)}
              </Text>
            ) : null}
          </Group>

          <Group gap={6} wrap="wrap" align="center">
            <StatusBadge status={normalizeListingStatus(item.status)} />
            <ListingBadges item={item} />
          </Group>

          <Group gap="xs" pt={4} wrap="nowrap">
            {item.url ? (
              <Button
                component="a"
                href={item.url}
                target="_blank"
                rel="noreferrer"
                variant="light"
                leftSection={<IconExternalLink size={16} />}
                onClick={(event) => event.stopPropagation()}
                style={{ flex: 1 }}
              >
                Ouvrir l'annonce
              </Button>
            ) : null}
            <ActionIcon
              variant={item.pinned ? 'filled' : 'light'}
              color={item.pinned ? 'amber' : 'slate'}
              size={36}
              radius="xl"
              loading={pinning}
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin();
              }}
              aria-label={item.pinned ? 'Désépingler' : 'Épingler'}
            >
              <IconPin size={16} />
            </ActionIcon>
          </Group>
        </Stack>
      </Stack>
    </Box>
  );
});
