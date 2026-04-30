// V2 — Refined: polished desktop main + states + mobile.
// Same design DNA as the original V2 (map-hero, glass panels, single ember accent),
// pushed to a more high-end Airbnb/Apple-Maps register.

const V2_LISTINGS = window.ATLAS_LISTINGS;
const V2_PROFILE = window.ATLAS_PROFILE;
const V2_STAGES = window.ATLAS_STAGES;

// =================================================================
// SHARED V2 PRIMITIVES
// =================================================================

const v2Glass = {
  base: {
    background: "rgba(253,251,247,.86)",
    backdropFilter: "blur(24px) saturate(170%)",
    WebkitBackdropFilter: "blur(24px) saturate(170%)",
  },
  panel: {
    background: "rgba(253,251,247,.94)",
    backdropFilter: "blur(28px) saturate(170%)",
    WebkitBackdropFilter: "blur(28px) saturate(170%)",
    boxShadow: "0 22px 50px -22px rgba(22,20,15,.30), 0 0 0 1px rgba(22,20,15,.04)",
  },
  pill: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "8px 12px", borderRadius: 999,
    background: "rgba(253,251,247,.88)",
    backdropFilter: "blur(16px) saturate(160%)",
    WebkitBackdropFilter: "blur(16px) saturate(160%)",
    boxShadow: "0 8px 22px -10px rgba(22,20,15,.18), 0 0 0 1px rgba(22,20,15,.04)",
    fontSize: 13, color: "var(--atlas-ink)",
  },
};

function V2TopBar({ stage, onStage, onScan, scanning, mobile }) {
  if (mobile) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px",
        ...v2Glass.base,
        boxShadow: "0 1px 0 rgba(22,20,15,.06)",
      }}>
        <button style={{ ...v2Glass.pill, padding: "8px 10px" }}>
          <Icons.Search size={15} stroke={1.7}/>
        </button>
        <button style={{ ...v2Glass.pill, flex: 1, padding: "8px 12px", justifyContent: "flex-start" }}>
          <span style={{ color: "var(--atlas-ink-3)" }}>Vevey, Lutry…</span>
        </button>
        <button style={{ ...v2Glass.pill, padding: "8px 10px" }}>
          <Icons.Filter size={15} stroke={1.7}/>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--atlas-ember)" }}/>
        </button>
      </div>
    );
  }
  return (
    <div style={{
      position: "absolute", top: 16, left: 16, right: 16, zIndex: 5,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={v2Glass.pill}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: "#16140f", display: "grid", placeItems: "center", color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)" }}>A</div>
        <span style={{ fontWeight: 500 }}>Atlas</span>
        <span style={{ width: 1, height: 16, background: "rgba(22,20,15,.1)", margin: "0 2px" }}/>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--atlas-ink-2)" }}>
          {V2_PROFILE.shortTitle} <Icons.ChevronDown size={13} stroke={1.7}/>
        </button>
      </div>

      <div style={{ ...v2Glass.pill, padding: "6px 12px", flex: 1, maxWidth: 380 }}>
        <Icons.Search size={15} stroke={1.6} />
        <span style={{ color: "var(--atlas-ink-3)", flex: 1 }}>Vevey, Lutry, Pully…</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--atlas-ink-3)", padding: "1px 5px", border: "1px solid rgba(22,20,15,.08)", borderRadius: 4 }}>/</span>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ ...v2Glass.pill, padding: 4, gap: 0 }}>
        {V2_STAGES.slice(0, 3).map((s) => (
          <button key={s.value}
            onClick={() => onStage?.(s.value)}
            style={{
              padding: "6px 12px", borderRadius: 999, fontSize: 12.5,
              color: stage === s.value ? "#fff" : "var(--atlas-ink-2)",
              background: stage === s.value ? "#16140f" : "transparent",
              fontWeight: 500,
            }}>
            {s.label} <span className="mono" style={{ fontSize: 10.5, opacity: .6, marginLeft: 4 }}>{s.count}</span>
          </button>
        ))}
      </div>

      <button style={{ ...v2Glass.pill, padding: "8px 10px" }}><Icons.Settings size={15} stroke={1.7}/></button>
      <button onClick={onScan} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: 999,
        background: "#16140f", color: "#fff",
        fontSize: 13, fontWeight: 500,
        boxShadow: "0 10px 24px -8px rgba(22,20,15,.32)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 999,
          background: scanning ? "oklch(78% 0.16 60)" : "oklch(78% 0.12 150)",
          animation: scanning ? "v2pulse 1.2s ease-in-out infinite" : "none",
        }}/>
        {scanning ? "Scan en cours…" : "Scanner"}
      </button>
    </div>
  );
}

