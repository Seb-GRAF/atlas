import { Anchor, Card, Center, Group, Stack, Text } from '@mantine/core';
import { Listing } from '../../api/schemas';
import { money, shortWhen } from '../../utils/format';
import {
  getUrgency,
  listingSourceLabel,
  listingTitle,
  publishedLabel
} from '../../utils/listings';
import { DeleteRemovedButton, NotesSave, PinButton, StatusSelect } from './ListingControls';
import { ListingBadges, UrgencyBadge } from './ListingBadges';
import { getCardProps } from './rowStyle';
import { ListingImageGallery } from './ListingImageGallery';

export function ListingCards({
  profile,
  listings,
  statuses,
  onOpenLightbox
}: {
  profile: string;
  listings: Listing[];
  statuses: string[];
  onOpenLightbox: (urls: string[], index: number) => void;
}) {
  if (!listings.length) {
    return (
      <Stack gap="sm" hiddenFrom="md">
        <Card>
          <Center>
            <Text c="dimmed">Aucune annonce ne correspond à la recherche.</Text>
          </Center>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="sm" hiddenFrom="md">
      {listings.map((item) => {
        return (
          <Card key={String(item.id)} {...getCardProps(item)}>
            <Stack gap="sm">
              <ListingImageGallery item={item} onOpen={onOpenLightbox} variant="card" showThumbnails={false} />
              <Group gap={6} align="center">
                <Text fw={800} ml="auto">
                  {money(item.totalChf)}
                </Text>
              </Group>
              <div>
                <Anchor href={item.url || '#'} target="_blank" rel="noreferrer" fw={800}>
                  {listingTitle(item)}
                </Anchor>
                <Text size="sm" c="dimmed">
                  {item.address || ''}
                </Text>
                <Text size="sm" c="dimmed">
                  {item.area || '-'} · {listingSourceLabel(item) || 'source n/a'}
                </Text>
                <Text size="sm" c="dimmed">
                  Publié: {publishedLabel(item)} · {item.priceRaw || ''}
                </Text>
                <ListingBadges item={item} />
              </div>
              <ListingImageGallery item={item} onOpen={onOpenLightbox} variant="card" showCover={false} />
              {item.isRemoved ? (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Annonce retirée le {shortWhen(item.removedAt || item.lastSeenAt)}
                  </Text>
                  <DeleteRemovedButton profile={profile} item={item} />
                </Group>
              ) : (
                <Stack gap="xs">
                  <Group gap={6}>
                    <PinButton profile={profile} item={item} />
                    <StatusSelect profile={profile} item={item} statuses={statuses} />
                    <UrgencyBadge {...getUrgency(item)} />
                  </Group>
                  <NotesSave profile={profile} item={item} />
                </Stack>
              )}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
