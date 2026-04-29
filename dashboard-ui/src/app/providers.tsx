import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { apartmentOpsTheme } from './theme';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1
          },
          mutations: {
            retry: 0
          }
        }
      })
  );

  return (
    <MantineProvider theme={apartmentOpsTheme} defaultColorScheme="light" forceColorScheme="light">
      <QueryClientProvider client={queryClient}>
        <Notifications position="top-right" />
        {children}
      </QueryClientProvider>
    </MantineProvider>
  );
}