function V2ListPanel({ listings, selected, onSelect, scanning, dense, mobile }) {
  return (
    <div style={{
      ...(mobile ? {} : { position: "absolute", left: 16, top: 76, bottom: 16, width: 380 }),
      ...v2Glass.panel,
      borderRadius: mobile ? 0 : 18,
      boxShadow: mobile ? "none" : v2Glass.panel.boxShadow,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      zIndex: 4,
    }}>
      <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--atlas-ink-3)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {V2_PROFILE.zones.slice(0, 3).join(" · ")} +{V2_PROFILE.zones.length - 3}
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4, letterSpacing: "-0.018em" }}>
            {listings.length} appartements
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--atlas-ink-2)" }}>
            Trier · plus récents <Icons.ChevronDown size={11} stroke={1.7}/>
          </button>
          <span style={{ fontSize: 10.5, color: "var(--atlas-ink-3)" }}>maj. {V2_PROFILE.generatedAt}</span>
        </div>
      </div>
      <Hairline />
      {scanning ? (
        <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, color: "var(--atlas-ink-2)", fontSize: 12.5 }}>
          <span style={{ position: "relative", width: 14, height: 14 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: 999, border: "2px solid rgba(22,20,15,.12)" }}/>
            <span style={{ position: "absolute", inset: 0, borderRadius: 999, border: "2px solid transparent", borderTopColor: "var(--atlas-ember)", animation: "v2spin 1s linear infinite" }}/>
          </span>
          <span>Recherche · flatfox.ch</span>
          <span style={{ flex: 1 }}/>
          <span className="mono" style={{ color: "var(--atlas-ink-3)" }}>3/6</span>
        </div>
      ) : null}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 16px" }}>
        {listings.map((it) => (
          <V2Card key={it.id} item={it} selected={selected === it.id} onSelect={() => onSelect?.(it.id)} dense={dense} />
        ))}
      </div>
    </div>
  );
}

