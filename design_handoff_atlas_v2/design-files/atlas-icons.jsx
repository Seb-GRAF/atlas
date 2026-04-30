// Custom thin-stroke icon set, calibrated for Atlas. 1.5px strokes feel premium;
// Tabler's defaults are 2px and that contributes to the AI-generated look.
const Icon = ({ children, size = 16, stroke = 1.5, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

const Icons = {
  Search:    (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>,
  Map:       (p) => <Icon {...p}><path d="M9 4 3 6.5v14L9 18l6 2.5L21 18V4l-6 2.5L9 4Z"/><path d="M9 4v14"/><path d="M15 6.5v14"/></Icon>,
  List:      (p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h10"/></Icon>,
  Grid:      (p) => <Icon {...p}><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></Icon>,
  Pin:       (p) => <Icon {...p}><path d="M12 17v5"/><path d="M9 3h6l-1 5 3 4H7l3-4-1-5Z"/></Icon>,
  Settings:  (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></Icon>,
  Refresh:   (p) => <Icon {...p}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></Icon>,
  External:  (p) => <Icon {...p}><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></Icon>,
  Close:     (p) => <Icon {...p}><path d="m6 6 12 12M18 6 6 18"/></Icon>,
  Plus:      (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Heart:     (p) => <Icon {...p}><path d="M12 21s-7-4.5-9.5-9.4A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5.6C19 16.5 12 21 12 21Z"/></Icon>,
  X:         (p) => <Icon {...p}><path d="m6 6 12 12M18 6 6 18"/></Icon>,
  Check:     (p) => <Icon {...p}><path d="m4 12 5 5L20 6"/></Icon>,
  Star:      (p) => <Icon {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6-5.4-2.9-5.5 2.9 1.1-6L3.2 9.5l6.1-.9L12 3Z"/></Icon>,
  Bed:       (p) => <Icon {...p}><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="M3 14h18"/><path d="M7 11V8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3"/></Icon>,
  Square:    (p) => <Icon {...p}><rect x="4" y="4" width="16" height="16" rx="2"/></Icon>,
  Train:     (p) => <Icon {...p}><rect x="5" y="3" width="14" height="14" rx="2"/><path d="M5 11h14"/><circle cx="9" cy="14.5" r=".5" fill="currentColor"/><circle cx="15" cy="14.5" r=".5" fill="currentColor"/><path d="m7 21 2-3M17 21l-2-3"/></Icon>,
  Calendar:  (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>,
  Filter:    (p) => <Icon {...p}><path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z"/></Icon>,
  Chevron:   (p) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>,
  ChevronDown: (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>,
  Sparkle:   (p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></Icon>,
  More:      (p) => <Icon {...p}><circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/></Icon>,
  Layers:    (p) => <Icon {...p}><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/></Icon>,
  Compass:   (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m9 15 1.5-4.5L15 9l-1.5 4.5L9 15Z"/></Icon>,
  Walk:      (p) => <Icon {...p}><circle cx="13" cy="4" r="1.5"/><path d="M9 21l2-6-3-3 1-4 4 1 2 3"/><path d="m13 13 3 1 2 4"/></Icon>,
  Drive:     (p) => <Icon {...p}><path d="M5 12h14l-1.5-5a2 2 0 0 0-2-1.5h-7A2 2 0 0 0 6.5 7L5 12Z"/><path d="M5 12v5a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2M19 12v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2"/><circle cx="8" cy="15" r=".8" fill="currentColor"/><circle cx="16" cy="15" r=".8" fill="currentColor"/></Icon>,
  Bolt:      (p) => <Icon {...p}><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/></Icon>,
  Mail:      (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Icon>,
  Photo:     (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m3 17 5-4 4 3 3-2 6 5"/></Icon>,
};

Object.assign(window, { Icon, Icons });
