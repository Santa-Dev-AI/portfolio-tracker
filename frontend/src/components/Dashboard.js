import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
                 '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
                 '#a855f7','#eab308','#64748b'];

const fmtEuro  = v => v == null ? '—' : v.toLocaleString('it-IT', { maximumFractionDigits:0 }) + '\u00a0€';
const fmtEuro2 = v => v == null ? '—' : v.toLocaleString('it-IT', { minimumFractionDigits:2, maximumFractionDigits:2 }) + '\u00a0€';
const fmtPct1  = v => v == null ? '—' : (v * 100).toFixed(1) + '%';
const fmtPct2  = v => v == null ? '—' : v.toFixed(2) + '%';

const BLUR_STYLE = { filter:'blur(6px)', userSelect:'none' };
const blurIf = (cond) => cond ? BLUR_STYLE : {};

function B({ children, active, style = {}, block = false }) {
  const Tag = block ? 'div' : 'span';
  return (
    <Tag
      data-privacy={active ? 'true' : undefined}
      style={{ ...style, ...blurIf(active), display: block ? 'block' : 'inline' }}
    >
      {children}
    </Tag>
  );
}

function labelStrumento(s) {
  if (s.isCash) return 'Cash';
  if (s.ticker && !s.ticker.startsWith('M.')) return s.ticker;
  if (s.descrizione) return s.descrizione.length > 18 ? s.descrizione.slice(0,18)+'…' : s.descrizione;
  return s.isin;
}

function calcolaPMC(s) {
  if (s.isCash || !s.quantitaAttuale || s.quantitaAttuale <= 0) return null;
  if (s.ticker?.startsWith('M.')) return (s.costoTotale / s.quantitaAttuale) * 100;
  return s.costoTotale / s.quantitaAttuale;
}

function plEuro(s) {
  if (s.isCash) return 0;
  const incassi = (s.valoreAttuale||0) + (s.ricaviTotali||0) + (s.cedoleTotali||0);
  const uscite  = (s.costoTotale||0)  + (s.commissioniTotali||0) + (s.tasseTotali||0);
  return incassi - uscite;
}

function plPct(s) {
  if (s.isCash || !s.costoTotale || s.costoTotale === 0) return null;
  return plEuro(s) / s.costoTotale;
}

// SVG maialino salvadanaio azzurro con foro monete in cima
function PigLogo({ size = 48 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size}>
      {/* Moneta azzurra stilizzata */}
      <circle cx="50" cy="50" r="46" fill="#1e40af" stroke="#3b82f6" strokeWidth="3"/>
      <circle cx="50" cy="50" r="38" fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.5"/>
      {/* Simbolo € */}
      <text x="50" y="66" textAnchor="middle" fontSize="44" fontWeight="bold"
            fontFamily="Georgia, serif" fill="#93c5fd">€</text>
    </svg>
  );
}

function Card({ title, value, sub, color, blurred }) {
  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:'20px 24px',
                  borderLeft:`4px solid ${color||'#3b82f6'}`, flex:1, minWidth:160 }}>
      <p style={{ color:'#94a3b8', fontSize:'0.75rem', marginBottom:6,
                  textTransform:'uppercase', letterSpacing:'0.5px' }}>{title}</p>
      <B active={blurred}>
        <p style={{ color:'#f1f5f9', fontSize:'1.5rem', fontWeight:700, margin:0 }}>{value}</p>
      </B>
      {sub && <p style={{ color:'#94a3b8', fontSize:'0.82rem', marginTop:4, fontWeight:500 }}>{sub}</p>}
    </div>
  );
}

function Sezione({ title, children }) {
  return (
    <div style={{ marginBottom:32 }}>
      <h2 style={{ color:'#7dd3fc', fontSize:'1rem', fontWeight:700,
                   borderBottom:'1px solid #1e293b', paddingBottom:8, marginBottom:16 }}>{title}</h2>
      {children}
    </div>
  );
}

function TooltipTorta({ active, payload, totale }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const pct = totale > 0 ? ((d.value/totale)*100).toFixed(1) : 0;
  return (
    <div style={{ background:'#1e293b', border:'1px solid #475569', borderRadius:8,
                  padding:'10px 14px', fontSize:'0.82rem', color:'#f1f5f9' }}>
      <p style={{ margin:0, fontWeight:700, color:'#7dd3fc' }}>{d.name}</p>
      <p style={{ margin:'4px 0 0', color:'#94a3b8' }}>{pct}% del portafoglio</p>
    </div>
  );
}

function TooltipBar({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background:'#1e293b', border:'1px solid #475569', borderRadius:8,
                  padding:'10px 14px', fontSize:'0.82rem', color:'#f1f5f9' }}>
      <p style={{ margin:0, fontWeight:700, color:'#7dd3fc' }}>{label}</p>
      <p style={{ margin:'4px 0 0', color: v>=0 ? '#10b981':'#ef4444' }}>P&L: {fmtEuro(v)}</p>
    </div>
  );
}

