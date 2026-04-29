import { useState } from 'react';
import { Card, Center, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Listing } from '../../api/schemas';
import { updateListingStatus } from '../../api/listings';
import { DEFAULT_STATUSES, REMOVED_KANBAN_STATUS, normalizeListingStatus } from '../../utils/listings';
import { KanbanCard } from './KanbanCard';

export function KanbanBoard({
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
  const queryClient = useQueryClient();
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ item, status }: { item: Listing; status: string }) =>
      updateListingStatus(profile, item.id, status, item.notes || ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['state'] }),
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur kanban', message: (err as Error).message })
  });

  const orderedStatuses = [
    ...new Set((statuses.length ? statuses : DEFAULT_STATUSES).map(normalizeListingStatus)),
    REMOVED_KANBAN_STATUS
  ];

  if (!listings.length) {
    return (
      <Card>
        <Text c="dimmed" ta="center">
          Aucune annonce pour ce filtre.
        </Text>
      </Card>
    );
  }

  return (
    <ScrollArea type="auto" offsetScrollbars="x">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {orderedStatuses.map((status) => {
          const colItems =
            status === REMOVED_KANBAN_STATUS
              ? listings.filter((item) => item.isRemoved)
              : listings.filter((item) => !item.isRemoved && normalizeListingStatus(item.status) === status);

          return (
            <Card key={status} p="sm" miw={260} maw={320} mih={220}>
              <Group justify="space-between" mb="sm">
                <Text fw={800}>{status}</Text>
                <Text size="sm" c="dimmed">
                  {colItems.length}
                </Text>
              </Group>
              <Stack
                gap="xs"
                mih={150}
                p="xs"
                bdrs="sm"
                bg={dropTarget === status ? 'lake.0' : 'transparent'}
                bd={dropTarget === status ? '2px solid var(--mantine-color-lake-5)' : '2px solid transparent'}
                onDragOver={(event) => {
                  if (status === REMOVED_KANBAN_STATUS) return;
                  event.preventDefault();
                  setDropTarget(status);
                }}
                onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropTarget(null);
                  if (status === REMOVED_KANBAN_STATUS) return;
                  const id = event.dataTransfer.getData('text/plain');
                  const item = listings.find((candidate) => String(candidate.id) === id);
                  if (!item || item.isRemoved || normalizeListingStatus(item.status) === status) return;
                  mutation.mutate({ item, status });
                }}
              >
                {colItems.length ? (
                  colItems.map((item) => (
                    <KanbanCard
                      key={String(item.id)}
                      item={item}
                      profile={profile}
                      statuses={statuses}
                      onOpenLightbox={onOpenLightbox}
                    />
                  ))
                ) : (
                  <Center py="md">
                    <Text c="dimmed">-</Text>
                  </Center>
                )}
              </Stack>
            </Card>
          );
        })}
      </Group>
    </ScrollArea>
  );
}
