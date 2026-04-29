export type AppRoute =
  | { name: 'dashboard' }
  | { name: 'not-found'; pathname: string };

export function dashboardPath() {
  return '/';
}

export function getRoute(pathname = window.location.pathname): AppRoute {
  if (pathname === '/' || pathname === '') {
    return { name: 'dashboard' };
  }

  return { name: 'not-found', pathname };
}

export function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