function V2Card({ item, selected, onSelect, dense }) {
  return (
    <button onClick={onSelect}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: 8,
        borderRadius: 14,
        background: selected ? "#fff" : "transparent",
        boxShadow: selected ? "0 6px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.06)" : "none",
        transition: "background 140ms ease, box-shadow 140ms ease",
      }}>
      <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 12, alignItems: "stretch" }}>
        <div style={{
          aspectRatio: "1", borderRadius: 10,
          background: `center/cover no-repeat url(${item.images[0]})`,
          position: "relative",
        }}>
          {item.pinned ? (
            <span style={{
              position: "absolute", top: 6, left: 6,
              width: 22, height: 22, borderRadius: 999,
              background: "#16140f", color: "#fff",
              display: "grid", placeItems: "center",
            }}><Icons.Pin size={11} stroke={1.9}/></span>
          ) : null}
        </div>
        <div style={{ minWidth: 0, paddingTop: 2, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--atlas-ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>{item.area}</span>
            {item.isNew ? <span style={{ width: 4, height: 4, borderRadius: 999, background: "var(--atlas-ember)" }}/> : null}
            {item.isNew ? <span style={{ fontSize: 11, color: "var(--atlas-ember)", textTransform: "uppercase", letterSpacing: ".06em" }}>Nouveau</span> : null}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--atlas-ink-3)" }}>
            {item.rooms} pces · {item.surfaceM2} m² · {item.transitText}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span className="mono tnum" style={{ fontSize: 14, fontWeight: 500 }}>{fmtCHF(item.totalChf)}</span>
            <span style={{ fontSize: 11, color: "var(--atlas-ink-3)" }}>CHF</span>
            <span style={{ flex: 1 }}/>
            <span style={{ fontSize: 11, color: "var(--atlas-ink-3)" }}>{item.publishedLabel}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function V2DetailPanel({ item, mobile }) {
  return (
    <div style={{
      ...(mobile ? {} : { position: "absolute", right: 16, top: 76, bottom: 16, width: 400 }),
      ...v2Glass.panel,
      borderRadius: mobile ? 22 : 18,
      display: "flex", flexDirection: "column", overflow: "hidden",
      zIndex: 4,
    }}>
      {mobile ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
          <span style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(22,20,15,.18)" }}/>
        </div>
      ) : null}
      <div style={{ padding: 14, position: "relative" }}>
        <PhotoFrame images={item.images} aspect="4/3" radius={14}/>
        <button style={{
          position: "absolute", top: 22, right: 22,
          width: 34, height: 34, borderRadius: 999,
          background: "rgba(255,255,255,.92)",
          backdropFilter: "blur(8px)",
          display: "grid", placeItems: "center",
          color: "var(--atlas-ink)",
          boxShadow: "0 4px 12px rgba(0,0,0,.16)",
        }}><Icons.Heart size={15} stroke={1.7}/></button>
      </div>
      <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--atlas-ink-3)" }}>{item.area} · {item.source.replace(".ch", "")}</div>
            <div style={{ fontSize: 17.5, fontWeight: 500, letterSpacing: "-0.018em", marginTop: 2, lineHeight: 1.2 }}>{item.title}</div>
            <div style={{ color: "var(--atlas-ink-3)", fontSize: 12.5, marginTop: 4 }}>{item.address.split(",")[0]}</div>
          </div>
          <div className="mono tnum" style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.015em", whiteSpace: "nowrap" }}>
            {fmtCHF(item.totalChf)}<span style={{ fontSize: 11, color: "var(--atlas-ink-3)", marginLeft: 3 }}>CHF</span>
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
          background: "var(--atlas-line)",
          borderRadius: 12, overflow: "hidden",
          boxShadow: "0 0 0 1px var(--atlas-line)",
        }}>
          {[
            ["Pièces", `${item.rooms}`, Icons.Bed],
            ["Surface", `${item.surfaceM2} m²`, Icons.Square],
            ["Trajet", item.driveText, Icons.Drive],
          ].map(([l, v, I], i) => (
            <div key={i} style={{ background: "var(--atlas-paper-2)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--atlas-ink-3)", letterSpacing: ".04em", textTransform: "uppercase" }}>
                <I size={12} stroke={1.7}/> {l}
              </span>
              <span className="mono tnum" style={{ fontSize: 14, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>

        <Hairline />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SourceMono source={item.source} />
          <span style={{ fontSize: 12.5, color: "var(--atlas-ink-2)" }}>{item.source}</span>
          <span style={{ flex: 1 }}/>
          <StatusPill status={item.status} />
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--atlas-ink-3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Statut</div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4,
            padding: 3, borderRadius: 10,
            background: "var(--atlas-soft)",
          }}>
            {["À trier", "À contacter", "Visite", "Dossier"].map((s) => (
              <button key={s} style={{
                padding: "6px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 500,
                color: s === item.status || (s === "Visite" && item.status === "Visite prévue") ? "#fff" : "var(--atlas-ink-2)",
                background: s === item.status || (s === "Visite" && item.status === "Visite prévue") ? "#16140f" : "transparent",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{s}</button>
            ))}
          </div>
        </div>

        <textarea
          placeholder="Notes — prochains pas, contact agence…"
          defaultValue={item.id === "ff-44102" ? "Vue lac · à vérifier la disponibilité après le 1er juin." : ""}
          style={{
            width: "100%", resize: "none", minHeight: 70,
            padding: "10px 12px", borderRadius: 10,
            background: "var(--atlas-paper)",
            boxShadow: "inset 0 0 0 1px var(--atlas-line)",
            fontFamily: "var(--sans)", fontSize: 13, color: "var(--atlas-ink)",
            outline: "none",
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <button style={{
            padding: "10px 12px", borderRadius: 999,
            background: "#16140f", color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            fontSize: 13, fontWeight: 500,
          }}><Icons.External size={14} stroke={1.8}/> Ouvrir l'annonce</button>
          <button style={{
            padding: "10px 14px", borderRadius: 999,
            background: "var(--atlas-paper)",
            boxShadow: "inset 0 0 0 1px var(--atlas-line)",
            color: "var(--atlas-ink-2)",
            fontSize: 13, fontWeight: 500,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}><Icons.X size={13} stroke={1.7}/> Écarter</button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--atlas-ink-3)", paddingTop: 4 }}>
          <span>Vu il y a {item.publishedShort}</span>
          <span>MAJ il y a 12 min</span>
        </div>
      </div>
    </div>
  );
}

function V2MapControls({ position = "right" }) {
  return (
    <div style={{
      position: "absolute", [position]: 432, bottom: 24,
      display: "flex", flexDirection: "column", gap: 6, zIndex: 3,
    }}>
      {[
        ["+", null], ["−", null],
        [null, Icons.Compass],
        [null, Icons.Layers],
      ].map(([txt, I], i) => (
        <button key={i} style={{
          width: 38, height: 38, borderRadius: 12,
          background: "rgba(255,255,255,.94)",
          backdropFilter: "blur(12px)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--mono)", fontSize: 16, color: "var(--atlas-ink)",
          boxShadow: "0 8px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.04)",
        }}>{txt || <I size={15} stroke={1.6}/>}</button>
      ))}
    </div>
  );
}

// =================================================================
// DESKTOP STATES
// =================================================================

function V2RefinedDesktop() {
  const [selected, setSelected] = React.useState("ff-44102");
  const [stage, setStage] = React.useState("triage");
  const listings = V2_LISTINGS.slice(0, 6);
  return (
    <div style={v2Frame(1280, 880)}>
      <AtlasMap pins={listings} selectedId={selected} onSelect={setSelected} mode="warm" />
      <V2TopBar stage={stage} onStage={setStage} />
      <V2ListPanel listings={listings} selected={selected} onSelect={setSelected} />
      <V2DetailPanel item={listings.find(l => l.id === selected) || listings[0]} />
      <V2MapControls />
    </div>
  );
}

function V2EmptyState() {
  return (
    <div style={v2Frame(1280, 880)}>
      <AtlasMap pins={[]} mode="warm" />
      <V2TopBar stage="triage" />
      <div style={{
        position: "absolute", left: 16, top: 76, bottom: 16, width: 380,
        ...v2Glass.panel,
        borderRadius: 18,
        display: "flex", flexDirection: "column", overflow: "hidden",
        zIndex: 4,
      }}>
        <div style={{ padding: "16px 18px 12px" }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--atlas-ink-3)", fontWeight: 500 }}>{V2_PROFILE.shortTitle}</div>
          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4, letterSpacing: "-0.018em" }}>0 appartement</div>
        </div>
        <Hairline />
        <div style={{ flex: 1, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "var(--atlas-ember-2)",
            display: "grid", placeItems: "center", color: "var(--atlas-ember)",
          }}>
            <Icons.Sparkle size={22} stroke={1.6}/>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.015em" }}>Aucune annonce pour l'instant</div>
            <div style={{ fontSize: 13, color: "var(--atlas-ink-2)", marginTop: 6, lineHeight: 1.55, maxWidth: 280 }}>
              Lance un premier scan sur les <b style={{ color: "var(--atlas-ink)", fontWeight: 500 }}>{V2_PROFILE.zones.length} communes</b> de ton profil — ça prend généralement moins d'une minute.
            </div>
          </div>
          <button style={{
            padding: "10px 18px", borderRadius: 999,
            background: "#16140f", color: "#fff",
            fontSize: 13, fontWeight: 500,
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: "0 12px 26px -10px rgba(22,20,15,.4)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "oklch(78% 0.12 150)" }}/>
            Lancer un scan
          </button>
          <div style={{ fontSize: 11.5, color: "var(--atlas-ink-3)" }}>
            Sources actives · immobilier.ch, flatfox.ch, naef.ch +3
          </div>
        </div>
        <Hairline />
        <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 8, color: "var(--atlas-ink-3)", fontSize: 12 }}>
          <Icons.Settings size={13} stroke={1.7}/>
          <span>Régler les zones, le budget et les sources</span>
          <span style={{ flex: 1 }}/>
          <Icons.Chevron size={13} stroke={1.7}/>
        </div>
      </div>

      {/* Empty-state hint over the map */}
      <div style={{
        position: "absolute", left: "calc(50% + 100px)", top: "50%", transform: "translate(-50%,-50%)",
        ...v2Glass.pill, padding: "10px 16px",
        fontSize: 13, color: "var(--atlas-ink-2)",
        zIndex: 3,
      }}>
        <Icons.Compass size={15} stroke={1.6}/>
        Carte centrée sur {V2_PROFILE.shortTitle.split(" & ")[0]}
      </div>
    </div>
  );
}

function V2ScanningState() {
  const listings = V2_LISTINGS.slice(0, 4);
  return (
    <div style={v2Frame(1280, 880)}>
      <AtlasMap pins={listings} mode="warm" />
      <V2TopBar stage="triage" scanning />
      <V2ListPanel listings={listings} selected={null} onSelect={() => {}} scanning />

      {/* Scan progress card mid-map */}
      <div style={{
        position: "absolute", top: 96, left: 432, width: 360,
        ...v2Glass.panel, borderRadius: 18,
        padding: "18px 20px",
        zIndex: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ position: "relative", width: 18, height: 18 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: 999, border: "2px solid rgba(22,20,15,.12)" }}/>
            <span style={{ position: "absolute", inset: 0, borderRadius: 999, border: "2px solid transparent", borderTopColor: "var(--atlas-ember)", animation: "v2spin 1s linear infinite" }}/>
          </span>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Scan en cours</div>
          <span style={{ flex: 1 }}/>
          <span className="mono tnum" style={{ fontSize: 12, color: "var(--atlas-ink-3)" }}>3 / 6 sources</span>
        </div>
        <div style={{ marginTop: 14, height: 4, borderRadius: 4, background: "rgba(22,20,15,.06)", overflow: "hidden" }}>
          <div style={{ width: "52%", height: "100%", background: "var(--atlas-ember)", borderRadius: 4 }}/>
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
          {[
            ["immobilier.ch", "done", "3 nouvelles"],
            ["flatfox.ch", "running", "en cours"],
            ["naef.ch", "running", "en cours"],
            ["bernard-nicod", "queued", "en file"],
            ["Retraites Pop.", "queued", "en file"],
            ["anibis.ch", "queued", "en file"],
          ].map(([s, st, m]) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 14, height: 14, borderRadius: 999,
                background: st === "done" ? "var(--atlas-good)" : st === "running" ? "var(--atlas-ember-2)" : "var(--atlas-line)",
                color: st === "done" ? "#fff" : "var(--atlas-ember)",
                display: "grid", placeItems: "center",
              }}>
                {st === "done" ? <Icons.Check size={9} stroke={2.5}/> : st === "running" ? (
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--atlas-ember)", animation: "v2pulse 1s ease-in-out infinite" }}/>
                ) : null}
              </span>
              <span style={{ color: st === "queued" ? "var(--atlas-ink-3)" : "var(--atlas-ink-2)", flex: 1 }}>{s}</span>
              <span style={{ color: st === "done" ? "var(--atlas-good)" : "var(--atlas-ink-3)", fontFamily: st === "done" ? "var(--mono)" : undefined, fontSize: 11.5 }}>{m}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button style={{
            flex: 1, padding: "8px 12px", borderRadius: 999,
            background: "var(--atlas-paper)", boxShadow: "inset 0 0 0 1px var(--atlas-line)",
            fontSize: 12.5, color: "var(--atlas-ink-2)",
          }}>Annuler</button>
          <button style={{
            flex: 1, padding: "8px 12px", borderRadius: 999,
            background: "var(--atlas-soft)",
            fontSize: 12.5, color: "var(--atlas-ink-2)",
          }}>Continuer en arrière-plan</button>
        </div>
      </div>
      <V2MapControls />
    </div>
  );
}

function V2DetailDrawer() {
  // Shows a full settings drawer overlaid (the right detail is widened to a settings sheet)
  const [stage] = ["triage"];
  const listings = V2_LISTINGS.slice(0, 6);
  return (
    <div style={v2Frame(1280, 880)}>
      <AtlasMap pins={listings} selectedId={null} mode="warm" />
      <div style={{ position: "absolute", inset: 0, background: "rgba(22,20,15,.32)", backdropFilter: "blur(2px)", zIndex: 3 }}/>
      <V2TopBar stage="triage" />
      <V2ListPanel listings={listings} selected={null} onSelect={() => {}} />

      {/* Settings drawer */}
      <div style={{
        position: "absolute", top: 16, right: 16, bottom: 16, width: 480,
        ...v2Glass.panel, borderRadius: 18,
        display: "flex", flexDirection: "column", overflow: "hidden",
        zIndex: 6,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--atlas-ink-3)" }}>Profil</div>
            <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4, letterSpacing: "-0.018em" }}>{V2_PROFILE.shortTitle}</div>
          </div>
          <button style={{ width: 32, height: 32, borderRadius: 999, background: "var(--atlas-soft)", display: "grid", placeItems: "center" }}>
            <Icons.Close size={15} stroke={1.7}/>
          </button>
        </div>
        <Hairline />
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
          <Field label="Titre">
            <input defaultValue={V2_PROFILE.shortTitle} style={inputStyle}/>
          </Field>
          <Field label="Lieu de travail">
            <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8 }}>
              <Icons.Compass size={14} stroke={1.7} style={{ color: "var(--atlas-ink-3)" }}/>
              <span>{V2_PROFILE.workplace}</span>
            </div>
          </Field>
          <Field label="Zones surveillées">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {V2_PROFILE.zones.map((z) => (
                <span key={z} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "5px 4px 5px 10px", borderRadius: 999,
                  background: "var(--atlas-soft)", fontSize: 12.5,
                }}>
                  {z}
                  <span style={{ width: 18, height: 18, borderRadius: 999, background: "rgba(22,20,15,.06)", display: "grid", placeItems: "center" }}>
                    <Icons.Close size={10} stroke={2}/>
                  </span>
                </span>
              ))}
              <button style={{
                padding: "5px 10px", borderRadius: 999,
                background: "transparent", boxShadow: "inset 0 0 0 1px var(--atlas-line)",
                fontSize: 12.5, color: "var(--atlas-ink-2)",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}><Icons.Plus size={12} stroke={1.8}/> Ajouter</button>
            </div>
          </Field>
          <Field label="Budget">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={inputStyle}>
                <div style={{ fontSize: 10.5, color: "var(--atlas-ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Loyer max</div>
                <div className="mono tnum" style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>2 500 <span style={{ fontSize: 11, color: "var(--atlas-ink-3)" }}>CHF</span></div>
              </div>
              <div style={inputStyle}>
                <div style={{ fontSize: 10.5, color: "var(--atlas-ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Plafond</div>
                <div className="mono tnum" style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>3 000 <span style={{ fontSize: 11, color: "var(--atlas-ink-3)" }}>CHF</span></div>
              </div>
            </div>
          </Field>
          <Field label="Sources">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {["immobilier.ch", "flatfox.ch", "naef.ch", "bernard-nicod", "Retraites Populaires", "anibis.ch"].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
                  <SourceMono source={s} dim/>
                  <span style={{ flex: 1, fontSize: 13 }}>{s}</span>
                  <Toggle on={i !== 5}/>
                </div>
              ))}
            </div>
          </Field>
        </div>
        <Hairline />
        <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={{ padding: "9px 14px", borderRadius: 999, background: "transparent", color: "var(--atlas-ink-2)", fontSize: 13 }}>Annuler</button>
          <button style={{
            padding: "9px 18px", borderRadius: 999,
            background: "#16140f", color: "#fff", fontSize: 13, fontWeight: 500,
          }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "10px 12px", borderRadius: 10,
  background: "var(--atlas-paper)",
  boxShadow: "inset 0 0 0 1px var(--atlas-line)",
  fontSize: 13.5, color: "var(--atlas-ink)",
};
function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--atlas-ink-3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function Toggle({ on }) {
  return (
    <span style={{
      width: 32, height: 18, borderRadius: 999, padding: 2,
      background: on ? "#16140f" : "rgba(22,20,15,.18)",
      display: "inline-flex", alignItems: "center",
    }}>
      <span style={{ width: 14, height: 14, borderRadius: 999, background: "#fff", marginLeft: on ? 14 : 0, transition: "margin 160ms ease" }}/>
    </span>
  );
}

// =================================================================
// MOBILE STATES
// =================================================================

function V2MobileList() {
  const listings = V2_LISTINGS.slice(0, 5);
  return (
    <div style={v2Frame(390, 844, true)}>
      <V2MobileStatusBar />
      <V2TopBar mobile stage="triage" />
      <div style={{
        padding: "12px 12px 4px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--atlas-bg)",
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--atlas-ink-3)", fontWeight: 500 }}>{V2_PROFILE.shortTitle}</div>
          <div style={{ fontSize: 17, fontWeight: 500, marginTop: 2, letterSpacing: "-0.018em" }}>{listings.length} appartements</div>
        </div>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 999, background: "var(--atlas-soft)", fontSize: 11.5 }}>
          Plus récents <Icons.ChevronDown size={11} stroke={1.7}/>
        </button>
      </div>
      <div style={{
        padding: "0 8px 12px",
        display: "flex", gap: 6, overflowX: "auto",
        background: "var(--atlas-bg)",
      }}>
        {V2_STAGES.map((s, i) => (
          <button key={s.value} style={{
            padding: "7px 12px", borderRadius: 999, fontSize: 12.5,
            color: i === 0 ? "#fff" : "var(--atlas-ink-2)",
            background: i === 0 ? "#16140f" : "var(--atlas-paper)",
            boxShadow: i === 0 ? "none" : "inset 0 0 0 1px var(--atlas-line)",
            fontWeight: 500, whiteSpace: "nowrap",
          }}>
            {s.label} <span className="mono" style={{ fontSize: 10.5, opacity: i === 0 ? .7 : .55, marginLeft: 4 }}>{s.count}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 90px", background: "var(--atlas-bg)" }}>
        {listings.map((it) => (
          <V2MobileRow key={it.id} item={it}/>
        ))}
      </div>
      <div style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "10px 18px", borderRadius: 999,
        background: "#16140f", color: "#fff",
        fontSize: 13.5, fontWeight: 500,
        boxShadow: "0 14px 30px -10px rgba(22,20,15,.4)",
        zIndex: 5,
      }}>
        <Icons.Map size={16} stroke={1.8}/> Carte
      </div>
      <V2MobileHomeIndicator/>
    </div>
  );
}

function V2MobileRow({ item }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8,
      padding: "12px 0",
      borderBottom: "1px solid var(--atlas-line-2)",
    }}>
      <div style={{ position: "relative" }}>
        <PhotoFrame images={item.images} aspect="16/10" radius={14}/>
        <button style={{
          position: "absolute", top: 10, right: 10,
          width: 32, height: 32, borderRadius: 999,
          background: "rgba(255,255,255,.92)",
          display: "grid", placeItems: "center",
        }}>
          <Icons.Heart size={14} stroke={1.7}/>
        </button>
        {item.isNew ? (
          <span style={{
            position: "absolute", top: 10, left: 10,
            padding: "4px 9px", borderRadius: 999,
            background: "rgba(22,20,15,.7)", backdropFilter: "blur(8px)",
            color: "#fff", fontSize: 10.5, letterSpacing: ".08em", fontWeight: 500,
          }}>NOUVEAU</span>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--atlas-ink-3)" }}>{item.area} · {item.source.replace(".ch", "")}</div>
          <div style={{ fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.012em", marginTop: 2, lineHeight: 1.3 }}>{item.title}</div>
        </div>
        <div className="mono tnum" style={{ fontSize: 16, fontWeight: 500, whiteSpace: "nowrap" }}>{fmtCHF(item.totalChf)}</div>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--atlas-ink-2)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Bed size={12} stroke={1.7}/> {item.rooms} pces</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Square size={12} stroke={1.7}/> {item.surfaceM2} m²</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Train size={12} stroke={1.7}/> {item.transitText}</span>
      </div>
    </div>
  );
}

function V2MobileMap() {
  const listings = V2_LISTINGS.slice(0, 6);
  const [selected, setSelected] = React.useState("ff-44102");
  const sel = listings.find(l => l.id === selected) || listings[0];
  return (
    <div style={v2Frame(390, 844, true)}>
      <div style={{ position: "absolute", inset: 0 }}>
        <AtlasMap pins={listings} selectedId={selected} onSelect={setSelected} mode="warm" />
      </div>

      {/* Top floating bar */}
      <div style={{
        position: "absolute", top: 54, left: 12, right: 12, zIndex: 6,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ ...v2Glass.pill, padding: "8px 12px", flex: 1 }}>
          <Icons.Search size={14} stroke={1.7}/>
          <span style={{ flex: 1, color: "var(--atlas-ink-3)", fontSize: 13 }}>Vevey, Lutry…</span>
        </div>
        <button style={{ ...v2Glass.pill, padding: "8px 10px" }}>
          <Icons.Filter size={15} stroke={1.7}/>
        </button>
      </div>
      <V2MobileStatusBarFloating/>

      {/* Filter chips */}
      <div style={{
        position: "absolute", top: 102, left: 0, right: 0, zIndex: 5,
        display: "flex", gap: 6, padding: "0 12px", overflowX: "auto",
      }}>
        {V2_STAGES.slice(0, 4).map((s, i) => (
          <button key={s.value} style={{
            ...v2Glass.pill, padding: "6px 12px", fontSize: 12,
            background: i === 0 ? "rgba(22,20,15,.92)" : v2Glass.pill.background,
            color: i === 0 ? "#fff" : "var(--atlas-ink-2)",
            whiteSpace: "nowrap",
          }}>{s.label} · {s.count}</button>
        ))}
      </div>

      {/* Right rail controls */}
      <div style={{ position: "absolute", right: 12, top: 156, display: "flex", flexDirection: "column", gap: 6, zIndex: 5 }}>
        {[Icons.Compass, Icons.Layers].map((I, i) => (
          <button key={i} style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(253,251,247,.94)",
            backdropFilter: "blur(12px)",
            display: "grid", placeItems: "center",
            color: "var(--atlas-ink)",
            boxShadow: "0 8px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.04)",
          }}><I size={16} stroke={1.6}/></button>
        ))}
      </div>

      {/* Bottom mini-card preview */}
      <div style={{
        position: "absolute", bottom: 100, left: 12, right: 12, zIndex: 6,
        ...v2Glass.panel, borderRadius: 18, padding: 10,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "104px 1fr", gap: 12 }}>
          <div style={{ aspectRatio: "1", borderRadius: 12, background: `center/cover no-repeat url(${sel.images[0]})` }}/>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--atlas-ink-3)" }}>{sel.area}</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.title}</div>
            <div style={{ fontSize: 11.5, color: "var(--atlas-ink-3)" }}>{sel.rooms} pces · {sel.surfaceM2} m² · {sel.transitText}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span className="mono tnum" style={{ fontSize: 14, fontWeight: 500 }}>{fmtCHF(sel.totalChf)}</span>
              <span style={{ flex: 1 }}/>
              <span style={{ display: "inline-flex", gap: 3 }}>
                {listings.slice(0, 4).map((_, i) => (
                  <span key={i} style={{ width: i === listings.indexOf(sel) ? 14 : 4, height: 4, borderRadius: 2, background: i === listings.indexOf(sel) ? "var(--atlas-ink)" : "var(--atlas-line)" }}/>
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <V2MobileTabBar tab="map"/>
      <V2MobileHomeIndicator/>
    </div>
  );
}

function V2MobileDetail() {
  const item = V2_LISTINGS[1];
  const listings = V2_LISTINGS.slice(0, 6);
  return (
    <div style={v2Frame(390, 844, true)}>
      <div style={{ position: "absolute", inset: 0 }}>
        <AtlasMap pins={listings} selectedId={item.id} mode="warm" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,.18) 100%)" }}/>
      </div>

      {/* Top close */}
      <div style={{ position: "absolute", top: 54, left: 12, right: 12, display: "flex", justifyContent: "space-between", zIndex: 7 }}>
        <button style={{ ...v2Glass.pill, padding: 8 }}>
          <Icons.Chevron size={16} stroke={1.8} style={{ transform: "rotate(180deg)" }}/>
        </button>
        <button style={{ ...v2Glass.pill, padding: 8 }}>
          <Icons.More size={16} stroke={1.8}/>
        </button>
      </div>
      <V2MobileStatusBarFloating/>

      {/* Bottom sheet */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 6,
        background: "var(--atlas-paper)",
        borderRadius: "22px 22px 0 0",
        boxShadow: "0 -22px 50px -22px rgba(22,20,15,.32)",
        height: "76%",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
          <span style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(22,20,15,.18)" }}/>
        </div>

        <div style={{ padding: "8px 16px 0", flex: 1, overflowY: "auto" }}>
          <PhotoFrame images={item.images} aspect="4/3" radius={16}/>

          <div style={{ padding: "16px 0 12px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--atlas-ink-3)" }}>{item.area} · {item.source.replace(".ch", "")}</div>
              <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.018em", marginTop: 4, lineHeight: 1.25 }}>{item.title}</div>
              <div style={{ color: "var(--atlas-ink-3)", fontSize: 12.5, marginTop: 4 }}>{item.address.split(",")[0]}</div>
            </div>
            <div className="mono tnum" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.015em", whiteSpace: "nowrap" }}>{fmtCHF(item.totalChf)}</div>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
            background: "var(--atlas-line)",
            borderRadius: 14, overflow: "hidden",
            boxShadow: "0 0 0 1px var(--atlas-line)",
            marginBottom: 14,
          }}>
            {[
              ["Pièces", `${item.rooms}`, Icons.Bed],
              ["Surface", `${item.surfaceM2} m²`, Icons.Square],
              ["Trajet", item.driveText, Icons.Drive],
            ].map(([l, v, I], i) => (
              <div key={i} style={{ background: "var(--atlas-paper)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--atlas-ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                  <I size={12} stroke={1.7}/> {l}
                </span>
                <span className="mono tnum" style={{ fontSize: 14, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <SourceMono source={item.source}/>
            <span style={{ fontSize: 12.5, color: "var(--atlas-ink-2)" }}>{item.source}</span>
            <span style={{ flex: 1 }}/>
            <StatusPill status={item.status}/>
          </div>

          <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--atlas-ink-2)", lineHeight: 1.55 }}>
            {item.address}. À {item.distanceText} du lieu de travail. Publié {item.publishedLabel} sur {item.source.replace(".ch", "")}.
          </p>
        </div>

        <Hairline/>
        <div style={{ padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))", display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
          <button style={{
            width: 46, height: 46, borderRadius: 999,
            background: "var(--atlas-paper-2)",
            boxShadow: "inset 0 0 0 1px var(--atlas-line)",
            display: "grid", placeItems: "center",
          }}><Icons.Heart size={17} stroke={1.7}/></button>
          <button style={{
            padding: "0 18px", borderRadius: 999, background: "#16140f", color: "#fff",
            fontSize: 14, fontWeight: 500,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}><Icons.External size={15} stroke={1.8}/> Ouvrir l'annonce</button>
        </div>
      </div>
      <V2MobileHomeIndicator/>
    </div>
  );
}

// Mobile chrome — iOS-ish status bar, home indicator, tab bar
function V2MobileStatusBar() {
  return (
    <div style={{
      height: 44, padding: "0 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 14, fontWeight: 600, color: "var(--atlas-ink)",
      background: "var(--atlas-bg)",
    }}>
      <span className="mono">9:41</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 16, height: 10, borderRadius: 2, background: "currentColor" }}/>
        <span style={{ width: 14, height: 10, borderRadius: 2, border: "1.2px solid currentColor" }}/>
        <span style={{ width: 22, height: 10, border: "1.2px solid currentColor", borderRadius: 3, position: "relative" }}>
          <span style={{ position: "absolute", inset: 1.5, width: "60%", background: "currentColor", borderRadius: 1 }}/>
        </span>
      </span>
    </div>
  );
}
function V2MobileStatusBarFloating() {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 44, padding: "0 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 14, fontWeight: 600, color: "var(--atlas-ink)",
      zIndex: 8, pointerEvents: "none",
    }}>
      <span className="mono">9:41</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 16, height: 10, borderRadius: 2, background: "currentColor" }}/>
        <span style={{ width: 14, height: 10, borderRadius: 2, border: "1.2px solid currentColor" }}/>
        <span style={{ width: 22, height: 10, border: "1.2px solid currentColor", borderRadius: 3, position: "relative" }}>
          <span style={{ position: "absolute", inset: 1.5, width: "60%", background: "currentColor", borderRadius: 1 }}/>
        </span>
      </span>
    </div>
  );
}
function V2MobileHomeIndicator() {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 8,
      display: "flex", justifyContent: "center", zIndex: 9,
    }}>
      <span style={{ width: 134, height: 5, borderRadius: 3, background: "var(--atlas-ink)" }}/>
    </div>
  );
}
function V2MobileTabBar({ tab }) {
  return (
    <div style={{
      position: "absolute", left: 12, right: 12, bottom: 24, zIndex: 7,
      ...v2Glass.panel, borderRadius: 999, padding: 4,
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
    }}>
      {[
        ["list", Icons.List, "Liste"],
        ["map", Icons.Map, "Carte"],
        ["triage", Icons.Bolt, "Triage"],
      ].map(([k, I, l]) => (
        <button key={k} style={{
          padding: "8px 10px", borderRadius: 999,
          background: tab === k ? "#16140f" : "transparent",
          color: tab === k ? "#fff" : "var(--atlas-ink-2)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontSize: 13, fontWeight: 500,
        }}>
          <I size={15} stroke={1.7}/> {l}
        </button>
      ))}
    </div>
  );
}

// Frame helper
const v2Frame = (w, h, mobile) => ({
  width: w, height: h, position: "relative", overflow: "hidden",
  fontFamily: "var(--sans)", letterSpacing: "-0.005em",
  color: "var(--atlas-ink)", background: "var(--atlas-bg)",
  display: mobile ? "flex" : "block",
  flexDirection: mobile ? "column" : undefined,
  borderRadius: mobile ? 44 : 0,
  boxShadow: mobile ? "0 0 0 10px #16140f, 0 0 0 12px #2a2620, 0 30px 60px -28px rgba(22,20,15,.4)" : "none",
});

// Keyframes
const v2Style = document.createElement("style");
v2Style.textContent = `
  @keyframes v2spin { to { transform: rotate(360deg); } }
  @keyframes v2pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
`;
document.head.appendChild(v2Style);

Object.assign(window, {
  V2RefinedDesktop, V2EmptyState, V2ScanningState, V2DetailDrawer,
  V2MobileList, V2MobileMap, V2MobileDetail,
});
