import { Listing } from '../../api/schemas';
import { isNewToday, isRefused } from '../../utils/listings';

type StateProps = {
  opacity?: number;
  bg?: string;
  bd?: string;
};

export function getRowProps(item: Listing): StateProps {
  if (item.isRemoved) {
    return {
      opacity: 0.72,
      bg: 'slate.1'
    };
  }
  if (isRefused(item)) {
    return {
      opacity: 0.78,
      bg: 'swiss.0'
    };
  }
  if (item.pinned) {
    return {
      bg: 'lake.0'
    };
  }
  if (isNewToday(item)) {
    return {
      bg: 'alpine.0'
    };
  }
  return {};
}

export function getCardProps(item: Listing): StateProps {
  if (item.isRemoved) {
    return {
      opacity: 0.72,
      bg: 'slate.1',
      bd: '1px solid var(--mantine-color-slate-2)'
    };
  }
  if (isRefused(item)) {
    return {
      opacity: 0.82,
      bg: 'swiss.0',
      bd: '1px solid var(--mantine-color-swiss-1)'
    };
  }
  if (item.pinned) {
    return {
      bg: 'lake.0',
      bd: '1px solid var(--mantine-color-lake-4)'
    };
  }
  return {};
}
