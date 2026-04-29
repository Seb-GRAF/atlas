import { Anchor, Box, Center, Group, Paper, Stack, Table, Text } from '@mantine/core';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { Listing } from '../../api/schemas';
import { money, shortWhen } from '../../utils/format';
import {
  getUrgency,
  listingSourceLabel,
  listingTitle,
  publishedLabel,
  publishedMeta
} from '../../utils/listings';
import { ImageThumbs } from './ImageThumbs';
import { DeleteRemovedButton, NotesSave, PinButton, StatusSelect } from './ListingControls';
import { ListingBadges, UrgencyBadge } from './ListingBadges';
import { getRowProps } from './rowStyle';

export function ListingTable({
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
  const columns = useMemo<ColumnDef<Listing>[]>(
    () => [
      {
        header: 'Image',
        cell: ({ row }) => <ImageThumbs item={row.original} onOpen={onOpenLightbox} />
      },
      {
        header: 'Bien',
        cell: ({ row }) => {
          const item = row.original;
          const source = listingSourceLabel(item);
          return (
            <Box maw={360}>
              <Anchor href={item.url || '#'} target="_blank" rel="noreferrer" fw={750}>
                {listingTitle(item)}
              </Anchor>
              <Text size="xs" c="dimmed">
                {item.address || ''}
                {source ? ` · source: ${source}` : ''}
              </Text>
              <ListingBadges item={item} />
            </Box>
          );
        }
      },
      {
        header: 'Loyer total',
        cell: ({ row }) => (
          <Box>
            <Text fw={700}>{money(row.original.totalChf)}</Text>
            <Text size="xs" c="dimmed">
              {row.original.priceRaw || ''}
            </Text>
          </Box>
        )
      },
      {
        header: 'Publié',
        cell: ({ row }) => {
          const meta = publishedMeta(row.original);
          const title =
            meta.days == null
              ? 'Date de parution indisponible'
              : meta.approximate
                ? `Date de parution indisponible - découverte le ${shortWhen(meta.iso)}`
                : `Publié le ${shortWhen(meta.iso)}`;
          return <span title={title}>{publishedLabel(row.original)}</span>;
        }
      },
      {
        header: 'Statut',
        cell: ({ row }) => <StatusSelect profile={profile} item={row.original} statuses={statuses} />
      },
      {
        header: 'Notes',
        cell: ({ row }) => <NotesSave profile={profile} item={row.original} />
      },
      {
        header: 'Action',
        cell: ({ row }) => {
          const item = row.original;
          return item.isRemoved ? (
            <DeleteRemovedButton profile={profile} item={item} />
          ) : (
            <Group gap={4}>
              <PinButton profile={profile} item={item} />
              <UrgencyBadge {...getUrgency(item)} />
            </Group>
          );
        }
      }
    ],
    [onOpenLightbox, profile, statuses]
  );

  const table = useReactTable({ data: listings, columns, getCoreRowModel: getCoreRowModel() });

  if (!listings.length) {
    return (
      <Paper p="xl">
        <Center>
          <Stack gap={4} align="center">
            <Text c="dimmed">Aucune annonce ne correspond à la recherche.</Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Table.ScrollContainer minWidth={1080} visibleFrom="md">
      <Table>
        <Table.Thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Table.Th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {table.getRowModel().rows.map((row) => {
            const item = row.original;
            return (
              <Table.Tr key={row.id} {...getRowProps(item)}>
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Td>
                ))}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
