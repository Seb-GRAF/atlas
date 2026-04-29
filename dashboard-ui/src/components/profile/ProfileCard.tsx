import { ActionIcon, Button, Card, Group, SimpleGrid, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { ProfileSummary } from '../../api/schemas';
import { navigate } from '../../app/routes';
import { fullWhen } from '../../utils/format';

export function ProfileCard({
  profile,
  onEdit,
  onDelete
}: {
  profile: ProfileSummary;
  onEdit: (slug: string) => void;
  onDelete: (profile: ProfileSummary) => void;
}) {
  const url = `/${encodeURIComponent(profile.slug)}/dashboard`;
  return (
    <Card>
      <Stack gap="sm" h="100%">
        <button type="button" onClick={() => navigate(url)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
          <Title order={3}>{profile.shortTitle || profile.name || profile.slug}</Title>
          <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
            {profile.areas || 'Aucune zone'}
          </Text>
        </button>
        <SimpleGrid cols={3} spacing="xs" mt="auto">
          <div>
            <Text size="xs" c="dimmed">Annonces</Text>
            <Text size="sm" fw={750}>{profile.listingsCount ?? '-'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Loyer max</Text>
            <Text size="sm" fw={750}>{profile.maxRent ? `CHF ${profile.maxRent}` : '-'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Dernier scan</Text>
            <Text size="sm" fw={750} lineClamp={1}>{fullWhen(profile.lastScanAt)}</Text>
          </div>
        </SimpleGrid>
        <Group justify="space-between" pt="xs">
          <Button onClick={() => navigate(url)}>Ouvrir</Button>
          <Group gap={4}>
            <Tooltip label="Modifier">
              <ActionIcon variant="subtle" color="lake" onClick={() => onEdit(profile.slug)} aria-label="Modifier">
                <IconEdit size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Supprimer">
              <ActionIcon variant="subtle" color="swiss" onClick={() => onDelete(profile)} aria-label="Supprimer">
                <IconTrash size={17} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}