function Th({ label, colKey, sort, onSort, alignRight }) {
  const active = sort.key === colKey;
  return (
    <th onClick={() => onSort(colKey)}
        style={{ padding:'10px 14px', textAlign: alignRight?'right':'left',
                 color: active?'#7dd3fc':'#64748b', fontWeight:600,
                 whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }}>
      {label}
      <span style={{ marginLeft:4, opacity:active?1:0.35, fontSize:'0.7rem' }}>
        {active ? (sort.dir==='asc'?'▲':'▼') : '▲▼'}
      </span>
    </th>
  );
}

function PrivacyToggle({ privacy, setPrivacy }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ color:'#64748b', fontSize:'0.78rem' }}>🔒 Privacy</span>
      <div onClick={() => setPrivacy(p => !p)}
        style={{ width:40, height:22, borderRadius:11,
                 background: privacy?'#3b82f6':'#334155',
                 cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
        <div style={{ position:'absolute', top:3, left:privacy?21:3,
                      width:16, height:16, borderRadius:8, background:'#fff',
                      transition:'left 0.2s' }} />
      </div>
      <span style={{ color:privacy?'#7dd3fc':'#475569', fontSize:'0.75rem', fontWeight:600 }}>
        {privacy?'ON':'OFF'}
      </span>
    </div>
  );
}

