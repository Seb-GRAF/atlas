import { Anchor, Card, Center, Group, Image, Stack, Text, UnstyledButton } from '@mantine/core';
import { Listing } from '../../api/schemas';
import { money, shortWhen } from '../../utils/format';
import {
  getImageUrls,
  getUrgency,
  listingSourceLabel,
  listingTitle,
  publishedLabel
} from '../../utils/listings';
import { DeleteRemovedButton, NotesSave, PinButton, StatusSelect } from './ListingControls';
import { ListingBadges, UrgencyBadge } from './ListingBadges';
import { ScoreBadge } from './ScoreBadge';
import { getCardStyle } from './rowStyle';

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
        const urls = getImageUrls(item);

        return (
          <Card key={String(item.id)} style={getCardStyle(item)}>
            <Stack gap="sm">
              {urls[0] ? (
                <UnstyledButton onClick={() => onOpenLightbox(urls, 0)}>
                  <Image
                    src={urls[0]}
                    alt={`Aperçu ${listingTitle(item)}`}
                    h={160}
                    radius="sm"
                    fit="cover"
                    loading="lazy"
                  />
                </UnstyledButton>
              ) : null}
              <Group gap={6} align="center">
                <ScoreBadge item={item} />
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
              {urls.length > 1 ? (
                <Group gap={4}>
                  {urls.slice(1, 5).map((url, index) => (
                    <UnstyledButton
                      key={`${url}-${index}`}
                      onClick={() => onOpenLightbox(urls, index + 1)}
                    >
                      <Image
                        src={url}
                        alt="miniature"
                        w={24}
                        h={20}
                        radius="xs"
                        fit="cover"
                        bd="1px solid slate.2"
                        loading="lazy"
                      />
                    </UnstyledButton>
                  ))}
                </Group>
              ) : null}
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
