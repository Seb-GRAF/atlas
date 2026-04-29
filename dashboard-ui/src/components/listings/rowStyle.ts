import { CSSProperties } from 'react';
import { Listing } from '../../api/schemas';
import { isNewToday, isRefused } from '../../utils/listings';

const transition = 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease';

export function getRowStyle(item: Listing): CSSProperties {
  if (item.isRemoved) {
    return {
      opacity: 0.72,
      backgroundColor: 'var(--mantine-color-slate-1)',
      transition
    };
  }
  if (isRefused(item)) {
    return {
      opacity: 0.78,
      backgroundColor: 'var(--mantine-color-swiss-0)',
      transition
    };
  }
  if (item.pinned) {
    return {
      boxShadow: 'inset 3px 0 0 var(--mantine-color-lake-7)',
      transition
    };
  }
  if (isNewToday(item)) {
    return {
      boxShadow: 'inset 3px 0 0 var(--mantine-color-alpine-6)',
      transition
    };
  }
  return { transition };
}

export function getCardStyle(item: Listing): CSSProperties {
  if (item.isRemoved) {
    return {
      opacity: 0.72,
      backgroundColor: 'var(--mantine-color-slate-1)',
      borderColor: 'var(--mantine-color-slate-2)',
      transition
    };
  }
  if (isRefused(item)) {
    return {
      opacity: 0.82,
      backgroundColor: 'var(--mantine-color-swiss-0)',
      borderColor: 'var(--mantine-color-swiss-1)',
      transition
    };
  }
  if (item.pinned) {
    return {
      borderColor: 'var(--mantine-color-lake-4)',
      backgroundColor: 'var(--mantine-color-lake-0)',
      transition
    };
  }
  return { transition };
}
