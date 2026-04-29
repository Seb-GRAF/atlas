import { useEffect, useMemo, useRef } from 'react';
import lightGallery from 'lightgallery';
import type { LightGallery as LightGalleryInstance } from 'lightgallery/lightgallery';
import type { GalleryItem } from 'lightgallery/lg-utils';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-thumbnail.css';
import 'lightgallery/css/lg-zoom.css';

export type LightboxState = { urls: string[]; index: number } | null;

const STRINGS = {
  closeGallery: 'Fermer',
  toggleMaximize: 'Agrandir',
  previousSlide: 'Précédent',
  nextSlide: 'Suivant',
  download: 'Télécharger',
  playVideo: 'Lire la vidéo',
  mediaLoadingFailed: 'Impossible de charger ce média.'
};

export function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<LightGalleryInstance | null>(null);
  const suppressCloseRef = useRef(false);
  const onCloseRef = useRef(onClose);

  const dynamicEl = useMemo<GalleryItem[]>(
    () =>
      (state?.urls || []).map((url, index) => ({
        src: url,
        thumb: url,
        alt: `Photo annonce ${index + 1}`,
        downloadUrl: false
      })),
    [state?.urls]
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!state || !dynamicEl.length) return;
    const { body, documentElement: html } = document;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
      htmlOverflow: html.style.overflow
    };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.paddingRight = previous.bodyPaddingRight;
      html.style.overflow = previous.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [state, dynamicEl]);

  useEffect(() => {
    const host = hostRef.current;
    if (!state || !dynamicEl.length || !host) return;

    suppressCloseRef.current = false;
    const instance = lightGallery(host, {
      dynamic: true,
      dynamicEl,
      index: state.index,
      plugins: [lgZoom, lgThumbnail],
      licenseKey: '0000-0000-000-0000',
      speed: 360,
      download: false,
      hideBarsDelay: 0,
      mobileSettings: { controls: true, showCloseIcon: true, download: false },
      strings: STRINGS
    });

    instanceRef.current = instance;
    const handleClose = () => {
      if (!suppressCloseRef.current) onCloseRef.current();
    };

    host.addEventListener('lgAfterClose', handleClose);
    instance.openGallery(state.index);

    return () => {
      host.removeEventListener('lgAfterClose', handleClose);
      suppressCloseRef.current = true;
      instanceRef.current = null;
      instance.destroy();
    };
  }, [dynamicEl, state]);

  return <div ref={hostRef} hidden />;
}
