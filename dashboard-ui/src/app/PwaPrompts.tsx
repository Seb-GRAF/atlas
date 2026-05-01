import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALL_DISMISS_KEY = 'atlas:pwa-install-dismissed';

export function PwaPrompts() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('[pwa] SW register failed', error);
    }
  });

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installVisible, setInstallVisible] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (localStorage.getItem(INSTALL_DISMISS_KEY)) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      setInstallVisible(true);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setInstallVisible(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setInstallVisible(false);
  };

  const handleDismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    setInstallVisible(false);
  };

  return (
    <>
      {needRefresh && (
        <div className="pwa-toast" role="status" aria-live="polite">
          <span>Nouvelle version disponible.</span>
          <button type="button" onClick={() => updateServiceWorker(true)}>
            Recharger
          </button>
          <button type="button" className="pwa-toast__dismiss" onClick={() => setNeedRefresh(false)} aria-label="Ignorer">
            ×
          </button>
        </div>
      )}
      {installVisible && installEvent && (
        <div className="pwa-toast pwa-toast--install" role="dialog" aria-label="Installer l'application">
          <span>Installer Atlas sur l'écran d'accueil ?</span>
          <button type="button" onClick={handleInstall}>
            Installer
          </button>
          <button type="button" className="pwa-toast__dismiss" onClick={handleDismissInstall} aria-label="Plus tard">
            ×
          </button>
        </div>
      )}
    </>
  );
}
