// Shared atoms used across all variations.
// All variations share the same data, type, and icon set — they diverge in layout, density, and chrome.

const fmtCHF = (n) => new Intl.NumberFormat("fr-CH").format(Math.round(n));

// A reusable "Atlas map" — purely SVG, no Leaflet, but reads like a real Apple-Maps-ish tile.
// We set it up so any variation can drop it into a container at any size.
function AtlasMap({ pins = [], selectedId = null, onSelect, mode = "warm", showWorkplace = true, dense = false }) {
  // Project lat/lon to the SVG viewBox. Vevey/Lavaux area, hand-tuned.
  const project = (lat, lon) => {
    const minLat = 46.41, maxLat = 46.53;
    const minLon = 6.65,  maxLon = 6.93;
    const x = ((lon - minLon) / (maxLon - minLon)) * 100;
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
    return [x, y];
  };
  // Lake Geneva polygon (rough but evocative)
  const lakePath = "M -5,68 Q 8,55 22,58 Q 38,52 56,55 Q 72,58 88,52 Q 100,48 110,52 L 110,110 L -5,110 Z";
  // A few "roads" — gentle curves, nothing literal
  const roads = [
    "M -5,40 Q 30,38 55,46 Q 78,52 110,48",
    "M -5,22 Q 25,18 50,28 Q 75,38 110,30",
    "M 18,-5 Q 22,30 30,55 Q 38,80 42,110",
    "M 70,-5 Q 68,30 65,55 Q 62,80 60,110",
  ];
  const fills = mode === "warm"
    ? { land: "#f0e8db", lake: "#cfd9d6", road: "#fff8ee", roadAlt: "#ebe0d0", green: "#d8dfc4" }
    : { land: "#eef0e8", lake: "#cdd5d4", road: "#fffdfa", roadAlt: "#e6ddd0", green: "#d3dcc4" };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: fills.land }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
        {/* Green areas */}
        <path d="M -5,-5 Q 20,5 35,15 Q 50,5 70,8 Q 90,12 110,5 L 110,-5 Z" fill={fills.green} opacity={0.55}/>
        <ellipse cx="80" cy="20" rx="22" ry="10" fill={fills.green} opacity={0.4}/>
        <ellipse cx="15" cy="80" rx="20" ry="8" fill={fills.green} opacity={0.35}/>
        {/* Road network */}
        {roads.map((d, i) => (
          <g key={i}>
            <path d={d} stroke={fills.roadAlt} strokeWidth="1.2" fill="none"/>
            <path d={d} stroke={fills.road} strokeWidth="0.6" fill="none"/>
          </g>
        ))}
        {/* Smaller streets */}
        {Array.from({ length: 14 }).map((_, i) => (
          <line
            key={i}
            x1={(i * 7) % 100} y1={(i * 11) % 90}
            x2={((i * 7) % 100) + 8} y2={((i * 11) % 90) + 4}
            stroke={fills.road} strokeWidth="0.25"
          />
        ))}
        {/* Lake */}
        <path d={lakePath} fill={fills.lake}/>
        <path d={lakePath} fill="none" stroke="#b6c1be" strokeWidth="0.15" opacity={0.7}/>
      </svg>

      {/* Workplace pin */}
      {showWorkplace ? (() => {
        const [x, y] = project(46.520, 6.567); // EPFL approx
        return (
          <div style={{
            position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-100%)",
            display: "flex", alignItems: "center", gap: 6, pointerEvents: "none"
          }}>
            <div style={{ background: "#16140f", color: "#fff", padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500, letterSpacing: "-0.005em", boxShadow: "0 6px 16px rgba(0,0,0,.18)" }}>
              Travail · EPFL
            </div>
          </div>
        );
      })() : null}

      {/* Listing pins */}
      {pins.map((p) => {
        const [x, y] = project(p.lat, p.lon);
        const sel = selectedId === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect?.(p.id)}
            style={{
              position: "absolute",
              left: `${x}%`, top: `${y}%`,
              transform: `translate(-50%,-50%) ${sel ? "scale(1.06)" : "scale(1)"}`,
              padding: dense ? "3px 8px" : "5px 10px",
              borderRadius: 999,
              background: sel ? "#16140f" : "#fff",
              color: sel ? "#fff" : "#16140f",
              fontFamily: "var(--mono)",
              fontSize: dense ? 11 : 12,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              boxShadow: sel
                ? "0 8px 24px rgba(22,20,15,.28), 0 0 0 2px #fff"
                : "0 4px 14px rgba(22,20,15,.16), 0 0 0 1px rgba(22,20,15,.06)",
              transition: "transform 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {fmtCHF(p.totalChf)}
          </button>
        );
      })}
    </div>
  );
}

