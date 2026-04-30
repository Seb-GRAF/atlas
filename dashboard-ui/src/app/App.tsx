import { AtlasShell } from '../atlas/screens/AtlasShell';
import { LightboxProvider } from '../atlas/components';

export function App() {
  return (
    <LightboxProvider>
      <AtlasShell />
    </LightboxProvider>
  );
}
