import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Drawer } from 'vaul';

type SnapPoint = string | number;

type MobileBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  snapPoints?: SnapPoint[];
  initialSnapIndex?: number;
  children: ReactNode;
  contentRef?: (el: HTMLDivElement | null) => void;
  onPointerDownOutside?: (event: Event) => void;
  onInteractOutside?: (event: Event) => void;
};

const SCRIM_TRANSITION = '220ms cubic-bezier(0.32, 0.72, 0, 1)';

const overlayBaseStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(22,20,15,.42)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  zIndex: 50,
  pointerEvents: 'none',
  opacity: 0,
  transition: `opacity ${SCRIM_TRANSITION}`
};

const contentStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 51,
  height: 'calc(100% - 12px - env(safe-area-inset-top, 0px))',
  width: '100%',
  maxWidth: '100vw',
  background: 'var(--atlas-paper)',
  borderRadius: '24px 24px 0 0',
  boxShadow: '0 -22px 50px -22px rgba(22,20,15,.32)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  outline: 'none'
};

const titleHiddenStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0
};

// Tint the iOS status bar to match the dimmed backdrop while a sheet is open.
const STATUS_BAR_OPEN = '#3b352c';
const STATUS_BAR_META_ID = 'atlas-theme-color';

function useStatusBarTint(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let meta = document.getElementById(STATUS_BAR_META_ID) as HTMLMetaElement | null;
    let created = false;
    const previous = meta?.content ?? null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.id = STATUS_BAR_META_ID;
      meta.name = 'theme-color';
      document.head.appendChild(meta);
      created = true;
    }
    meta.content = STATUS_BAR_OPEN;
    return () => {
      if (!meta) return;
      if (created) meta.remove();
      else if (previous != null) meta.content = previous;
    };
  }, [active]);
}

// Disable iOS pull-to-refresh / bounce on the page while a sheet is open.
function useLockPageOverscroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overscrollBehaviorY;
    const prevBody = body.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';
    return () => {
      html.style.overscrollBehaviorY = prevHtml;
      body.style.overscrollBehaviorY = prevBody;
    };
  }, [active]);
}

export const DEFAULT_SNAP_POINTS: SnapPoint[] = [0.66, 1];

export function MobileBottomSheet({
  open,
  onClose,
  title,
  snapPoints = DEFAULT_SNAP_POINTS,
  initialSnapIndex = 0,
  children,
  onPointerDownOutside,
  onInteractOutside
}: MobileBottomSheetProps) {
  const [activeSnap, setActiveSnap] = useState<SnapPoint | null>(snapPoints[initialSnapIndex]);

  useEffect(() => {
    if (open) setActiveSnap(snapPoints[initialSnapIndex]);
  }, [open, initialSnapIndex, snapPoints]);

  useStatusBarTint(open);
  useLockPageOverscroll(open);

  const [scrimMounted, setScrimMounted] = useState(false);
  const [scrimVisible, setScrimVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setScrimMounted(true);
      const id = requestAnimationFrame(() => setScrimVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setScrimVisible(false);
    const t = setTimeout(() => setScrimMounted(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnap}
      setActiveSnapPoint={setActiveSnap}
      snapToSequentialPoint
    >
      <Drawer.Portal>
        {scrimMounted ? (
          <div
            aria-hidden
            onClick={onClose}
            style={{
              ...overlayBaseStyle,
              pointerEvents: scrimVisible ? 'auto' : 'none',
              opacity: scrimVisible ? 1 : 0
            }}
          />
        ) : null}
        <Drawer.Content
          style={contentStyle}
          aria-describedby={undefined}
          onPointerDownOutside={onPointerDownOutside}
          onInteractOutside={onInteractOutside}
        >
          <Drawer.Title style={titleHiddenStyle}>{title}</Drawer.Title>

          <div
            style={{
              flexShrink: 0,
              padding: '8px 0 4px',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <Drawer.Handle
              style={{
                width: 36,
                height: 4,
                borderRadius: 4,
                background: 'rgba(22,20,15,.22)',
                opacity: 1
              }}
            />
          </div>

          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
