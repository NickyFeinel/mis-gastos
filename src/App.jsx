import { useState, useEffect, useMemo, useCallback } from "react";

const CATS_TARJETA = ["Moda y Belleza","Servicios","Salud","Hogar","Otro"];
const CATS_GASTO = ["Comida","Transporte","Salidas","Moda y Belleza","Salud","Servicios","Caprichos","Regalo","Otro"];
const CATS_INGRESO = ["Sueldo","Devolución","Venta","Regalo","Otro ingreso"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONEDAS = [
  { code: "ARS", label: "Pesos", sym: "$" },
  { code: "USD", label: "Dólares", sym: "US$" },
  { code: "EUR", label: "Euros", sym: "€" },
  { code: "BRL", label: "Reales", sym: "R$" },
];
function symOf(code) { return (MONEDAS.find(m => m.code === code) || MONEDAS[0]).sym; }

function fmt(n, moneda = "ARS") {
  const v = Number.isFinite(n) ? n : 0;
  const sym = symOf(moneda);
  return `${sym} ${Math.round(v).toLocaleString("es-AR")}`;
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const nude = {
  bg: "#FAF6F0", border: "#D9C4AE", borderSoft: "#EFE5D8",
  text: "#3B2A1E", textMuted: "#8A7160", accent: "#8B5E3C",
  accentDark: "#5C3B22", accentLight: "#F0E6D8",
};

export default function GastosApp() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(monthKey(today));
  const [allData, setAllData] = useState({});
  const [tarjetas, setTarjetas] = useState([{ id: "t1", nombre: "Mi Tarjeta", limite: 0 }]);
  const [activeTarjeta, setActiveTarjeta] = useState("t1");
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("tarjeta");
  const [showAddTarjeta, setShowAddTarjeta] = useState(false);
  const [showAddDigital, setShowAddDigital] = useState(false);
  const [showAddEfectivo, setShowAddEfectivo] = useState(false);
  const [showLimite, setShowLimite] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editingCardName, setEditingCardName] = useState(false);
  const [editCardNameVal, setEditCardNameVal] = useState("");
  const [newCardNombre, setNewCardNombre] = useState("");
  const [newCardLimite, setNewCardLimite] = useState("");
  const [confirmDeleteTarjeta, setConfirmDeleteTarjeta] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await window.storage.get("gastos-v2");
        if (r && r.value) {
          const d = JSON.parse(r.value);
          setAllData(d.allData || {});
          if (d.tarjetas) setTarjetas(d.tarjetas);
        }
      } catch (e) {}
      setLoaded(true);
    }
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(async () => {
      try { await window.storage.set("gastos-v2", JSON.stringify({ allData, tarjetas })); }
      catch (e) {}
    }, 400);
    return () => clearTimeout(timeout);
  }, [allData, tarjetas, loaded]);

  const [year, month] = currentMonth.split("-").map(Number);
  const monthLabel = `${MESES[month - 1]} ${year}`;
  function shiftMonth(delta) { const d = new Date(year, month - 1 + delta, 1); setCurrentMonth(monthKey(d)); }

  function getMonthData(mk) {
    return allData[mk] || { digital: [], efectivo: {} };
  }

  function getAllSeeds(tarjetaId) {
    const seeds = [];
    Object.keys(allData).forEach(mk => {
      const md = allData[mk];
      if (md.tarjeta_seeds && md.tarjeta_seeds[tarjetaId]) {
        md.tarjeta_seeds[tarjetaId].forEach(s => seeds.push(s));
      }
    });
    return seeds;
  }

  function getItemsForMonth(tarjetaId, mk) {
    const seeds = getAllSeeds(tarjetaId);
    const items = [];
    seeds.forEach(s => {
      if (s.fijo) {
        if (mk >= s.startMonth && (!s.finMonth || mk <= s.finMonth)) {
          items.push({
            id: s.id + "-" + mk, seedId: s.id, seedMonth: s.startMonth,
            nombre: s.nombre, categoria: s.categoria, monto: s.monto,
            cuotas: null, cuotaMensual: s.monto, cuotaActual: null,
            moneda: s.moneda || "ARS", fecha: s.fecha || "", fijo: true,
          });
        }
        return;
      }
      for (let i = 0; i < s.cuotas; i++) {
        if (addMonths(s.startMonth, i) === mk) {
          items.push({
            id: s.id + "-" + i, seedId: s.id, seedMonth: s.startMonth,
            nombre: s.nombre, categoria: s.categoria, monto: s.monto,
            cuotas: s.cuotas, cuotaMensual: s.cuotaMensual, cuotaActual: i + 1,
            moneda: s.moneda || "ARS", fecha: s.fecha || "", fijo: false,
          });
        }
      }
    });
    return items;
  }

  function addSeed(tarjetaId, seed) {
    setAllData(prev => {
      const base = prev[currentMonth] || {};
      const seeds = base.tarjeta_seeds || {};
      const arr = seeds[tarjetaId] || [];
      return {
        ...prev,
        [currentMonth]: {
          ...base,
          tarjeta_seeds: { ...seeds, [tarjetaId]: [...arr, { ...seed, startMonth: currentMonth, id: uid() }] }
        }
      };
    });
  }

  function removeSeed(tarjetaId, seedId, seedMonth) {
    setAllData(prev => {
      const base = prev[seedMonth];
      if (!base?.tarjeta_seeds?.[tarjetaId]) return prev;
      return {
        ...prev,
        [seedMonth]: {
          ...base,
          tarjeta_seeds: {
            ...base.tarjeta_seeds,
            [tarjetaId]: base.tarjeta_seeds[tarjetaId].filter(s => s.id !== seedId)
          }
        }
      };
    });
  }

  function darDeBajaSeed(tarjetaId, seedId, seedMonth, finMonth) {
    setAllData(prev => {
      const base = prev[seedMonth];
      if (!base?.tarjeta_seeds?.[tarjetaId]) return prev;
      return {
        ...prev,
        [seedMonth]: {
          ...base,
          tarjeta_seeds: {
            ...base.tarjeta_seeds,
            [tarjetaId]: base.tarjeta_seeds[tarjetaId].map(s => s.id === seedId ? { ...s, finMonth } : s)
          }
        }
      };
    });
  }

  function getTarjeta(id) { return tarjetas.find(t => t.id === id) || tarjetas[0]; }

  function updateTarjeta(id, updater) {
    setTarjetas(prev => prev.map(t => t.id === id ? updater(t) : t));
  }

  function deleteTarjetaCompleta(id) {
    setAllData(prev => {
      const next = {};
      Object.keys(prev).forEach(mk => {
        const base = prev[mk];
        if (!base?.tarjeta_seeds?.[id]) {
          next[mk] = base;
          return;
        }
        const seeds = { ...base.tarjeta_seeds };
        delete seeds[id];
        next[mk] = { ...base, tarjeta_seeds: seeds };
      });
      return next;
    });
    setTarjetas(prev => {
      const filtered = prev.filter(t => t.id !== id);
      setActiveTarjeta(filtered[0]?.id || "");
      return filtered;
    });
    setConfirmDeleteTarjeta(false);
  }

  function addMovimiento(sec, item) {
    setAllData(prev => {
      const base = prev[currentMonth] || { digital: [], efectivo: {} };
      if (sec === "digital") {
        return { ...prev, [currentMonth]: { ...base, digital: [...(base.digital || []), item] } };
      } else {
        return { ...prev, [currentMonth]: { ...base, efectivo: { ...(base.efectivo || {}), [item.id]: item } } };
      }
    });
  }

  function removeMovimiento(sec, id) {
    setAllData(prev => {
      const base = prev[currentMonth] || { digital: [], efectivo: {} };
      if (sec === "digital") {
        return { ...prev, [currentMonth]: { ...base, digital: (base.digital || []).filter(m => m.id !== id) } };
      } else {
        const ef = { ...(base.efectivo || {}) };
        delete ef[id];
        return { ...prev, [currentMonth]: { ...base, efectivo: ef } };
      }
    });
  }

  const tarj = getTarjeta(activeTarjeta);
  const tarjetaItems = getItemsForMonth(activeTarjeta, currentMonth);

  const totalesTarjetaPorMoneda = useMemo(() => {
    const map = {};
    tarjetaItems.forEach(g => {
      const mon = g.moneda || "ARS";
      map[mon] = (map[mon] || 0) + g.cuotaMensual;
    });
    return map;
  }, [tarjetaItems]);

  const totalTarjetaARS = totalesTarjetaPorMoneda.ARS || 0;
  const lim = tarj?.limite || 0;
  const disponible = lim - totalTarjetaARS;
  const pct = lim > 0 ? Math.min(100, Math.round((totalTarjetaARS / lim) * 100)) : 0;

  const catMap = useMemo(() => {
    const map = {};
    tarjetaItems.forEach(g => {
      const key = g.categoria + "|" + (g.moneda || "ARS");
      if (!map[key]) map[key] = { categoria: g.categoria, moneda: g.moneda || "ARS", monto: 0 };
      map[key].monto += g.cuotaMensual;
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  }, [tarjetaItems]);

  const monthData = getMonthData(currentMonth);
  const digitalMovs = monthData.digital || [];
  const efectivoMovs = Object.values(monthData.efectivo || {});

  function calcTotalesPorMoneda(movs) {
    const map = {};
    movs.forEach(m => {
      const mon = m.moneda || "ARS";
      if (!map[mon]) map[mon] = { ingresos: 0, gastos: 0 };
      if (m.tipo === "ingreso") map[mon].ingresos += m.monto; else map[mon].gastos += m.monto;
    });
    Object.keys(map).forEach(mon => { map[mon].saldo = map[mon].ingresos - map[mon].gastos; });
    return map;
  }
  const totDigital = useMemo(() => calcTotalesPorMoneda(digitalMovs), [digitalMovs]);
  const totEfectivo = useMemo(() => calcTotalesPorMoneda(efectivoMovs), [efectivoMovs]);

  const resumen = useMemo(() => {
    const porMoneda = {};
    function addTo(mon, key, val) {
      if (!porMoneda[mon]) porMoneda[mon] = { totalGastos: 0, totalIngresos: 0, porTarjeta: 0, porDigital: 0, porEfectivo: 0 };
      porMoneda[mon][key] += val;
    }
    tarjetas.forEach(t => {
      getItemsForMonth(t.id, currentMonth).forEach(g => {
        const mon = g.moneda || "ARS";
        addTo(mon, "totalGastos", g.cuotaMensual);
        addTo(mon, "porTarjeta", g.cuotaMensual);
      });
    });
    digitalMovs.forEach(m => {
      const mon = m.moneda || "ARS";
      if (m.tipo === "gasto") { addTo(mon, "totalGastos", m.monto); addTo(mon, "porDigital", m.monto); }
      else addTo(mon, "totalIngresos", m.monto);
    });
    efectivoMovs.forEach(m => {
      const mon = m.moneda || "ARS";
      if (m.tipo === "gasto") { addTo(mon, "totalGastos", m.monto); addTo(mon, "porEfectivo", m.monto); }
      else addTo(mon, "totalIngresos", m.monto);
    });
    return porMoneda;
  }, [tarjetas, allData, currentMonth]);

  const last6Months = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const key = monthKey(d);
      const md = allData[key] || {};
      let tTotal = 0;
      tarjetas.forEach(t => { getItemsForMonth(t.id, key).forEach(g => { if ((g.moneda || "ARS") === "ARS") tTotal += g.cuotaMensual; }); });
      const dig = md.digital || [];
      const efArr = Object.values(md.efectivo || {});
      const soloARS = x => (x.moneda || "ARS") === "ARS";
      result.push({
        key, label: MESES[d.getMonth()].slice(0, 3),
        gastos: tTotal + dig.filter(x => x.tipo === "gasto" && soloARS(x)).reduce((a, x) => a + x.monto, 0) + efArr.filter(x => x.tipo === "gasto" && soloARS(x)).reduce((a, x) => a + x.monto, 0),
        ingresos: dig.filter(x => x.tipo === "ingreso" && soloARS(x)).reduce((a, x) => a + x.monto, 0) + efArr.filter(x => x.tipo === "ingreso" && soloARS(x)).reduce((a, x) => a + x.monto, 0),
      });
    }
    return result;
  }, [allData, tarjetas, year, month]);

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", background: nude.bg, minHeight: "100vh", padding: "28px 18px 60px", color: nude.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .gst-input { border: 1.5px solid ${nude.border}; border-radius: 14px; padding: 10px 14px; font-family: inherit; font-size: 14px; background: #fff; color: ${nude.text}; outline: none; width: 100%; }
        .gst-input:focus { border-color: ${nude.accent}; }
        .gst-btn { background: ${nude.accent}; color: #fff; border: none; border-radius: 999px; padding: 11px 22px; font-family: inherit; font-weight: 700; font-size: 14px; cursor: pointer; transition: background 0.12s; }
        .gst-btn:hover { background: ${nude.accentDark}; }
        .gst-btn-ghost { background: #fff; color: ${nude.accent}; border: 1.5px solid ${nude.border}; border-radius: 999px; padding: 9px 18px; font-family: inherit; font-weight: 700; font-size: 13px; cursor: pointer; }
        .gst-btn-ghost:hover { background: ${nude.accentLight}; }
        .gst-tab { flex: 1; text-align: center; padding: 9px 0; border-radius: 999px; font-weight: 700; font-size: 12px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .gst-row { display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 14px; border-radius: 16px; background: #fff; border: 1px solid ${nude.borderSoft}; text-align: left; }
        .gst-x { background: none; border: none; color: ${nude.textMuted}; opacity: 0.5; cursor: pointer; font-size: 16px; padding: 4px; line-height: 1; }
        .gst-x:hover { opacity: 1; color: ${nude.accentDark}; }
        select.gst-input { appearance: none; }
        .gst-bar-bg { width: 100%; height: 10px; border-radius: 999px; background: ${nude.accentLight}; overflow: hidden; }
        .gst-bar-fill { height: 100%; border-radius: 999px; transition: width 0.3s; }
        .gst-card { background: #fff; border-radius: 20px; border: 1px solid ${nude.borderSoft}; padding: 18px 20px; margin-bottom: 16px; }
        .chip { background: ${nude.accentLight}; border: 1px solid ${nude.border}; border-radius: 20px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: inherit; font-weight: 700; color: ${nude.accentDark}; white-space: nowrap; }
        .chip.active { background: ${nude.accent}; color: #fff; border-color: ${nude.accent}; }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ position: "relative", textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 26, marginBottom: 2 }}>✿</div>
          <h1 style={{ fontWeight: 700, fontSize: 24, margin: 0, color: nude.accentDark }}>Mis gastos</h1>
          <p style={{ fontSize: 13, color: nude.textMuted, margin: "4px 0 0" }}>todo bajo control, mes a mes</p>
          <button onClick={() => setActiveTab(activeTab === "resumen" ? "tarjeta" : "resumen")}
            style={{ position: "absolute", top: 0, right: 0, background: activeTab === "resumen" ? nude.accent : "#fff", border: `1.5px solid ${nude.border}`, borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: activeTab === "resumen" ? "#fff" : nude.accent }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </button>
        </div>

        {/* Selector de mes */}
        {activeTab !== "resumen" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1.5px solid ${nude.border}`, borderRadius: 999, padding: "8px 18px", marginBottom: 20 }}>
            <button onClick={() => shiftMonth(-1)} style={{ background: "none", border: "none", color: nude.accent, fontSize: 20, cursor: "pointer", fontWeight: 700 }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 15, color: nude.accentDark }}>{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} style={{ background: "none", border: "none", color: nude.accent, fontSize: 20, cursor: "pointer", fontWeight: 700 }}>›</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", background: nude.accentLight, borderRadius: 999, padding: 4, marginBottom: 20, gap: 4 }}>
          {["tarjeta", "digital", "efectivo"].map(t => (
            <div key={t} className="gst-tab" onClick={() => { setActiveTab(t); setShowAddTarjeta(false); setShowAddDigital(false); setShowAddEfectivo(false); setEditingCardName(false); setConfirmDeleteTarjeta(false); }}
              style={{ background: activeTab === t ? nude.accent : "transparent", color: activeTab === t ? "#fff" : nude.accentDark }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>

        {/* TARJETA */}
        {activeTab === "tarjeta" && (
          <>
            {/* Chips de tarjetas */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 2, alignItems: "center" }}>
              {tarjetas.map(t => (
                <button key={t.id} className={`chip${t.id === activeTarjeta ? " active" : ""}`}
                  onClick={() => { setActiveTarjeta(t.id); setShowLimite(false); setEditingCardName(false); setConfirmDeleteTarjeta(false); }}>
                  {t.nombre}
                </button>
              ))}
              <button className="chip" onClick={() => { setShowAddCard(true); setNewCardNombre(""); setNewCardLimite(""); }}>+ nueva</button>
            </div>

            {/* Formulario nueva tarjeta */}
            {showAddCard && (
              <div className="gst-card" style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: nude.accentDark, marginBottom: 12, fontSize: 14 }}>Nueva tarjeta</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input className="gst-input" placeholder="Ej: Visa Galicia, Mastercard BBVA..." value={newCardNombre} onChange={e => setNewCardNombre(e.target.value)} />
                  <input className="gst-input" type="number" placeholder="Límite (opcional)" value={newCardLimite} onChange={e => setNewCardLimite(e.target.value)} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="gst-btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddCard(false)}>cancelar</button>
                    <button className="gst-btn" style={{ flex: 1 }} onClick={() => {
                      const id = uid();
                      setTarjetas(prev => [...prev, { id, nombre: newCardNombre.trim() || "Nueva tarjeta", limite: Number(newCardLimite) || 0 }]);
                      setActiveTarjeta(id);
                      setShowAddCard(false);
                    }}>crear</button>
                  </div>
                </div>
              </div>
            )}

            <div className="gst-card">
              {/* Nombre editable */}
              <div style={{ marginBottom: 12 }}>
                {editingCardName ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="gst-input" autoFocus value={editCardNameVal} onChange={e => setEditCardNameVal(e.target.value)}
                      style={{ fontSize: 15, fontWeight: 700, color: nude.accentDark }} placeholder="Nombre de la tarjeta"
                      onKeyDown={e => { if (e.key === "Enter") { updateTarjeta(activeTarjeta, t => ({ ...t, nombre: editCardNameVal.trim() || t.nombre })); setEditingCardName(false); }}} />
                    <button className="gst-btn" style={{ padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" }}
                      onClick={() => { updateTarjeta(activeTarjeta, t => ({ ...t, nombre: editCardNameVal.trim() || t.nombre })); setEditingCardName(false); }}>OK</button>
                    <button className="gst-x" style={{ opacity: 0.6, fontSize: 20 }} onClick={() => setEditingCardName(false)}>×</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: nude.accentDark }}>{tarj?.nombre}</span>
                    <button onClick={() => { setEditCardNameVal(tarj?.nombre || ""); setEditingCardName(true); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: nude.textMuted, opacity: 0.6, padding: 2, display: "flex", alignItems: "center" }}
                      title="Editar nombre">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: nude.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>GASTADO ESTE MES</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="gst-btn-ghost" onClick={() => setShowLimite(!showLimite)} style={{ fontSize: 11, padding: "5px 12px" }}>
                    {lim > 0 ? "editar límite" : "poner límite"}
                  </button>
                  {tarjetas.length > 1 && (
                    <button className="gst-btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "#712B13" }}
                      onClick={() => setConfirmDeleteTarjeta(true)}>
                      eliminar
                    </button>
                  )}
                </div>
              </div>

              {confirmDeleteTarjeta && (
                <div style={{ background: "#F3E7DA", border: "1.5px solid #C9A57E", borderRadius: 14, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 13.5, color: "#5C3B22", fontWeight: 600, marginBottom: 10 }}>
                    ¿Confirmás eliminar "{tarj?.nombre}"? Se van a borrar también todos sus gastos y cuotas cargadas.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="gst-btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDeleteTarjeta(false)}>cancelar</button>
                    <button className="gst-btn" style={{ flex: 1, background: "#7A4A2E" }} onClick={() => deleteTarjetaCompleta(activeTarjeta)}>
                      sí, eliminar
                    </button>
                  </div>
                </div>
              )}

              {Object.keys(totalesTarjetaPorMoneda).length === 0 ? (
                <div style={{ fontSize: 28, fontWeight: 700, color: nude.accentDark }}>{fmt(0)}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {Object.entries(totalesTarjetaPorMoneda).map(([mon, val], i) => (
                    <div key={mon} style={{ fontSize: i === 0 ? 28 : 16, fontWeight: 700, color: nude.accentDark }}>{fmt(val, mon)}</div>
                  ))}
                </div>
              )}

              {showLimite && (
                <LimiteInput defaultValue={lim} onSave={val => { updateTarjeta(activeTarjeta, t => ({ ...t, limite: val })); setShowLimite(false); }} nude={nude} />
              )}

              {lim > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="gst-bar-bg">
                    <div className="gst-bar-fill" style={{ width: `${pct}%`, background: pct > 90 ? "#8B5E3C" : "#D9C4AE" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12.5, color: nude.textMuted }}>
                    <span>{pct}% usado (en pesos)</span>
                    <span style={{ fontWeight: 700, color: disponible < 0 ? "#712B13" : nude.accentDark }}>disponible {fmt(disponible)}</span>
                  </div>
                </div>
              )}
            </div>

            {catMap.length > 0 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18, paddingBottom: 2 }}>
                {catMap.map(c => (
                  <div key={c.categoria + "|" + c.moneda} style={{ flexShrink: 0, background: nude.accentLight, borderRadius: 14, padding: "8px 14px", fontSize: 12 }}>
                    <div style={{ color: nude.textMuted, marginBottom: 2 }}>{c.categoria}</div>
                    <div style={{ fontWeight: 700, color: nude.accentDark }}>{fmt(c.monto, c.moneda)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {tarjetaItems.length === 0 && <p style={{ textAlign: "center", color: nude.textMuted, fontSize: 13.5, padding: "20px 0" }}>Todavía no agregaste gastos de tarjeta este mes ✿</p>}
              {tarjetaItems.map(g => (
                <div className="gst-row" key={g.id}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{g.nombre}</div>
                    <div style={{ fontSize: 12, color: nude.textMuted, marginTop: 2 }}>
                      {g.categoria}{g.fijo ? " · fijo mensual" : (g.cuotas > 1 ? ` · cuota ${g.cuotaActual}/${g.cuotas}` : "")}{g.fecha ? ` · ${fmtFecha(g.fecha)}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{fmt(g.cuotaMensual, g.moneda)}</div>
                      {!g.fijo && g.cuotas > 1 && <div style={{ fontSize: 11, color: nude.textMuted }}>total {fmt(g.monto, g.moneda)}</div>}
                    </div>
                    {confirmDeleteItemId === g.id ? (
                      g.fijo ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="gst-btn-ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setConfirmDeleteItemId(null)}>no</button>
                            <button className="gst-btn-ghost" style={{ padding: "5px 10px", fontSize: 11 }}
                              onClick={() => { darDeBajaSeed(activeTarjeta, g.seedId, g.seedMonth, addMonths(currentMonth, -1)); setConfirmDeleteItemId(null); }}>dar de baja</button>
                            <button className="gst-btn" style={{ padding: "5px 10px", fontSize: 11, background: "#7A4A2E" }}
                              onClick={() => { removeSeed(activeTarjeta, g.seedId, g.seedMonth); setConfirmDeleteItemId(null); }}>borrar todo</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="gst-btn-ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setConfirmDeleteItemId(null)}>no</button>
                          <button className="gst-btn" style={{ padding: "5px 10px", fontSize: 11, background: "#7A4A2E" }}
                            onClick={() => { removeSeed(activeTarjeta, g.seedId, g.seedMonth); setConfirmDeleteItemId(null); }}>sí, borrar</button>
                        </div>
                      )
                    ) : (
                      <button className="gst-x" onClick={() => setConfirmDeleteItemId(g.id)}>×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {showAddTarjeta
              ? <AddTarjetaForm onAdd={d => { addSeed(activeTarjeta, d); setShowAddTarjeta(false); }} onCancel={() => setShowAddTarjeta(false)} nude={nude} />
              : <button className="gst-btn" style={{ width: "100%" }} onClick={() => setShowAddTarjeta(true)}>+ agregar gasto de tarjeta</button>}
          </>
        )}

        {/* DIGITAL / EFECTIVO */}
        {(activeTab === "digital" || activeTab === "efectivo") && (
          <MovimientosSection
            movs={activeTab === "digital" ? digitalMovs : efectivoMovs}
            totales={activeTab === "digital" ? totDigital : totEfectivo}
            seccion={activeTab}
            showAdd={activeTab === "digital" ? showAddDigital : showAddEfectivo}
            setShowAdd={activeTab === "digital" ? setShowAddDigital : setShowAddEfectivo}
            onAdd={item => addMovimiento(activeTab, item)}
            onRemove={id => removeMovimiento(activeTab, id)}
            nude={nude}
          />
        )}

        {/* RESUMEN */}
        {activeTab === "resumen" && (
          <ResumenSection resumen={resumen} monthLabel={monthLabel} last6={last6Months} nude={nude} />
        )}
      </div>
    </div>
  );
}

function LimiteInput({ defaultValue, onSave, nude }) {
  const [val, setVal] = useState(defaultValue || "");
  return (
    <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
      <input className="gst-input" type="number" placeholder="Límite de la tarjeta (en pesos)" value={val} onChange={e => setVal(e.target.value)} />
      <button className="gst-btn" style={{ padding: "10px 16px" }} onClick={() => onSave(Number(val) || 0)}>OK</button>
    </div>
  );
}

function AddTarjetaForm({ onAdd, onCancel, nude }) {
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState(CATS_TARJETA[0]);
  const [moneda, setMoneda] = useState("ARS");
  const [fecha, setFecha] = useState(todayISO());
  const [tipoCarga, setTipoCarga] = useState("unico");
  const [cuotas, setCuotas] = useState(2);

  function handleSubmit() {
    const montoNum = Number(monto);
    if (!nombre.trim() || !montoNum || montoNum <= 0) return;
    if (tipoCarga === "fijo") {
      onAdd({ nombre: nombre.trim(), categoria, monto: montoNum, moneda, fecha, cuotas: 1, cuotaMensual: montoNum, fijo: true });
      return;
    }
    const nc = tipoCarga === "cuotas" ? Math.max(2, Math.round(Number(cuotas))) : 1;
    onAdd({ nombre: nombre.trim(), categoria, monto: montoNum, moneda, fecha, cuotas: nc, cuotaMensual: Math.round((montoNum / nc) * 100) / 100 });
  }

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${nude.border}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <input className="gst-input" placeholder="¿Qué compraste?" value={nombre} onChange={e => setNombre(e.target.value)} />
      <div style={{ display: "flex", gap: 10 }}>
        <input className="gst-input" type="number" placeholder="Monto total" value={monto} onChange={e => setMonto(e.target.value)} />
        <input className="gst-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <select className="gst-input" value={categoria} onChange={e => setCategoria(e.target.value)}>
          {CATS_TARJETA.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="gst-input" value={moneda} onChange={e => setMoneda(e.target.value)}>
          {MONEDAS.map(m => <option key={m.code} value={m.code}>{m.sym} {m.label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 4, background: nude.accentLight, borderRadius: 999, padding: 4 }}>
        {[{ id: "unico", label: "Único" }, { id: "cuotas", label: "En cuotas" }, { id: "fijo", label: "Fijo mensual" }].map(o => (
          <div key={o.id} onClick={() => setTipoCarga(o.id)}
            style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: tipoCarga === o.id ? nude.accent : "transparent", color: tipoCarga === o.id ? "#fff" : nude.accentDark }}>
            {o.label}
          </div>
        ))}
      </div>
      {tipoCarga === "cuotas" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: nude.textMuted }}>Cantidad de cuotas</span>
          <input className="gst-input" type="number" min={2} value={cuotas} onChange={e => setCuotas(e.target.value)} style={{ width: 70 }} />
          {monto && Number(cuotas) >= 2 && (
            <span style={{ fontSize: 12.5, color: nude.accentDark, fontWeight: 700 }}>≈ {fmt(Number(monto) / Number(cuotas), moneda)}/mes</span>
          )}
        </div>
      )}
      {tipoCarga === "fijo" && (
        <p style={{ fontSize: 12.5, color: nude.textMuted, margin: 0 }}>
          Este monto se va a repetir automáticamente cada mes desde {fecha ? fmtFecha(fecha) : "hoy"} en adelante, hasta que lo des de baja.
        </p>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button className="gst-btn-ghost" style={{ flex: 1 }} onClick={onCancel}>cancelar</button>
        <button className="gst-btn" style={{ flex: 1 }} onClick={handleSubmit}>guardar</button>
      </div>
    </div>
  );
}

function MovimientosSection({ movs, totales, seccion, showAdd, setShowAdd, onAdd, onRemove, nude }) {
  const label = seccion === "digital" ? "movimiento digital" : "movimiento en efectivo";
  const [confirmId, setConfirmId] = useState(null);
  const monedas = Object.keys(totales);
  return (
    <>
      <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${nude.borderSoft}`, padding: "18px 20px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {monedas.length === 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 700 }}>INGRESOS</div><div style={{ fontSize: 16, fontWeight: 700, color: "#3B6D11", marginTop: 3 }}>{fmt(0)}</div></div>
            <div><div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 700 }}>GASTOS</div><div style={{ fontSize: 16, fontWeight: 700, color: "#7A4A2E", marginTop: 3 }}>{fmt(0)}</div></div>
            <div><div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 700 }}>SALDO</div><div style={{ fontSize: 16, fontWeight: 700, color: nude.accentDark, marginTop: 3 }}>{fmt(0)}</div></div>
          </div>
        ) : monedas.map(mon => (
          <div key={mon}>
            {monedas.length > 1 && <div style={{ fontSize: 11, color: nude.textMuted, fontWeight: 700, marginBottom: 6 }}>{mon}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 700 }}>INGRESOS</div><div style={{ fontSize: 16, fontWeight: 700, color: "#3B6D11", marginTop: 3 }}>{fmt(totales[mon].ingresos, mon)}</div></div>
              <div><div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 700 }}>GASTOS</div><div style={{ fontSize: 16, fontWeight: 700, color: "#7A4A2E", marginTop: 3 }}>{fmt(totales[mon].gastos, mon)}</div></div>
              <div><div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 700 }}>SALDO</div><div style={{ fontSize: 16, fontWeight: 700, color: nude.accentDark, marginTop: 3 }}>{fmt(totales[mon].saldo, mon)}</div></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {movs.length === 0 && <p style={{ textAlign: "center", color: nude.textMuted, fontSize: 13.5, padding: "20px 0" }}>Todavía no agregaste {label}s este mes ✿</p>}
        {movs.map(m => (
          <div className="gst-row" key={m.id}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.nombre}</div>
              <div style={{ fontSize: 12, color: nude.textMuted, marginTop: 2 }}>{m.categoria}{m.fecha ? ` · ${fmtFecha(m.fecha)}` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: m.tipo === "ingreso" ? "#3B6D11" : nude.text }}>
                {m.tipo === "ingreso" ? "+" : "-"}{fmt(m.monto, m.moneda)}
              </div>
              {confirmId === m.id ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="gst-btn-ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setConfirmId(null)}>no</button>
                  <button className="gst-btn" style={{ padding: "5px 10px", fontSize: 11, background: "#7A4A2E" }}
                    onClick={() => { onRemove(m.id); setConfirmId(null); }}>sí, borrar</button>
                </div>
              ) : (
                <button className="gst-x" onClick={() => setConfirmId(m.id)}>×</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {showAdd
        ? <AddMovForm onAdd={item => { onAdd(item); setShowAdd(false); }} onCancel={() => setShowAdd(false)} nude={nude} />
        : <button className="gst-btn" style={{ width: "100%" }} onClick={() => setShowAdd(true)}>+ agregar {label}</button>}
    </>
  );
}

function AddMovForm({ onAdd, onCancel, nude }) {
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [tipo, setTipo] = useState("gasto");
  const [categoria, setCategoria] = useState(CATS_GASTO[0]);
  const [moneda, setMoneda] = useState("ARS");
  const [fecha, setFecha] = useState(todayISO());
  const cats = tipo === "ingreso" ? CATS_INGRESO : CATS_GASTO;
  useEffect(() => { setCategoria(tipo === "ingreso" ? CATS_INGRESO[0] : CATS_GASTO[0]); }, [tipo]);

  function handleSubmit() {
    const montoNum = Number(monto);
    if (!nombre.trim() || !montoNum || montoNum <= 0) return;
    onAdd({ id: uid(), nombre: nombre.trim(), categoria, monto: montoNum, moneda, fecha, tipo });
  }

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${nude.border}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 4, background: nude.accentLight, borderRadius: 999, padding: 4 }}>
        {["gasto", "ingreso"].map(t => (
          <div key={t} onClick={() => setTipo(t)} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", background: tipo === t ? nude.accent : "transparent", color: tipo === t ? "#fff" : nude.accentDark }}>{t}</div>
        ))}
      </div>
      <input className="gst-input" placeholder="Descripción" value={nombre} onChange={e => setNombre(e.target.value)} />
      <div style={{ display: "flex", gap: 10 }}>
        <input className="gst-input" type="number" placeholder="Monto" value={monto} onChange={e => setMonto(e.target.value)} />
        <input className="gst-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <select className="gst-input" value={categoria} onChange={e => setCategoria(e.target.value)}>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="gst-input" value={moneda} onChange={e => setMoneda(e.target.value)}>
          {MONEDAS.map(m => <option key={m.code} value={m.code}>{m.sym} {m.label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button className="gst-btn-ghost" style={{ flex: 1 }} onClick={onCancel}>cancelar</button>
        <button className="gst-btn" style={{ flex: 1 }} onClick={handleSubmit}>guardar</button>
      </div>
    </div>
  );
}

function ResumenSection({ resumen, monthLabel, last6, nude }) {
  const monedas = Object.keys(resumen);
  const principal = monedas.includes("ARS") ? "ARS" : monedas[0];
  const rPrincipal = resumen[principal] || { totalGastos: 0, totalIngresos: 0, porTarjeta: 0, porDigital: 0, porEfectivo: 0 };
  const saldoPrincipal = rPrincipal.totalIngresos - rPrincipal.totalGastos;
  const maxVal = Math.max(...last6.map(m => Math.max(m.gastos, m.ingresos)), 1);
  const breakdown = [
    { label: "Tarjeta", monto: rPrincipal.porTarjeta, color: "#8B5E3C" },
    { label: "Digital", monto: rPrincipal.porDigital, color: "#B08968" },
    { label: "Efectivo", monto: rPrincipal.porEfectivo, color: "#D9C4AE" },
  ].filter(b => b.monto > 0);
  const otrasMonedas = monedas.filter(m => m !== principal);

  return (
    <>
      <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${nude.borderSoft}`, padding: "20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: nude.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 12 }}>ESTE MES · {monthLabel.toUpperCase()}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div><div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 600 }}>TOTAL GASTADO</div><div style={{ fontSize: 22, fontWeight: 700, color: nude.accentDark, marginTop: 4 }}>{fmt(rPrincipal.totalGastos, principal)}</div></div>
          <div><div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 600 }}>TOTAL INGRESOS</div><div style={{ fontSize: 22, fontWeight: 700, color: "#3B6D11", marginTop: 4 }}>{fmt(rPrincipal.totalIngresos, principal)}</div></div>
        </div>
        <div style={{ borderTop: `1px solid ${nude.borderSoft}`, paddingTop: 14 }}>
          <div style={{ fontSize: 11.5, color: nude.textMuted, fontWeight: 600, marginBottom: 4 }}>BALANCE DEL MES</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: saldoPrincipal >= 0 ? "#3B6D11" : "#7A4A2E" }}>{saldoPrincipal >= 0 ? "+" : ""}{fmt(saldoPrincipal, principal)}</div>
          <div style={{ fontSize: 12, color: nude.textMuted, marginTop: 4 }}>{saldoPrincipal >= 0 ? "¡Vas bien, te sobró platita este mes ✿" : "Este mes gastaste más de lo que entró"}</div>
        </div>
        {otrasMonedas.length > 0 && (
          <div style={{ borderTop: `1px solid ${nude.borderSoft}`, marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: nude.textMuted, fontWeight: 700 }}>OTRAS MONEDAS</div>
            {otrasMonedas.map(mon => {
              const r = resumen[mon];
              const s = r.totalIngresos - r.totalGastos;
              return (
                <div key={mon} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{mon}</span>
                  <span>gastado {fmt(r.totalGastos, mon)} · balance {fmt(s, mon)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {breakdown.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${nude.borderSoft}`, padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: nude.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 14 }}>GASTOS POR BOLSILLO ({principal})</div>
          {breakdown.map(b => (
            <div key={b.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                <span style={{ fontWeight: 600 }}>{b.label}</span>
                <span style={{ fontWeight: 700, color: nude.accentDark }}>{fmt(b.monto, principal)}</span>
              </div>
              <div className="gst-bar-bg">
                <div className="gst-bar-fill" style={{ width: `${rPrincipal.totalGastos > 0 ? Math.round((b.monto / rPrincipal.totalGastos) * 100) : 0}%`, background: b.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${nude.borderSoft}`, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: nude.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>ÚLTIMOS 6 MESES (PESOS)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: nude.textMuted }}><div style={{ width: 10, height: 10, borderRadius: 3, background: "#8B5E3C" }} /> Gastos</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: nude.textMuted }}><div style={{ width: 10, height: 10, borderRadius: 3, background: "#3B6D11" }} /> Ingresos</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
          {last6.map((m, i) => {
            const hG = maxVal > 0 ? Math.round((m.gastos / maxVal) * 100) : 0;
            const hI = maxVal > 0 ? Math.round((m.ingresos / maxVal) * 100) : 0;
            const isCurrent = i === last6.length - 1;
            return (
              <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 100 }}>
                  <div style={{ flex: 1, background: isCurrent ? "#8B5E3C" : "#E4D3BF", borderRadius: "4px 4px 0 0", height: `${hG}%`, minHeight: m.gastos > 0 ? 4 : 0 }} />
                  <div style={{ flex: 1, background: isCurrent ? "#3B6D11" : "#8BBF6A", borderRadius: "4px 4px 0 0", height: `${hI}%`, minHeight: m.ingresos > 0 ? 4 : 0 }} />
                </div>
                <div style={{ fontSize: 10, color: isCurrent ? nude.accentDark : nude.textMuted, fontWeight: isCurrent ? 700 : 500 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        {last6.every(m => m.gastos === 0 && m.ingresos === 0) && (
          <p style={{ textAlign: "center", color: nude.textMuted, fontSize: 13, marginTop: 8 }}>Todavía no hay datos para mostrar ✿</p>
        )}
      </div>
    </>
  );
}