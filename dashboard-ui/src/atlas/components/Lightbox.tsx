import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode
} from 'react';
import lightGallery from 'lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import type { LightGallery } from 'lightgallery/lightgallery';
// Lightgallery base CSS is imported in main.tsx before global.css so that
// our Atlas overrides win on equal specificity.

type OpenFn = (images: string[], index?: number) => void;

const LightboxContext = createContext<OpenFn | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<LightGallery | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const inst = lightGallery(hostRef.current, {
      dynamic: true,
      dynamicEl: [{ src: '', thumb: '' }],
      plugins: [lgZoom, lgThumbnail],
      download: false,
      counter: true,
      hideScrollbar: true,
      closable: true,
      swipeToClose: true,
      closeOnTap: true,
      escKey: true,
      mobileSettings: {
        controls: true,
        showCloseIcon: true,
        download: false
      },
      licenseKey: '0000-0000-000-0000'
    });
    instanceRef.current = inst;

    // While the gallery is open, lock body scroll. Outside-click protection
    // for the vaul drawer behind is handled by an onPointerDownOutside /
    // onInteractOutside guard on Drawer.Content itself — see
    // MobileDetailSheet.tsx.
    const onOpen = () => {
      document.body.classList.add('atlas-lightbox-open');
    };
    const onClose = () => {
      document.body.classList.remove('atlas-lightbox-open');
    };
    const el = hostRef.current;
    el.addEventListener('lgBeforeOpen', onOpen);
    el.addEventListener('lgAfterClose', onClose);

    return () => {
      el.removeEventListener('lgBeforeOpen', onOpen);
      el.removeEventListener('lgAfterClose', onClose);
      onClose();
      inst.destroy();
      instanceRef.current = null;
    };
  }, []);

  const open = useCallback<OpenFn>((images, index = 0) => {
    const inst = instanceRef.current;
    if (!inst || images.length === 0) return;
    const items = images.map((src) => ({ src, thumb: src }));
    // Dynamic re-open: refresh items, then open at index.
    // lightgallery exposes refresh(items) for this.
    (inst as unknown as { refresh: (items: unknown[]) => void }).refresh(items);
    inst.openGallery(Math.max(0, Math.min(index, images.length - 1)));
  }, []);

  return (
    <LightboxContext.Provider value={open}>
      {children}
      <div ref={hostRef} aria-hidden style={{ display: 'none' }} />
    </LightboxContext.Provider>
  );
}

export function useLightbox(): OpenFn {
  const ctx = useContext(LightboxContext);
  if (!ctx) {
    // Fail loud — surfaces missing provider rather than silently no-op.
    throw new Error('useLightbox must be used within <LightboxProvider>');
  }
  return ctx;
}
