import { Badge, Group } from '@mantine/core';
import { Listing } from '../../api/schemas';
import { isNewToday } from '../../utils/listings';
import { StateBadges } from '../status/StatusBadge';

export function ListingBadges({ item }: { item: Listing }) {
  const hasStage = item.listingStage === 'off_market' || item.listingStage === 'early_market';
  if (!isNewToday(item) && !hasStage && !item.isRemoved) return null;
  return (
    <Group gap={4} mt={5}>
      <StateBadges isNew={isNewToday(item)} stage={item.listingStage} removed={item.isRemoved} />
    </Group>
  );
}

export function UrgencyBadge({ level, label }: { level: 'low' | 'medium' | 'high' | 'done'; label: string }) {
  const color = level === 'high' ? 'swiss' : level === 'medium' ? 'amber' : level === 'done' ? 'slate' : 'alpine';
  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
}
