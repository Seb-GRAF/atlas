import { Anchor, Card, Group, Image, Stack, Text, UnstyledButton } from '@mantine/core';
import { Listing } from '../../api/schemas';
import { money, shortWhen } from '../../utils/format';
import {
  getImageUrls,
  getUrgency,
  listingSourceLabel,
  listingTitle,
  publishedLabel
} from '../../utils/listings';
import { DeleteRemovedButton, PinButton, StatusSelect } from './ListingControls';
import { ListingBadges, UrgencyBadge } from './ListingBadges';
import { ScoreBadge } from './ScoreBadge';
import { getCardStyle } from './rowStyle';

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
  const urls = getImageUrls(item);

  return (
    <Card p="sm" style={getCardStyle(item)} draggable={!item.isRemoved} onDragStart={(event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(item.id));
    }}>
      <Stack gap="xs">
        {urls[0] ? (
          <UnstyledButton onClick={() => onOpenLightbox(urls, 0)}>
            <Image src={urls[0]} alt={`Aperçu ${listingTitle(item)}`} h={108} radius="sm" fit="cover" loading="lazy" />
          </UnstyledButton>
        ) : null}
        <Group gap={6}>
          <ScoreBadge item={item} />
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
          {urls.slice(1, 4).map((url, index) => (
            <UnstyledButton key={`${url}-${index}`} onClick={() => onOpenLightbox(urls, index + 1)}>
              <Image src={url} alt="miniature" w={24} h={20} radius="xs" fit="cover" bd="1px solid slate.2" loading="lazy" />
            </UnstyledButton>
          ))}
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
