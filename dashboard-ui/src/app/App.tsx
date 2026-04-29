import { Alert, Button, Stack, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardPage } from '../components/listings/DashboardPage';
import { dashboardPath, getRoute, navigate } from './routes';

export function App() {
  const [route, setRoute] = useState(() => getRoute());

  useEffect(() => {
    const onPopState = () => setRoute(getRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (route.name === 'dashboard') {
    return (
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Stack>
        <Alert color="swiss" title="Page introuvable">
          Aucun écran ne correspond à {route.pathname}.
        </Alert>
        <Button leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(dashboardPath())}>
          Retour au dashboard
        </Button>
      </Stack>
    </AppLayout>
  );
}
