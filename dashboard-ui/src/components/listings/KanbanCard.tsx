import { Anchor, Card, Group, Stack, Text } from '@mantine/core';
import { Listing } from '../../api/schemas';
import { money, shortWhen } from '../../utils/format';
import {
  getUrgency,
  listingSourceLabel,
  listingTitle,
  publishedLabel
} from '../../utils/listings';
import { DeleteRemovedButton, PinButton, StatusSelect } from './ListingControls';
import { ListingBadges, UrgencyBadge } from './ListingBadges';
import { getCardProps } from './rowStyle';
import { ListingImageGallery } from './ListingImageGallery';

export function KanbanCard({
  item,
  profile,
  statuses,
  onOpenLightbox
}: {
  item: Listing;
  profile: string;
  statuses: string[];
  onOpenLightbox: (urls: string[], index: number) => void;
}) {
  return (
    <Card p="sm" {...getCardProps(item)} draggable={!item.isRemoved} onDragStart={(event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(item.id));
    }}>
      <Stack gap="xs">
        <ListingImageGallery item={item} onOpen={onOpenLightbox} variant="kanban" showThumbnails={false} />
        <Group gap={6}>
          <Text fw={800} size="sm" ml="auto">{money(item.totalChf)}</Text>
        </Group>
        <Anchor href={item.url || '#'} target="_blank" rel="noreferrer" fw={800} size="sm">{listingTitle(item)}</Anchor>
        <Text size="xs" c="dimmed">
          {item.area || '-'} · {item.address || ''}{listingSourceLabel(item) ? ` · ${listingSourceLabel(item)}` : ''}
        </Text>
        <Text size="xs" c="dimmed">Publié: {publishedLabel(item)}</Text>
        <ListingBadges item={item} />
        <Group gap={4}>
          <UrgencyBadge {...getUrgency(item)} />
          <ListingImageGallery item={item} onOpen={onOpenLightbox} variant="kanban" showCover={false} />
        </Group>
        {item.isRemoved ? (
          <Stack gap={6}>
            <Text size="xs" c="dimmed">Retirée le {shortWhen(item.removedAt || item.lastSeenAt)}</Text>
            <DeleteRemovedButton profile={profile} item={item} />
          </Stack>
        ) : (
          <Group gap={6} wrap="nowrap">
            <PinButton profile={profile} item={item} />
            <StatusSelect profile={profile} item={item} statuses={statuses} />
          </Group>
        )}
      </Stack>
    </Card>
  );
}