// A small Source label — mapped to a single-glyph monogram so we drop the chip-soup feel.
const SOURCE_GLYPH = {
  "immobilier.ch":         "Im",
  "flatfox.ch":            "Ff",
  "naef.ch":               "Na",
  "bernard-nicod":         "Bn",
  "Retraites Populaires":  "Rp",
  "anibis.ch":             "An",
};
const SourceMono = ({ source, size = 22, dim = false }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: size, height: size, borderRadius: 6,
    background: dim ? "transparent" : "var(--atlas-soft)",
    color: "var(--atlas-ink-2)",
    fontFamily: "var(--mono)", fontSize: size <= 22 ? 10 : 11, fontWeight: 500,
    border: dim ? "1px solid var(--atlas-line)" : "none",
    letterSpacing: 0,
  }}>{SOURCE_GLYPH[source] || "··"}</span>
);

// Status pill — neutral by default, single colored variant for "À trier" / urgent only.
const StatusPill = ({ status, tone = "auto" }) => {
  const t = tone === "auto" ? (
    status === "À trier" ? "ember" :
    status === "Visite prévue" ? "good" :
    status === "Dossier à envoyer" || status === "Dossier envoyé" ? "info" :
    status === "Refus régie" || status === "Écartée" ? "bad" :
    "neutral"
  ) : tone;
  const palette = {
    neutral: { bg: "var(--atlas-soft)", fg: "var(--atlas-ink-2)" },
    ember:   { bg: "var(--atlas-ember-2)", fg: "var(--atlas-ember)" },
    good:    { bg: "oklch(96% 0.04 155)", fg: "var(--atlas-good)" },
    info:    { bg: "oklch(96% 0.02 230)", fg: "var(--atlas-info)" },
    bad:     { bg: "oklch(96% 0.03 25)",  fg: "var(--atlas-bad)" },
  }[t];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 999,
      background: palette.bg, color: palette.fg,
      fontSize: 11.5, fontWeight: 500, letterSpacing: "-0.005em",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: palette.fg, opacity: t === "neutral" ? 0.4 : 1 }} />
      {status}
    </span>
  );
};

// Hairline divider — never a 1px gray line. This is the warm tone.
const Hairline = ({ vertical = false, style }) => (
  <div style={{
    background: "var(--atlas-line)",
    [vertical ? "width" : "height"]: 1,
    [vertical ? "height" : "width"]: "100%",
    ...style,
  }} />
);

// Pure photo carousel: no zoom/lift on hover (per pet peeve), just nav arrows on hover.
function PhotoFrame({ images = [], aspect = "4/3", radius = 10, onOpen, count = true, kenBurns = false }) {
  const [idx, setIdx] = React.useState(0);
  const [hover, setHover] = React.useState(false);
  const cur = images[idx] || images[0];
  const go = (delta) => (e) => { e.stopPropagation(); setIdx((idx + delta + images.length) % images.length); };
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => { e.stopPropagation(); onOpen?.(images, idx); }}
      style={{
        position: "relative",
        aspectRatio: aspect,
        background: "var(--atlas-soft)",
        borderRadius: radius,
        overflow: "hidden",
        cursor: onOpen ? "zoom-in" : "default",
      }}
    >
      <img
        src={cur}
        alt=""
        loading="lazy"
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          transform: kenBurns ? "scale(1.03)" : "none",
          transition: "opacity 200ms ease",
        }}
      />
      {hover && images.length > 1 ? (
        <>
          <button onClick={go(-1)} style={navBtn("left")}><Icons.Chevron stroke={1.8} style={{ transform: "rotate(180deg)" }} /></button>
          <button onClick={go(1)} style={navBtn("right")}><Icons.Chevron stroke={1.8} /></button>
        </>
      ) : null}
      {images.length > 1 ? (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 8,
          display: "flex", justifyContent: "center", gap: 4, pointerEvents: "none",
        }}>
          {images.map((_, i) => (
            <span key={i} style={{
              width: i === idx ? 14 : 4, height: 4, borderRadius: 2,
              background: i === idx ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.55)",
              transition: "width 160ms ease",
            }}/>
          ))}
        </div>
      ) : null}
      {count && images.length > 1 ? (
        <div style={{
          position: "absolute", top: 8, right: 8,
          padding: "3px 8px", borderRadius: 999,
          background: "rgba(22,20,15,.55)",
          backdropFilter: "blur(6px)",
          color: "#fff", fontSize: 11, fontFamily: "var(--mono)",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <Icons.Photo size={11} stroke={1.8}/>{idx+1}/{images.length}
        </div>
      ) : null}
    </div>
  );
}
const navBtn = (side) => ({
  position: "absolute", top: "50%", [side]: 8,
  transform: "translateY(-50%)",
  width: 28, height: 28, borderRadius: 999,
  background: "rgba(255,255,255,.92)",
  color: "#16140f",
  display: "grid", placeItems: "center",
  boxShadow: "0 4px 12px rgba(0,0,0,.16)",
  cursor: "pointer",
});

Object.assign(window, { fmtCHF, AtlasMap, SourceMono, StatusPill, Hairline, PhotoFrame });