async function scaricaScreenshot() {
  const { default: html2canvas } = await import('html2canvas');
  const root = document.getElementById('dashboard-root');
  const canvas = await html2canvas(root, {
    backgroundColor: '#0f1117',
    scale: 2,
    useCORS: true,
    allowTaint: true,
    width: root.scrollWidth,
    height: root.scrollHeight,
    windowWidth: root.scrollWidth,
    windowHeight: root.scrollHeight,
    onclone: (_doc, clonedEl) => {
      clonedEl.querySelectorAll('[data-privacy="true"]').forEach(el => {
        el.style.filter = 'none';
        el.style.color = '#475569';
        const replaceText = (node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = '●●●●●';
          } else {
            node.childNodes.forEach(replaceText);
          }
        };
        replaceText(el);
      });
    }
  });
  const link = document.createElement('a');
  link.download = `portfolio-${new Date().toISOString().slice(0,10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export default function Dashboard({ data, onReset }) {
  const [vistaAttiva, setVistaAttiva] = useState('globale');
  const [privacy, setPrivacy]         = useState(false);
  const { globale, strumenti } = data;
  const strumentoSel = strumenti.find(s => s.isin === vistaAttiva);

  return (
    <div id="dashboard-root" style={{ background:'#0f1117', minHeight:'100vh',
                                       fontFamily:'Segoe UI, sans-serif', color:'#e2e8f0' }}>
      <div style={{ background:'#0d1117', borderBottom:'1px solid #1e293b',
                    padding:'16px 32px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <PigLogo size={32} />
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'#7dd3fc', margin:0 }}>Portfolio Tracker</h1>
        {vistaAttiva !== 'globale' && (
          <>
            <span style={{ color:'#334155' }}>|</span>
            <button onClick={() => setVistaAttiva('globale')}
              style={{ background:'transparent', border:'none', color:'#94a3b8',
                       cursor:'pointer', fontSize:'0.85rem' }}>← Torna al portafoglio</button>

          </>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          <PrivacyToggle privacy={privacy} setPrivacy={setPrivacy} />
          <button onClick={scaricaScreenshot}
            style={{ background:'#1e293b', color:'#94a3b8', border:'1px solid #334155',
                     borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.8rem' }}>
            📷 Screenshot
          </button>
          <button onClick={onReset}
            style={{ background:'#1e293b', color:'#94a3b8', border:'1px solid #334155',
                     borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:'0.8rem' }}>
            ← Cambia file
          </button>
        </div>
      </div>

      <div style={{ padding:'28px 32px', maxWidth:1400, margin:'0 auto' }}>
        {vistaAttiva === 'globale'
          ? <VistaGlobale globale={globale} strumenti={strumenti}
                          onSelectStrumento={setVistaAttiva} privacy={privacy} />
          : vistaAttiva === 'chiusi'
          ? <VistaTradeChiusi strumenti={strumenti} onSelectStrumento={setVistaAttiva} privacy={privacy} />
          : <VistaStrumento strumento={strumentoSel} privacy={privacy} />
        }
      </div>
    </div>
  );
}

function VistaGlobale({ globale, strumenti, onSelectStrumento, privacy: p }) {
  const { capitaleInvestito, totaleCommissioni, totaleTasse,
          totaleCedole, totaleBollo, totaleCapitalGain, plRealizzatoTotale } = globale;

  const strumentiAttivi = strumenti.filter(s => s.isCash || s.quantitaAttuale > 0.001);
  const plGlobaleEuro   = globale.plTotale;
  // % su costo netto acquisto strumenti attivi (costoTotale - ricaviTotali)
  const costoNettoAttivi = strumentiAttivi.reduce(
    (acc, s) => acc + (s.isCash ? 0 : Math.max(0, (s.costoTotale||0) - (s.ricaviTotali||0))), 0
  );
  const plGlobalePct = costoNettoAttivi > 0 ? plGlobaleEuro / costoNettoAttivi : null;
  const irrGlobale      = globale.irrGlobale;

  const pieData = strumentiAttivi
    .map(s => ({ name:labelStrumento(s), value:s.valoreAttuale||s.costoTotale||0,
                 hasPrezzoAttuale:s.valoreAttuale!=null, isCash:s.isCash }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const totaleValore = pieData.reduce((a,d) => a+d.value, 0);

  const barData = strumenti
    .filter(s => !s.isCash && s.costoTotale > 0)
    .map(s => ({ name:labelStrumento(s), pl:Math.round(plEuro(s)) }))
    .sort((a,b) => b.pl - a.pl);

  const [sort, setSort] = useState({ key:'valore', dir:'desc' });
  const handleSort = key => setSort(prev => ({ key, dir:prev.key===key && prev.dir==='asc'?'desc':'asc' }));

  const getValue = (s, key) => {
    switch(key) {
      case 'ticker':      return (s.ticker||s.isin||'').toLowerCase();
      case 'isin':        return s.isin?.toLowerCase()||'';
      case 'descrizione': return (s.descrizione||'').toLowerCase();
      case 'qta':         return s.quantitaAttuale;
      case 'pmc':         return calcolaPMC(s)??-Infinity;
      case 'prezzoAtt':   return s.prezzoAttuale??-Infinity;
      case 'costo':       return s.costoTotale;
      case 'cedole':      return s.cedoleTotali;
      case 'commissioni': return s.commissioniTotali;
      case 'tasse':       return s.tasseTotali;
      case 'valore':      return s.valoreAttuale??-Infinity;
      case 'pl':          return plEuro(s);
      case 'irr':         return s.irr??-Infinity;
      default:            return 0;
    }
  };

  const sorted = [...strumentiAttivi].sort((a,b) => {
    if (a.isCash) return 1; if (b.isCash) return -1;
    const va=getValue(a,sort.key), vb=getValue(b,sort.key);
    if (typeof va==='string') return sort.dir==='asc'?va.localeCompare(vb):vb.localeCompare(va);
    return sort.dir==='asc'?va-vb:vb-va;
  });

  const colonne = [
    {label:'Ticker',           key:'ticker',      alignRight:false},
    {label:'ISIN',             key:'isin',        alignRight:false},
    {label:'Descrizione',      key:'descrizione', alignRight:false},
    {label:'Qtà',              key:'qta',         alignRight:true },
    {label:'PMC',              key:'pmc',         alignRight:true },
    {label:'Prezzo Att.',      key:'prezzoAtt',   alignRight:true },
    {label:'Costo Acq.',       key:'costo',       alignRight:true },
    {label:'Cedole/Dividendi', key:'cedole',      alignRight:true },
    {label:'Ritenute',         key:'tasse',       alignRight:true },
    {label:'Valore Attuale',   key:'valore',      alignRight:true },
    {label:'Plus/Minus',       key:'pl',          alignRight:true },
    {label:'IRR',              key:'irr',         alignRight:true },
  ];

  return (
    <>
      <Sezione title="Riepilogo Portafoglio">
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          <Card title="Capitale Investito Netto"    value={fmtEuro(capitaleInvestito)}               color="#3b82f6" blurred={p} />
          <Card title="Valore di Mercato Portafoglio" value={fmtEuro(globale.valoreAttualePortafoglio)} color="#10b981" blurred={p} />
          <Card title="Plus/Minus Non Realizzata"
                value={fmtEuro(plGlobaleEuro)}
                sub={plGlobalePct!=null ? fmtPct1(plGlobalePct)+' sul capitale investito' : undefined}
                color={plGlobaleEuro>=0?'#10b981':'#ef4444'} blurred={p} />
          <Card title="Plus/Minus Realizzata"
                value={fmtEuro(plRealizzatoTotale)}
                sub="su posizioni già chiuse"
                color={plRealizzatoTotale>=0?'#10b981':'#ef4444'} blurred={p} />
          <Card title="IRR Portafoglio" value={fmtPct1(irrGlobale)}
                sub="tasso interno di rendimento annualizzato"
                color={irrGlobale>0?'#10b981':irrGlobale<0?'#ef4444':'#64748b'} />
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <Card title="Liquidità sul Conto"           value={fmtEuro(globale.cashResiduo)}  color="#64748b" blurred={p} />
          <Card title="Cedole & Dividendi (lordo)"    value={fmtEuro(totaleCedole)}         color="#06b6d4" blurred={p} />
          <Card title="Ritenute su Cedole/Dividendi"  value={fmtEuro(totaleTasse)}          color="#ef4444" blurred={p} />
          <Card title="Imposta su Plusvalenze"        value={fmtEuro(totaleCapitalGain)}    color="#ef4444" blurred={p} />
          <Card title="Imposta di Bollo"              value={fmtEuro(totaleBollo)}          color="#94a3b8" blurred={p} />
          <Card title="Commissioni Negoziazione"      value={fmtEuro(totaleCommissioni)}    color="#f59e0b" blurred={p} />
        </div>
      </Sezione>

      <Sezione title="Asset Allocation (per valore di mercato)">
        <div style={{ background:'#1e293b', borderRadius:12, padding:20, display:'flex',
                      flexWrap:'wrap', gap:20, alignItems:'center', justifyContent:'center' }}>
          <PieChart width={300} height={300}>
            <Pie data={pieData} cx={145} cy={145} innerRadius={75} outerRadius={130}
                 dataKey="value" nameKey="name" paddingAngle={2}>
              {pieData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
            </Pie>
            <Tooltip content={p ? ()=>null : <TooltipTorta totale={totaleValore} />} />
          </PieChart>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pieData.map((d,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:12, height:12, borderRadius:2,
                              background:COLORS[i%COLORS.length], flexShrink:0 }} />
                <span style={{ fontSize:'0.78rem', color:d.isCash?'#64748b':'#cbd5e1',
                               fontStyle:d.isCash?'italic':'normal' }}>{d.name}</span>
                <B active={p} style={{ fontSize:'0.78rem', marginLeft:'auto', paddingLeft:16,
                               color:d.hasPrezzoAttuale||d.isCash?'#64748b':'#475569' }}>
                  {fmtEuro(d.value)}{!d.hasPrezzoAttuale&&!d.isCash&&' *'}
                </B>
              </div>
            ))}
            {pieData.some(d => !d.hasPrezzoAttuale&&!d.isCash) && (
              <p style={{ color:'#475569', fontSize:'0.7rem', margin:'4px 0 0' }}>* stimato al costo d'acquisto</p>
            )}
          </div>
        </div>
      </Sezione>

      <Sezione title="Plus/Minus per Strumento (tutti, inclusi venduti)">
        <div style={{ background:'#1e293b', borderRadius:12, padding:'20px 16px' }}>
          <p style={{ color:'#64748b', fontSize:'0.72rem', marginBottom:12 }}>
            Guadagno/perdita totale per strumento — include cedole, commissioni, ritenute e valore attuale
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top:8, right:16, left:16, bottom:48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill:'#64748b', fontSize:11 }}
                     tickFormatter={v => p ? '●●●' : `${(v/1000).toFixed(0)}k€`} />
              <Tooltip content={p ? ()=>null : <TooltipBar />} />
              <ReferenceLine y={0} stroke="#475569" />
              <Bar dataKey="pl" radius={[4,4,0,0]}>
                {barData.map((d,i) => <Cell key={i} fill={d.pl>=0?'#10b981':'#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Sezione>

      <Sezione title="Strumenti in Portafoglio — clicca sull'ISIN per il dettaglio">
        <div style={{ background:'#1e293b', borderRadius:12, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #334155' }}>
                {colonne.map(c => <Th key={c.key} label={c.label} colKey={c.key}
                    sort={sort} onSort={handleSort} alignRight={c.alignRight} />)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const pl    = plEuro(s);
                const pct   = plPct(s);
                const pmc   = calcolaPMC(s);
                const isObb = s.ticker?.startsWith('M.');
                const pmcFmt = v => isObb ? fmtPct2(v) : fmtEuro2(v);

                if (s.isCash) return (
                  <tr key="CASH" style={{ borderBottom:'1px solid #0f1117', background:'#162032' }}>
                    <td style={{ padding:'9px 14px', color:'#64748b', fontWeight:700, fontStyle:'italic' }}>CASH</td>
                    <td style={{ padding:'9px 14px', color:'#475569' }}>—</td>
                    <td style={{ padding:'9px 14px', color:'#64748b', fontStyle:'italic' }}>Liquidità sul conto</td>
                    <td style={{ padding:'9px 14px', textAlign:'right' }}>
                      <B active={p} style={{ color:'#64748b' }}>{fmtEuro(s.quantitaAttuale)}</B>
                    </td>
                    <td colSpan={5} style={{ padding:'9px 14px', textAlign:'center', color:'#475569' }}>—</td>
                    <td style={{ padding:'9px 14px', textAlign:'right' }}>
                      <B active={p} style={{ color:'#64748b' }}>{fmtEuro(s.valoreAttuale)}</B>
                    </td>
                    <td colSpan={2} style={{ padding:'9px 14px', textAlign:'center', color:'#475569' }}>—</td>
                  </tr>
                );

                return (
                  <tr key={s.isin} style={{ borderBottom:'1px solid #0f1117',
                                            background:i%2===0?'#1e293b':'#162032' }}>
                    <td style={{ padding:'9px 14px', color:'#7dd3fc', fontWeight:700 }}>{s.ticker||'—'}</td>
                    <td style={{ padding:'9px 14px' }}>
                      <span onClick={() => onSelectStrumento(s.isin)}
                        style={{ color:'#3b82f6', fontFamily:'monospace', fontSize:'0.75rem',
                                 cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>
                        {s.isin}
                      </span>
                    </td>
                    <td style={{ padding:'9px 14px', color:'#cbd5e1', maxWidth:200,
                                 overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.descrizione||labelStrumento(s)}
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right' }}>
                      <B active={p}>{s.quantitaAttuale%1===0 ? s.quantitaAttuale.toFixed(0) : s.quantitaAttuale.toFixed(4)}</B>
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right', color:'#94a3b8' }}>
                      {pmc!=null ? pmcFmt(pmc) : '—'}
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right', color:'#94a3b8' }}>
                      {s.prezzoAttuale!=null ? fmtEuro2(s.prezzoAttuale) : '—'}
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right' }}>
                      <B active={p}>{fmtEuro(s.costoTotale)}</B>
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right', color:'#06b6d4' }}>
                      <B active={p}>{fmtEuro(s.cedoleTotali)}</B>
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right', color:'#ef4444' }}>
                      <B active={p}>{fmtEuro(s.tasseTotali)}</B>
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right', color:'#a3e635' }}>
                      <B active={p}>{fmtEuro(s.valoreAttuale)}</B>
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:600,
                                 color:pl>=0?'#10b981':'#ef4444' }}>
                      {pct!=null ? (
                        <>
                          <div>{fmtPct1(pct)}</div>
                          <B active={p} style={{ fontSize:'0.7rem', fontWeight:400, opacity:0.8 }}>
                            {fmtEuro(pl)}
                          </B>
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700,
                                 color:s.irr>0?'#10b981':s.irr<0?'#ef4444':'#64748b' }}>
                      {fmtPct1(s.irr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Sezione>

      <div style={{ textAlign:'center', padding:'8px 0 24px' }}>
        <button
          onClick={() => onSelectStrumento('chiusi')}
          style={{ background:'transparent', border:'1px solid #334155',
                   color:'#7dd3fc', borderRadius:8, padding:'10px 28px',
                   cursor:'pointer', fontSize:'0.9rem', fontWeight:600,
                   letterSpacing:'0.02em' }}>
          Vedi tutti i trade chiusi →
        </button>
      </div>
    </>
  );
}

function VistaTradeChiusi({ strumenti, onSelectStrumento, privacy: p }) {
  const chiusi = strumenti.filter(s => !s.isCash && s.quantitaAttuale <= 0.001 && s.costoTotale > 0);
  console.log('Trade chiusi trovati:', chiusi.length);
  chiusi.forEach(s => console.log(s.ticker, '| qtaVenduta:', s.quantitaVenduta, '| costo:', s.costoTotale, '| ricavi:', s.ricaviTotali, '| plRealizzato:', s.plRealizzato));
  const [sort, setSort] = useState({ key:'pl', dir:'desc' });
  const handleSort = key => setSort(prev => ({ key, dir: prev.key===key && prev.dir==='asc'?'desc':'asc' }));

  const getValue = (s, key) => {
    if (key === 'pl')    return s.plRealizzato ?? -Infinity;
    if (key === 'costo') return s.costoTotale ?? 0;
    if (key === 'ricavi') return s.ricaviTotali ?? 0;
    if (key === 'cedole') return s.cedoleTotali ?? 0;
    if (key === 'tasse') return s.tasseTotali ?? 0;
    if (key === 'irr')   return s.irr ?? -Infinity;
    return 0;
  };

  const sorted = [...chiusi].sort((a, b) => {
    const va = getValue(a, sort.key), vb = getValue(b, sort.key);
    return sort.dir === 'asc' ? va - vb : vb - va;
  });

  const totPlRealizzato = chiusi.reduce((acc, s) => acc + (s.plRealizzato || 0), 0);

  const SortTh = ({ label, k }) => (
    <th onClick={() => handleSort(k)}
        style={{ padding:'10px 14px', textAlign:'right',
                 fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.5px',
                 cursor:'pointer', userSelect:'none', whiteSpace:'nowrap',
                 color: sort.key===k ? '#7dd3fc' : '#64748b' }}>
      {label}{sort.key===k ? (sort.dir==='asc'?' ▲':' ▼') : ' ▲▼'}
    </th>
  );

  return (
    <>
      <Sezione title="Trade Chiusi — posizioni liquidate">
        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <Card title="Posizioni chiuse" value={chiusi.length} color="#64748b" />
          <Card title="Plus/Minus Realizzata Totale"
                value={fmtEuro(totPlRealizzato)}
                color={totPlRealizzato >= 0 ? '#10b981' : '#ef4444'} blurred={p} />
        </div>

        {chiusi.length === 0
          ? <p style={{ color:'#475569', textAlign:'center', padding:40 }}>Nessun trade chiuso trovato.</p>
          : <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #1e293b' }}>
                    <th style={{ padding:'10px 14px', textAlign:'left', color:'#64748b',
                                 fontSize:'0.72rem', textTransform:'uppercase' }}>Ticker</th>
                    <th style={{ padding:'10px 14px', textAlign:'left', color:'#64748b',
                                 fontSize:'0.72rem', textTransform:'uppercase' }}>ISIN</th>
                    <th style={{ padding:'10px 14px', textAlign:'left', color:'#64748b',
                                 fontSize:'0.72rem', textTransform:'uppercase' }}>Descrizione</th>
                    <SortTh label="Costo Acq." k="costo" />
                    <SortTh label="Ricavi" k="ricavi" />
                    <SortTh label="Cedole/Dividendi" k="cedole" />
                    <SortTh label="Ritenute" k="tasse" />
                    <SortTh label="Plus/Minus" k="pl" />
                    <SortTh label="IRR" k="irr" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => {
                    const pl = s.plRealizzato;
                    const plPct = s.costoTotale > 0 ? pl / s.costoTotale : null;
                    return (
                      <tr key={s.isin} style={{ borderBottom:'1px solid #1e293b',
                                                background: i%2===0?'transparent':'#0d1520' }}>
                        <td style={{ padding:'9px 14px', color:'#7dd3fc', fontWeight:700 }}>{s.ticker}</td>
                        <td style={{ padding:'9px 14px', color:'#64748b', fontSize:'0.75rem', fontFamily:'monospace' }}>
                          <span onClick={() => onSelectStrumento(s.isin)}
                                style={{ cursor:'pointer', color:'#7dd3fc', textDecoration:'underline',
                                         textDecorationColor:'#334155', textUnderlineOffset:3 }}>
                            {s.isin}
                          </span>
                        </td>
                        <td style={{ padding:'9px 14px', color:'#cbd5e1', maxWidth:220,
                                     overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {s.descrizione || '—'}
                        </td>
                        <td style={{ padding:'9px 14px', textAlign:'right', color:'#94a3b8' }}>
                          <B active={p}>{fmtEuro(s.costoTotale)}</B>
                        </td>
                        <td style={{ padding:'9px 14px', textAlign:'right', color:'#94a3b8' }}>
                          <B active={p}>{fmtEuro(s.ricaviTotali)}</B>
                        </td>
                        <td style={{ padding:'9px 14px', textAlign:'right', color:'#06b6d4' }}>
                          <B active={p}>{fmtEuro(s.cedoleTotali)}</B>
                        </td>
                        <td style={{ padding:'9px 14px', textAlign:'right', color:'#ef4444' }}>
                          <B active={p}>{fmtEuro(s.tasseTotali)}</B>
                        </td>
                        <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700,
                                     color: pl>=0?'#10b981':'#ef4444' }}>
                          <B active={p}>{fmtEuro(pl)}</B>
                          {plPct != null && <span style={{ display:'block', fontSize:'0.72rem', fontWeight:400 }}>{fmtPct1(plPct)}</span>}
                        </td>
                        <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700,
                                     color: s.irr>0?'#10b981':s.irr<0?'#ef4444':'#64748b' }}>
                          {fmtPct1(s.irr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        }
      </Sezione>
    </>
  );
}


// ── Tooltip personalizzato per il grafico storico ─────────────────────────────
function TooltipStorico({ active, payload, isObb }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const isOp = d.tipoOp != null;
  const colore = d.tipoOp === 'acquisto' ? '#60a5fa' : d.tipoOp === 'vendita' ? '#f87171' : '#7dd3fc';

  return (
    <div style={{ background:'#0f1117', border:`1px solid ${colore}40`, borderRadius:8,
                  padding:'10px 14px', fontSize:'0.8rem', color:'#cbd5e1', minWidth:170 }}>
      {isOp && (
        <p style={{ margin:'0 0 6px', color: colore, fontWeight:700,
                    textTransform:'uppercase', fontSize:'0.7rem', letterSpacing:'0.05em' }}>
          {d.tipoOp === 'acquisto' ? '● Acquisto' : '● Vendita'}
        </p>
      )}
      <p style={{ margin:'2px 0', color:'#64748b', fontSize:'0.72rem' }}>{d.data}</p>
      <p style={{ margin:'4px 0 0', fontWeight:700, color: colore, fontSize:'0.95rem' }}>
        {(isOp ? (d.prezzoUnit ?? d.prezzo) : d.prezzo)?.toFixed(2)} {isObb ? '%' : '€'}
      </p>
      {isOp && <>
        <p style={{ margin:'4px 0 0', color:'#94a3b8' }}>Quantità: <strong style={{color:'#e2e8f0'}}>{d.quantita}</strong></p>
        <p style={{ margin:'2px 0', color:'#94a3b8' }}>Prezzo operazione: <strong style={{color:'#e2e8f0'}}>{d.prezzoUnit?.toFixed(2)} €</strong></p>
        <p style={{ margin:'2px 0', color:'#94a3b8' }}>Totale: <strong style={{color:'#e2e8f0'}}>{Math.abs(d.importo)?.toFixed(2)} €</strong></p>
        <p style={{ margin:'4px 0 0', color:'#475569', fontSize:'0.7rem', borderTop:'1px solid #1e293b', paddingTop:4 }}>
          Chiusura mese: {d.prezzoChiusura?.toFixed(2)} €
        </p>
      </>}
    </div>
  );
}

function GraficoStorico({ strumento }) {
  const [storico, setStorico] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore]   = useState(false);
  const isObb = strumento.ticker?.startsWith('M.');

  useEffect(() => {
    setLoading(true); setErrore(false);
    const sym = strumento.yahooSymbol || strumento.ticker;
    fetch(`https://portfolio-tracker-backend-xh7o.onrender.com/api/history/${encodeURIComponent(sym)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setStorico(d.data); setLoading(false); })
      .catch(() => { setErrore(true); setLoading(false); });
  }, [strumento.ticker, strumento.yahooSymbol]);

  if (loading) return (
    <div style={{ textAlign:'center', padding:'48px 0', color:'#475569', fontSize:'0.85rem' }}>
      Caricamento storico prezzi...
    </div>
  );
  if (errore || !storico) return (
    <div style={{ textAlign:'center', padding:'48px 0', color:'#475569', fontSize:'0.85rem' }}>
      Storico prezzi non disponibile per questo strumento.<br/>
      <span style={{ fontSize:'0.75rem', color:'#334155' }}>Disponibile solo per strumenti quotati su Yahoo Finance.</span>
    </div>
  );

  // Mappa operazioni per mese
  const opPerMese = {};
  (strumento.operazioni || [])
    .filter(op => ['Acquisto','Vendita'].includes(String(op.tipoOperazione).trim()))
    .forEach(op => {
      const raw = op.dataValuta || op.dataOperazione || '';
      // Supporta sia DD-MM-YYYY che YYYY-MM-DD
      const s = String(raw).trim();
      let mese = '';
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        mese = s.slice(6, 10) + '-' + s.slice(3, 5); // DD-MM-YYYY → YYYY-MM
      } else if (/^\d{4}-\d{2}/.test(s)) {
        mese = s.slice(0, 7); // YYYY-MM-DD → YYYY-MM
      }
      if (!mese) return;
      const quantita  = Math.abs(Number(op.quantita) || 0);
      const importo   = Number(op.importoEuro) || 0;
      const tipoOp    = String(op.tipoOperazione).trim() === 'Acquisto' ? 'acquisto' : 'vendita';
      const prezzoUnit = quantita > 0 ? Math.abs(importo) / quantita : null;
      // Se ci sono più operazioni nello stesso mese, teniamo la prima
      if (!opPerMese[mese]) opPerMese[mese] = { tipoOp, quantita, importo, prezzoUnit,
                                                  dataLabel: String(raw).slice(0, 10) };
    });

  // Costruisci dati grafico
  const dati = storico.map(d => {
    const op = opPerMese[d.data];
    return {
      data: d.data,
      prezzo: d.prezzo,
      prezzoChiusura: d.prezzo, // per riferimento nel tooltip
      ...(op || {}),
      // Punto al prezzo reale dell'operazione, non alla chiusura mensile
      prezzoAcquisto: op?.tipoOp === 'acquisto' ? op.prezzoUnit : undefined,
      prezzoVendita:  op?.tipoOp === 'vendita'  ? op.prezzoUnit : undefined,
    };
  });

  const prezzi = dati.map(d => d.prezzo).filter(Boolean);
  const prezziOp = dati.map(d => d.prezzoAcquisto ?? d.prezzoVendita).filter(Boolean);
  const tuttiPrezzi = [...prezzi, ...prezziOp];
  const yMin = Math.floor(Math.min(...tuttiPrezzi) * 0.96);
  const yMax = Math.ceil(Math.max(...tuttiPrezzi) * 1.04);

  const tickEvery = dati.length > 60 ? 12 : dati.length > 24 ? 6 : 3;
  const xTicks = dati.filter((_, i) => i % tickEvery === 0).map(d => d.data);

  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:'20px 16px' }}>
      <div style={{ fontSize:'0.75rem', color:'#475569', marginBottom:12, display:'flex', gap:20 }}>
        <span><span style={{ color:'#60a5fa', fontSize:'1rem' }}>●</span> Acquisto</span>
        <span><span style={{ color:'#f87171', fontSize:'1rem' }}>●</span> Vendita</span>
        <span style={{ marginLeft:'auto', color:'#334155' }}>{dati.length} punti mensili</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={dati} margin={{ top:5, right:20, left:10, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="data" ticks={xTicks} tick={{ fill:'#475569', fontSize:11 }}
                 stroke="#334155" tickLine={false} />
          <YAxis domain={[yMin, yMax]} tick={{ fill:'#475569', fontSize:11 }}
                 tickFormatter={v => v.toFixed(0) + (isObb ? '%' : ' €')}
                 stroke="#334155" tickLine={false} width={65} />
          <Tooltip content={<TooltipStorico isObb={isObb} />} />
          <Line type="monotone" dataKey="prezzo" stroke="#3b82f6" strokeWidth={1.5}
                dot={false}
                activeDot={{ r:4, fill:'#7dd3fc', stroke:'#0f1117', strokeWidth:2 }} />
          {/* Punti acquisto: line con soli dot visibili */}
          <Line dataKey="prezzoAcquisto" stroke="none" dot={(props) => {
            const { cx, cy, payload } = props;
            if (!payload?.tipoOp || payload.tipoOp !== 'acquisto') return null;
            return <circle key={cx} cx={cx} cy={cy} r={7} fill="#60a5fa" stroke="#0f1117" strokeWidth={2} />;
          }} activeDot={false} legendType="none" isAnimationActive={false} />
          {/* Punti vendita */}
          <Line dataKey="prezzoVendita" stroke="none" dot={(props) => {
            const { cx, cy, payload } = props;
            if (!payload?.tipoOp || payload.tipoOp !== 'vendita') return null;
            return <circle key={cx} cx={cx} cy={cy} r={7} fill="#f87171" stroke="#0f1117" strokeWidth={2} />;
          }} activeDot={false} legendType="none" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


function VistaStrumento({ strumento: s, privacy: p }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [s?.isin]);
  if (!s) return <p style={{ color:'#94a3b8' }}>Strumento non trovato.</p>;
  const pl    = plEuro(s);
  const pct   = plPct(s);
  const pmc   = calcolaPMC(s);
  const label = labelStrumento(s);
  const isObb = s.ticker?.startsWith('M.');
  const pmcFmt = v => isObb ? fmtPct2(v) : fmtEuro2(v);

  return (
    <>
      <Sezione title={`${label} — ${s.descrizione||s.isin}`}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          <Card title="Quantità Detenuta"
                value={s.quantitaAttuale%1===0 ? s.quantitaAttuale.toFixed(0) : s.quantitaAttuale.toFixed(4)}
                color="#3b82f6" blurred={p} />
          <Card title="PMC" value={pmc!=null ? pmcFmt(pmc) : '—'}
                sub={isObb?'% del valore nominale':'per quota'} color="#8b5cf6" />
          <Card title="Prezzo Attuale"
                value={s.prezzoAttuale!=null ? fmtEuro2(s.prezzoAttuale) : '—'}
                sub={s.prezzoManuale?'inserito manualmente':(s.mercato||'')}
                color="#8b5cf6" />
          <Card title="Valore Attuale Posizione" value={fmtEuro(s.valoreAttuale)} color="#10b981" blurred={p} />
          <Card title="Costo di Acquisto" value={fmtEuro(s.costoTotale)} color="#3b82f6" blurred={p} />
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <Card title="Cedole & Dividendi" value={fmtEuro(s.cedoleTotali)} color="#06b6d4" blurred={p} />
          <Card title="Ritenute" value={fmtEuro(s.tasseTotali)} color="#ef4444" blurred={p} />
          {/* Plus/Minus: % visibile, € offuscato */}
          <div style={{ background:'#1e293b', borderRadius:12, padding:'20px 24px',
                        borderLeft:`4px solid ${pl>=0?'#10b981':'#ef4444'}`, flex:1, minWidth:160 }}>
            <p style={{ color:'#94a3b8', fontSize:'0.75rem', marginBottom:6,
                        textTransform:'uppercase', letterSpacing:'0.5px' }}>Plus/Minus Totale</p>
            <p style={{ color:'#f1f5f9', fontSize:'1.5rem', fontWeight:700, margin:0 }}>
              {pct!=null ? fmtPct1(pct) : '—'}
            </p>
            {pct!=null && (
              <B active={p} style={{ color:'#94a3b8', fontSize:'0.82rem', marginTop:4, fontWeight:500, display:'block' }}>
                {fmtEuro(pl)}
              </B>
            )}
            <p style={{ color:'#64748b', fontSize:'0.7rem', marginTop:4 }}>cedole + valore attuale − costi − ritenute − comm.</p>
          </div>
          <Card title="IRR Annualizzato" value={fmtPct1(s.irr)}
                sub="Tasso Interno di Rendimento"
                color={s.irr>0?'#10b981':'#ef4444'} />
          <Card title="Commissioni Negoziazione" value={fmtEuro(s.commissioniTotali)} color="#f59e0b" blurred={p} />
        </div>
      </Sezione>

      <Sezione title="Andamento Storico Prezzi">
        <GraficoStorico strumento={s} />
      </Sezione>

      <Sezione title="Storico Operazioni">
        <div style={{ background:'#1e293b', borderRadius:12, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #334155' }}>
                {['Data','Tipo Operazione','Quantità','Importo €'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'#64748b', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.operazioni.map((op, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #0f1117',
                                     background:i%2===0?'#1e293b':'#162032' }}>
                  <td style={{ padding:'8px 14px', color:'#94a3b8' }}>{op.dataValuta||op.dataOperazione}</td>
                  <td style={{ padding:'8px 14px', color:'#cbd5e1' }}>{op.tipoOperazione}</td>
                  <td style={{ padding:'8px 14px', textAlign:'right' }}>
                    <B active={p}>{op.quantita||'—'}</B>
                  </td>
                  <td style={{ padding:'8px 14px', textAlign:'right',
                               color:op.importoEuro>=0?'#10b981':'#ef4444' }}>
                    <B active={p}>{fmtEuro(op.importoEuro)}</B>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sezione>
    </>
  );
}
