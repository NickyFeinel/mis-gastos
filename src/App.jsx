import { useState, useEffect, useMemo, useCallback } from "react";

const CATEGORIAS_TARJETA = ["Moda y Belleza","Servicios","Salud","Hogar","Otro"];
const CATEGORIAS_GASTO = ["Comida","Transporte","Salidas","Moda y Belleza","Salud","Servicios","Caprichos","Regalo","Otro"];
const CATEGORIAS_INGRESO = ["Sueldo","Devolución","Venta","Regalo","Otro ingreso"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TAB_ICONS = {
  tarjeta: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  digital: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>
    </svg>
  ),
  efectivo: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>
    </svg>
  ),
  resumen: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
};

const TABS = [
  { id: "tarjeta", label: "Tarjeta" },
  { id: "digital", label: "Digital" },
  { id: "efectivo", label: "Efectivo" },
];

function formatARS(n) {
  const value = Number.isFinite(n) ? n : 0;
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function emptyMonthData() { return { limite: 0, tarjeta: [], digital: [], efectivo: [] }; }

export default function GastosApp() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(monthKey(today));
  const [allData, setAllData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("tarjeta");
  const [showAddTarjeta, setShowAddTarjeta] = useState(false);
  const [showAddDigital, setShowAddDigital] = useState(false);
  const [showAddEfectivo, setShowAddEfectivo] = useState(false);
  const [showLimite, setShowLimite] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await window.storage.get("gastos-data");
        if (!cancelled && result && result.value) setAllData(JSON.parse(result.value));
      } catch (e) {}
      finally { if (!cancelled) setLoaded(true); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(async () => {
      try { const res = await window.storage.set("gastos-data", JSON.stringify(allData)); setSaveError(!res); }
      catch (e) { setSaveError(true); }
    }, 400);
    return () => clearTimeout(timeout);
  }, [allData, loaded]);

  const monthData = allData[currentMonth] || emptyMonthData();
  const updateMonth = useCallback((key, updater) => {
    setAllData((prev) => { const base = prev[key] || emptyMonthData(); return { ...prev, [key]: updater(base) }; });
  }, []);

  const [year, month] = currentMonth.split("-").map(Number);
  const monthLabel = `${MESES[month - 1]} ${year}`;
  function shiftMonth(delta) { const d = new Date(year, month - 1 + delta, 1); setCurrentMonth(monthKey(d)); }

  const tarjetaGastos = monthData.tarjeta || [];
  const digitalMovs = monthData.digital || [];
  const efectivoMovs = monthData.efectivo || [];

  const totalTarjetaMes = useMemo(() => tarjetaGastos.reduce((acc, g) => acc + (g.cuotaMensual ?? g.monto), 0), [tarjetaGastos]);
  const disponible = (monthData.limite || 0) - totalTarjetaMes;
  const porcentajeUsado = monthData.limite > 0 ? Math.min(100, Math.round((totalTarjetaMes / monthData.limite) * 100)) : 0;
  const gastosPorCategoria = useMemo(() => {
    const map = {};
    tarjetaGastos.forEach((g) => { const monto = g.cuotaMensual ?? g.monto; map[g.categoria] = (map[g.categoria] || 0) + monto; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [tarjetaGastos]);

  function calcTotales(movs) {
    const ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
    const gastos = movs.filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.monto, 0);
    return { ingresos, gastos, saldo: ingresos - gastos };
  }
  const totDigital = useMemo(() => calcTotales(digitalMovs), [digitalMovs]);
  const totEfectivo = useMemo(() => calcTotales(efectivoMovs), [efectivoMovs]);

  // Datos para el resumen: últimos 6 meses
  const last6Months = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const key = monthKey(d);
      const data = allData[key] || emptyMonthData();
      const tarjetaTotal = (data.tarjeta || []).reduce((acc, g) => acc + (g.cuotaMensual ?? g.monto), 0);
      const digitalGastos = (data.digital || []).filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.monto, 0);
      const digitalIngresos = (data.digital || []).filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
      const efectivoGastos = (data.efectivo || []).filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.monto, 0);
      const efectivoIngresos = (data.efectivo || []).filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
      result.push({
        key,
        label: MESES[d.getMonth()].slice(0, 3),
        gastos: tarjetaTotal + digitalGastos + efectivoGastos,
        ingresos: digitalIngresos + efectivoIngresos,
      });
    }
    return result;
  }, [allData, year, month]);

  const resumenMesActual = useMemo(() => {
    const tarjetaTotal = tarjetaGastos.reduce((acc, g) => acc + (g.cuotaMensual ?? g.monto), 0);
    const digitalG = digitalMovs.filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.monto, 0);
    const digitalI = digitalMovs.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
    const efectivoG = efectivoMovs.filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.monto, 0);
    const efectivoI = efectivoMovs.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
    return {
      totalGastos: tarjetaTotal + digitalG + efectivoG,
      totalIngresos: digitalI + efectivoI,
      porTarjeta: tarjetaTotal,
      porDigital: digitalG,
      porEfectivo: efectivoG,
    };
  }, [tarjetaGastos, digitalMovs, efectivoMovs]);

  function addItem(section, data, setShow) {
    updateMonth(currentMonth, (base) => ({ ...base, [section]: [...(base[section] || []), { id: uid(), ...data }] }));
    setShow(false);
  }
  function removeItem(section, id) {
    updateMonth(currentMonth, (base) => ({ ...base, [section]: (base[section] || []).filter((g) => g.id !== id) }));
  }
  function setLimite(value) { updateMonth(currentMonth, (base) => ({ ...base, limite: value })); }

  const pink = {
    bg: "#FFF5F8", border: "#F4C0D1", borderSoft: "#FBEAF0",
    text: "#4B1528", textMuted: "#993556", accent: "#D4537E",
    accentDark: "#72243E", accentLight: "#FBEAF0",
  };

  return (
    <div style={{ fontFamily: "'Quicksand', sans-serif", background: pink.bg, minHeight: "100vh", padding: "28px 18px 60px", color: pink.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .gst-input { border: 1.5px solid ${pink.border}; border-radius: 14px; padding: 10px 14px; font-family: inherit; font-size: 14px; background: #fff; color: ${pink.text}; outline: none; width: 100%; }
        .gst-input:focus { border-color: ${pink.accent}; }
        .gst-btn { background: ${pink.accent}; color: #fff; border: none; border-radius: 999px; padding: 11px 22px; font-family: inherit; font-weight: 700; font-size: 14px; cursor: pointer; transition: transform 0.12s ease, background 0.12s ease; }
        .gst-btn:hover { background: ${pink.accentDark}; }
        .gst-btn:active { transform: scale(0.97); }
        .gst-btn-ghost { background: #fff; color: ${pink.accent}; border: 1.5px solid ${pink.border}; border-radius: 999px; padding: 9px 18px; font-family: inherit; font-weight: 700; font-size: 13px; cursor: pointer; }
        .gst-btn-ghost:hover { background: ${pink.accentLight}; }
        .gst-tab { flex: 1; text-align: center; padding: 9px 0; border-radius: 999px; font-weight: 700; font-size: 12px; cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .gst-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 16px; background: #fff; border: 1px solid ${pink.borderSoft}; }
        .gst-x { background: none; border: none; color: ${pink.textMuted}; opacity: 0.5; cursor: pointer; font-size: 16px; padding: 4px; line-height: 1; }
        .gst-x:hover { opacity: 1; color: ${pink.accentDark}; }
        select.gst-input { appearance: none; }
        .gst-bar-bg { width: 100%; height: 10px; border-radius: 999px; background: ${pink.accentLight}; overflow: hidden; }
        .gst-bar-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
        .gst-card { background: #fff; border-radius: 20px; border: 1px solid ${pink.borderSoft}; padding: 18px 20px; margin-bottom: 16px; }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ position: "relative", textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 26, marginBottom: 2 }}>✿</div>
          <h1 style={{ fontWeight: 700, fontSize: 24, margin: 0, color: pink.accentDark }}>Mis gastos</h1>
          <p style={{ fontSize: 13, color: pink.textMuted, margin: "4px 0 0" }}>todo bajo control, mes a mes</p>
          <button
            onClick={() => setActiveTab(activeTab === "resumen" ? "tarjeta" : "resumen")}
            aria-label="Ver resumen"
            style={{
              position: "absolute", top: 0, right: 0,
              background: activeTab === "resumen" ? pink.accent : "#fff",
              border: `1.5px solid ${pink.border}`,
              borderRadius: 999, width: 38, height: 38,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: activeTab === "resumen" ? "#fff" : pink.accent,
              fontSize: 18,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </button>
        </div>

        {/* Selector de mes — se oculta en Resumen */}
        {activeTab !== "resumen" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1.5px solid ${pink.border}`, borderRadius: 999, padding: "8px 18px", marginBottom: 20 }}>
            <button onClick={() => shiftMonth(-1)} style={{ background: "none", border: "none", color: pink.accent, fontSize: 20, cursor: "pointer", fontWeight: 700, lineHeight: 1 }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 15, color: pink.accentDark }}>{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} style={{ background: "none", border: "none", color: pink.accent, fontSize: 20, cursor: "pointer", fontWeight: 700, lineHeight: 1 }}>›</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", background: pink.accentLight, borderRadius: 999, padding: 4, marginBottom: 20, gap: 4 }}>
          {TABS.map((t) => (
            <div key={t.id} className="gst-tab" onClick={() => setActiveTab(t.id)}
              style={{ background: activeTab === t.id ? pink.accent : "transparent", color: activeTab === t.id ? "#fff" : pink.accentDark }}>
              {TAB_ICONS[t.id]}
              {t.label}
            </div>
          ))}
        </div>

        {/* TARJETA */}
        {activeTab === "tarjeta" && (
          <>
            <div className="gst-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: pink.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>GASTADO ESTE MES</span>
                <button className="gst-btn-ghost" onClick={() => setShowLimite(!showLimite)} style={{ fontSize: 11, padding: "5px 12px" }}>
                  {monthData.limite > 0 ? "editar límite" : "poner límite"}
                </button>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: pink.accentDark }}>{formatARS(totalTarjetaMes)}</div>
              {showLimite && (
                <div style={{ marginTop: 12 }}>
                  <input className="gst-input" type="number" placeholder="Límite de la tarjeta" defaultValue={monthData.limite || ""} onBlur={(e) => setLimite(Number(e.target.value) || 0)} />
                </div>
              )}
              {monthData.limite > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="gst-bar-bg">
                    <div className="gst-bar-fill" style={{ width: `${porcentajeUsado}%`, background: porcentajeUsado > 90 ? "#D4537E" : "#ED93B1" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12.5, color: pink.textMuted }}>
                    <span>{porcentajeUsado}% usado</span>
                    <span style={{ fontWeight: 700, color: disponible < 0 ? "#993C1D" : pink.accentDark }}>disponible {formatARS(disponible)}</span>
                  </div>
                </div>
              )}
            </div>

            {gastosPorCategoria.length > 0 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18, paddingBottom: 2 }}>
                {gastosPorCategoria.map(([cat, monto]) => (
                  <div key={cat} style={{ flexShrink: 0, background: pink.accentLight, borderRadius: 14, padding: "8px 14px", fontSize: 12 }}>
                    <div style={{ color: pink.textMuted, marginBottom: 2 }}>{cat}</div>
                    <div style={{ fontWeight: 700, color: pink.accentDark }}>{formatARS(monto)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {tarjetaGastos.length === 0 && <p style={{ textAlign: "center", color: pink.textMuted, fontSize: 13.5, padding: "20px 0" }}>Todavía no agregaste gastos de tarjeta este mes ✿</p>}
              {tarjetaGastos.map((g) => (
                <div className="gst-row" key={g.id}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{g.nombre}</div>
                    <div style={{ fontSize: 12, color: pink.textMuted, marginTop: 2 }}>{g.categoria}{g.cuotas > 1 ? ` · cuota ${g.cuotaActual || 1}/${g.cuotas}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{formatARS(g.cuotaMensual ?? g.monto)}</div>
                      {g.cuotas > 1 && <div style={{ fontSize: 11, color: pink.textMuted }}>total {formatARS(g.monto)}</div>}
                    </div>
                    <button className="gst-x" onClick={() => removeItem("tarjeta", g.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
            {showAddTarjeta
              ? <AddTarjetaForm onAdd={(d) => addItem("tarjeta", d, setShowAddTarjeta)} onCancel={() => setShowAddTarjeta(false)} pink={pink} />
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
            onAdd={(d) => addItem(activeTab, d, activeTab === "digital" ? setShowAddDigital : setShowAddEfectivo)}
            onRemove={(id) => removeItem(activeTab, id)}
            pink={pink}
          />
        )}

        {/* RESUMEN */}
        {activeTab === "resumen" && (
          <ResumenSection
            resumen={resumenMesActual}
            monthLabel={monthLabel}
            last6={last6Months}
            pink={pink}
          />
        )}

        {saveError && <p style={{ textAlign: "center", fontSize: 11.5, color: "#993C1D", marginTop: 16 }}>No se pudo guardar el último cambio ✿</p>}
      </div>
    </div>
  );
}

function ResumenSection({ resumen, monthLabel, last6, pink }) {
  const saldo = resumen.totalIngresos - resumen.totalGastos;
  const maxVal = Math.max(...last6.map((m) => Math.max(m.gastos, m.ingresos)), 1);

  const breakdown = [
    { label: "Tarjeta", monto: resumen.porTarjeta, color: "#D4537E" },
    { label: "Digital", monto: resumen.porDigital, color: "#B07CC6" },
    { label: "Efectivo", monto: resumen.porEfectivo, color: "#E8A0BF" },
  ].filter((b) => b.monto > 0);

  return (
    <>
      {/* Tarjeta resumen del mes */}
      <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${pink.borderSoft}`, padding: "20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: pink.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 12 }}>
          ESTE MES · {monthLabel.toUpperCase()}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11.5, color: pink.textMuted, fontWeight: 600 }}>TOTAL GASTADO</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: pink.accentDark, marginTop: 4 }}>{formatARS(resumen.totalGastos)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: pink.textMuted, fontWeight: 600 }}>TOTAL INGRESOS</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#3B6D11", marginTop: 4 }}>{formatARS(resumen.totalIngresos)}</div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${pink.borderSoft}`, paddingTop: 14 }}>
          <div style={{ fontSize: 11.5, color: pink.textMuted, fontWeight: 600, marginBottom: 4 }}>BALANCE DEL MES</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: saldo >= 0 ? "#3B6D11" : "#993C1D" }}>
            {saldo >= 0 ? "+" : ""}{formatARS(saldo)}
          </div>
          <div style={{ fontSize: 12, color: pink.textMuted, marginTop: 4 }}>
            {saldo >= 0 ? "¡Vas bien, te sobró platita este mes ✿" : "Este mes gastaste más de lo que entró"}
          </div>
        </div>
      </div>

      {/* Desglose por bolsillo */}
      {breakdown.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${pink.borderSoft}`, padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: pink.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 14 }}>GASTOS POR BOLSILLO</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {breakdown.map((b) => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: pink.text }}>{b.label}</span>
                  <span style={{ fontWeight: 700, color: pink.accentDark }}>{formatARS(b.monto)}</span>
                </div>
                <div className="gst-bar-bg">
                  <div className="gst-bar-fill" style={{ width: `${Math.round((b.monto / resumen.totalGastos) * 100)}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico últimos 6 meses */}
      <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${pink.borderSoft}`, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: pink.textMuted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>ÚLTIMOS 6 MESES</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: pink.textMuted }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: "#D4537E" }} /> Gastos
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: pink.textMuted }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: "#3B6D11" }} /> Ingresos
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
          {last6.map((m) => {
            const hGastos = maxVal > 0 ? Math.round((m.gastos / maxVal) * 100) : 0;
            const hIngresos = maxVal > 0 ? Math.round((m.ingresos / maxVal) * 100) : 0;
            const isCurrent = m.key === last6[5].key;
            return (
              <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 100 }}>
                  <div style={{ flex: 1, background: isCurrent ? "#D4537E" : "#EDACC2", borderRadius: "4px 4px 0 0", height: `${hGastos}%`, minHeight: m.gastos > 0 ? 4 : 0, transition: "height 0.3s ease" }} />
                  <div style={{ flex: 1, background: isCurrent ? "#3B6D11" : "#8BBF6A", borderRadius: "4px 4px 0 0", height: `${hIngresos}%`, minHeight: m.ingresos > 0 ? 4 : 0, transition: "height 0.3s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: isCurrent ? pink.accentDark : pink.textMuted, fontWeight: isCurrent ? 700 : 500 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        {last6.every((m) => m.gastos === 0 && m.ingresos === 0) && (
          <p style={{ textAlign: "center", color: pink.textMuted, fontSize: 13, marginTop: 8 }}>Todavía no hay datos para mostrar ✿</p>
        )}
      </div>
    </>
  );
}

function MovimientosSection({ movs, totales, seccion, showAdd, setShowAdd, onAdd, onRemove, pink }) {
  const label = seccion === "digital" ? "movimiento digital" : "movimiento en efectivo";
  return (
    <>
      <div style={{ background: "#fff", borderRadius: 20, border: `1px solid #FBEAF0`, padding: "18px 20px", marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div><div style={{ fontSize: 11.5, color: "#993556", fontWeight: 700 }}>INGRESOS</div><div style={{ fontSize: 16, fontWeight: 700, color: "#3B6D11", marginTop: 3 }}>{formatARS(totales.ingresos)}</div></div>
        <div><div style={{ fontSize: 11.5, color: "#993556", fontWeight: 700 }}>GASTOS</div><div style={{ fontSize: 16, fontWeight: 700, color: "#993C1D", marginTop: 3 }}>{formatARS(totales.gastos)}</div></div>
        <div><div style={{ fontSize: 11.5, color: "#993556", fontWeight: 700 }}>SALDO</div><div style={{ fontSize: 16, fontWeight: 700, color: "#72243E", marginTop: 3 }}>{formatARS(totales.saldo)}</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {movs.length === 0 && <p style={{ textAlign: "center", color: "#993556", fontSize: 13.5, padding: "20px 0" }}>Todavía no agregaste {label}s este mes ✿</p>}
        {movs.map((m) => (
          <div className="gst-row" key={m.id}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.nombre}</div>
              <div style={{ fontSize: 12, color: "#993556", marginTop: 2 }}>{m.categoria}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: m.tipo === "ingreso" ? "#3B6D11" : "#4B1528" }}>
                {m.tipo === "ingreso" ? "+" : "-"}{formatARS(m.monto)}
              </div>
              <button className="gst-x" onClick={() => onRemove(m.id)}>×</button>
            </div>
          </div>
        ))}
      </div>
      {showAdd
        ? <AddMovForm onAdd={onAdd} onCancel={() => setShowAdd(false)} pink={pink} />
        : <button className="gst-btn" style={{ width: "100%" }} onClick={() => setShowAdd(true)}>+ agregar {label}</button>}
    </>
  );
}

function AddTarjetaForm({ onAdd, onCancel, pink }) {
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_TARJETA[0]);
  const [esCuotas, setEsCuotas] = useState(false);
  const [cuotas, setCuotas] = useState(2);

  function handleSubmit() {
    const montoNum = Number(monto);
    if (!nombre.trim() || !montoNum || montoNum <= 0) return;
    const cuotasNum = esCuotas ? Math.max(2, Math.round(Number(cuotas))) : 1;
    onAdd({ nombre: nombre.trim(), categoria, monto: montoNum, cuotas: cuotasNum, cuotaMensual: cuotasNum > 1 ? Math.round((montoNum / cuotasNum) * 100) / 100 : undefined, cuotaActual: 1 });
  }

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${pink.border}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <input className="gst-input" placeholder="¿Qué compraste?" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <div style={{ display: "flex", gap: 10 }}>
        <input className="gst-input" type="number" placeholder="Monto total" value={monto} onChange={(e) => setMonto(e.target.value)} />
        <select className="gst-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS_TARJETA.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: pink.textMuted, cursor: "pointer" }}>
        <input type="checkbox" checked={esCuotas} onChange={(e) => setEsCuotas(e.target.checked)} style={{ width: 16, height: 16, accentColor: pink.accent }} />
        Lo pagué en cuotas
      </label>
      {esCuotas && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: pink.textMuted }}>Cantidad de cuotas</span>
          <input className="gst-input" type="number" min={2} value={cuotas} onChange={(e) => setCuotas(e.target.value)} style={{ width: 70 }} />
          {monto && Number(cuotas) >= 2 && (
            <span style={{ fontSize: 12.5, color: pink.accentDark, fontWeight: 700 }}>≈ {formatARS(Math.round(Number(monto) / Number(cuotas)))} / mes</span>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button className="gst-btn-ghost" style={{ flex: 1 }} onClick={onCancel}>cancelar</button>
        <button className="gst-btn" style={{ flex: 1 }} onClick={handleSubmit}>guardar</button>
      </div>
    </div>
  );
}

function AddMovForm({ onAdd, onCancel, pink }) {
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [tipo, setTipo] = useState("gasto");
  const [categoria, setCategoria] = useState(CATEGORIAS_GASTO[0]);
  const cats = tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;
  useEffect(() => { setCategoria(tipo === "ingreso" ? CATEGORIAS_INGRESO[0] : CATEGORIAS_GASTO[0]); }, [tipo]);

  function handleSubmit() {
    const montoNum = Number(monto);
    if (!nombre.trim() || !montoNum || montoNum <= 0) return;
    onAdd({ nombre: nombre.trim(), categoria, monto: montoNum, tipo });
  }

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${pink.border}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 4, background: pink.accentLight, borderRadius: 999, padding: 4 }}>
        {["gasto", "ingreso"].map((t) => (
          <div key={t} onClick={() => setTipo(t)} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", background: tipo === t ? pink.accent : "transparent", color: tipo === t ? "#fff" : pink.accentDark }}>{t}</div>
        ))}
      </div>
      <input className="gst-input" placeholder="Descripción" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <div style={{ display: "flex", gap: 10 }}>
        <input className="gst-input" type="number" placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
        <select className="gst-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button className="gst-btn-ghost" style={{ flex: 1 }} onClick={onCancel}>cancelar</button>
        <button className="gst-btn" style={{ flex: 1 }} onClick={handleSubmit}>guardar</button>
      </div>
    </div>
  );
}