import { Box } from '@mantine/core';
import { ReactNode } from 'react';

export function AppLayout({
  children,
  profileLabel
}: {
  children: ReactNode;
  profileLabel?: string;
}) {
  return <Box mih="100vh">{children}</Box>;
}
