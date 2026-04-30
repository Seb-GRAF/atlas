import { Box, Center, Group, Image, Text, UnstyledButton } from '@mantine/core';
import type { MouseEvent } from 'react';
import { Listing } from '../../api/schemas';
import { getImageUrls, listingTitle } from '../../utils/listings';

type GalleryVariant = 'table' | 'card' | 'kanban' | 'row';

type ListingImageGalleryProps = {
  item: Listing;
  onOpen: (urls: string[], index: number) => void;
  variant?: GalleryVariant;
  size?: number;
  stopPropagation?: boolean;
  showCover?: boolean;
  showThumbnails?: boolean;
};

const VARIANT_CONFIG = {
  table: {
    coverWidth: 82,
    coverHeight: 62,
    radius: 'sm',
    thumbnailLimit: 3,
    showMore: true,
    placeholder: true
  },
  card: {
    coverHeight: 160,
    radius: 'sm',
    thumbnailLimit: 4,
    showMore: false,
    placeholder: false
  },
  kanban: {
    coverHeight: 108,
    radius: 'sm',
    thumbnailLimit: 3,
    showMore: false,
    placeholder: false
  },
  row: {
    coverWidth: 64,
    coverHeight: 64,
    radius: 'md',
    thumbnailLimit: 0,
    showMore: false,
    placeholder: true
  }
} as const;

export function ListingImageGallery({
  item,
  onOpen,
  variant = 'table',
  size,
  stopPropagation = false,
  showCover = true,
  showThumbnails = true
}: ListingImageGalleryProps) {
  const urls = getImageUrls(item);
  const config = VARIANT_CONFIG[variant];
  const coverWidth = size ?? ('coverWidth' in config ? config.coverWidth : undefined);
  const coverHeight = size ?? config.coverHeight;

  const open = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    if (stopPropagation) event.stopPropagation();
    onOpen(urls, index);
  };

  if (!urls.length) {
    if (!config.placeholder) return null;
    if (!showCover) return null;

    return (
      <Center
        w={coverWidth}
        h={coverHeight}
        bg="slate.1"
        bd="1px solid slate.2"
        bdrs={config.radius}
        c="dimmed"
        fz="xs"
        aria-label="Aucune image"
      >
        {variant === 'row' ? '-' : null}
      </Center>
    );
  }

  const thumbnails = showThumbnails && config.thumbnailLimit
    ? urls.slice(1, 1 + config.thumbnailLimit)
    : [];
  const hasMore = showThumbnails && config.showMore && urls.length > 1 + config.thumbnailLimit;
  const thumbStrip = thumbnails.length || hasMore ? (
    <Group gap={4} mt={showCover ? 4 : 0} wrap="nowrap">
      {thumbnails.map((src, index) => (
        <UnstyledButton
          key={`${src}-${index}`}
          type="button"
          onClick={(event) => open(event, index + 1)}
          aria-label={`Voir la photo ${index + 2} de ${listingTitle(item)}`}
        >
          <Image
            src={src}
            alt={`Photo ${index + 2}`}
            w={24}
            h={20}
            fit="cover"
            bd="1px solid slate.2"
            radius="xs"
            loading="lazy"
          />
        </UnstyledButton>
      ))}
      {hasMore ? (
        <UnstyledButton
          type="button"
          onClick={(event) => open(event, 1 + config.thumbnailLimit)}
          aria-label={`Voir ${urls.length - 1 - config.thumbnailLimit} photos supplémentaires`}
        >
          <Text size="xs" c="dimmed">
            +{urls.length - 1 - config.thumbnailLimit}
          </Text>
        </UnstyledButton>
      ) : null}
    </Group>
  ) : null;

  if (!showCover) return thumbStrip;

  return (
    <Box>
      <UnstyledButton
        type="button"
        onClick={(event) => open(event, 0)}
        w={coverWidth || '100%'}
        h={coverHeight}
        display="block"
        aria-label={`Voir les photos de ${listingTitle(item)}`}
      >
        <Image
          src={urls[0]}
          alt={`Aperçu ${listingTitle(item)}`}
          w={coverWidth || '100%'}
          h={coverHeight}
          fit="cover"
          bd={variant === 'table' ? '1px solid slate.2' : undefined}
          bg="slate.0"
          radius={config.radius}
          loading="lazy"
        />
      </UnstyledButton>

      {thumbStrip}
    </Box>
  );
}

export function ListingMasonryGallery({
  item,
  onOpen
}: {
  item: Listing;
  onOpen: (urls: string[], index: number) => void;
}) {
  const urls = getImageUrls(item);
  if (!urls.length) return null;
  const visibleUrls = urls.slice(0, 12);
  const overflowCount = urls.length - visibleUrls.length;
  const title = listingTitle(item);

  return (
    <Box
      className="listing-detail-masonry"
      role="group"
      aria-label={`Photos de l’annonce, ${urls.length} image${urls.length > 1 ? 's' : ''}`}
    >
      {visibleUrls.map((src, index) => (
        <UnstyledButton
          key={`${src}-${index}`}
          type="button"
          className={[
            'listing-detail-masonry-item',
            index === 0 ? 'is-featured' : '',
            index % 5 === 2 ? 'is-tall' : '',
            index === 3 ? 'is-row-fill' : '',
            index % 5 === 4 ? 'is-wide' : ''
          ].filter(Boolean).join(' ')}
          onClick={() => onOpen(urls, index)}
          aria-label={index === 0 ? `Voir la photo principale de ${title}` : `Voir la photo ${index + 1} de ${title}`}
        >
          <Image
            src={src}
            alt={`Photo ${index + 1} de ${title}`}
            fit="cover"
            loading="lazy"
          />
          {overflowCount > 0 && index === visibleUrls.length - 1 ? (
            <Text component="span" className="listing-detail-masonry-more" aria-hidden>
              +{overflowCount}
            </Text>
          ) : null}
        </UnstyledButton>
      ))}
    </Box>
  );
}
