import { ActionIcon, Button, Group, Select, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPinned, IconPinnedOff, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteListing, toggleListingPin, updateListingStatus } from '../../api/listings';
import { Listing } from '../../api/schemas';
import { DEFAULT_STATUSES, normalizeListingStatus } from '../../utils/listings';

export function StatusSelect({
  profile,
  item,
  statuses
}: {
  profile: string;
  item: Listing;
  statuses: string[];
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (status: string) => updateListingStatus(profile, item.id, status, item.notes || ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['state'] }),
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur statut', message: (err as Error).message })
  });

  const options = [...new Set((statuses.length ? statuses : DEFAULT_STATUSES).map(normalizeListingStatus))].map((status) => ({
    value: status,
    label: status
  }));
  return (
    <Select
      data={options}
      value={normalizeListingStatus(item.status)}
      disabled={item.isRemoved || mutation.isPending}
      onChange={(status) => status && mutation.mutate(status)}
      aria-label="Statut"
    />
  );
}

export function PinButton({ profile, item }: { profile: string; item: Listing }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => toggleListingPin(profile, item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['state'] }),
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur épingle', message: (err as Error).message })
  });

  const label = item.pinned ? 'Désépingler' : 'Épingler en haut';
  return (
    <Tooltip label={label}>
      <ActionIcon
        color={item.pinned ? 'lake' : 'slate'}
        variant={item.pinned ? 'light' : 'subtle'}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        aria-label={label}
      >
        {item.pinned ? <IconPinnedOff size={16} /> : <IconPinned size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function NotesSave({ profile, item }: { profile: string; item: Listing }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(item.notes || '');
  const mutation = useMutation({
    mutationFn: () => updateListingStatus(profile, item.id, normalizeListingStatus(item.status), notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['state'] }),
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur notes', message: (err as Error).message })
  });

  return (
    <Group gap={6} wrap="nowrap">
      <TextInput
        value={notes}
        onChange={(event) => setNotes(event.currentTarget.value)}
        placeholder="notes"
        disabled={item.isRemoved}
        w={190}
      />
      <Button variant="light" loading={mutation.isPending} disabled={item.isRemoved} onClick={() => mutation.mutate()}>
        Sauver
      </Button>
    </Group>
  );
}

export function DeleteRemovedButton({ profile, item }: { profile: string; item: Listing }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => deleteListing(profile, item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['state'] }),
    onError: (err) => notifications.show({ color: 'swiss', title: 'Erreur suppression', message: (err as Error).message })
  });

  return (
    <Button
      color="swiss"
      variant="light"
      leftSection={<IconTrash size={15} />}
      loading={mutation.isPending}
      onClick={() => {
        if (window.confirm('Supprimer cette annonce retirée du suivi ?')) mutation.mutate();
      }}
    >
      Supprimer
    </Button>
  );
}
