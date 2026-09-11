// ============================================================
// MOTORE DI CALCOLO - Portfolio Tracker Directa SIM
// ============================================================

export const TIPI = {
  acquisto:         ['Acquisto'],
  vendita:          ['Vendita'],
  rimborso:         ['Rimborso obbl. a scadenza'],
  stornoRimborso:   ['St.rimborso obbl. a scade'],
  entrata:          ['Conferimento con bonifico'],
  uscita:           ['Prelievo bonifico'],
  cedole:           ['Cedola obb.', 'Ratei att.obb.',
                     'Rit.credito disaggio', 'Provento etf'],
  storniCedole:     ['St.cedola obb.'],
  storni:           ['St.rit.debito disaggio'],
  commissioni:      ['Commissioni'],
  bolloPortafoglio: ['Bollo portafoglio titoli*'],
  capitalGain:      ['Ritenuta su plusvalenza'],
  tasse:            ['Rit.cedola obb.', 'Rit.ratei att.obb.',
                     'Rit.debito disaggio',
                     'Ratei pass.obb.',
                     'Rit.ratei pass.obb.', 'Rit.provento etf'],
  stornoTasse:      ['St.rit.cedola obb.', 'St.rit.debito disaggio'],
};

function parseData(str) {
  if (!str) return null;
  const s = String(str).trim();
  const match = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}`);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function calcolaIRR(flussi) {
  if (!flussi || flussi.length < 2) return null;

  const hasNeg = flussi.some(f => f.importo < 0);
  const hasPos = flussi.some(f => f.importo > 0);
  if (!hasNeg || !hasPos) return null;

  const sorted = [...flussi].sort((a, b) => a.data - b.data);
  const t0 = sorted[0].data.getTime();
  const cf = sorted.map(f => ({
    t: (f.data.getTime() - t0) / (365.25 * 24 * 3600 * 1000),
    v: f.importo
  }));

  const maxT = Math.max(...cf.map(f => f.t));
  if (maxT < 0.01) return null;

  const maxFlusso = Math.max(...cf.map(f => Math.abs(f.v)));
  const soglia = maxFlusso * 0.0001;

  const npvCalc  = r => cf.reduce((a, {t,v}) => a + v / Math.pow(1+r, t), 0);
  const dnpvCalc = r => cf.reduce((a, {t,v}) => a - t*v / (Math.pow(1+r,t)*(1+r)), 0);

  const startPoints = [-0.5, -0.1, 0.0, 0.05, 0.1, 0.5, 1.0];
  for (const start of startPoints) {
    let rate = start;
    let converged = false;
    for (let i = 0; i < 200; i++) {
      const npv  = npvCalc(rate);
      const dnpv = dnpvCalc(rate);
      if (Math.abs(dnpv) < 1e-10) break;
      const nr = rate - npv / dnpv;
      if (!isFinite(nr) || nr <= -1) break;
      if (Math.abs(nr - rate) < 1e-8) { rate = nr; converged = true; break; }
      rate = nr;
    }
    if (converged && isFinite(rate) && rate > -1 && rate < 100) {
      if (Math.abs(npvCalc(rate)) < soglia) return rate;
    }
  }
  return null;
}

// ============================================================
export function elaboraPortafoglio(operazioni) {

  let capitaleInvestito = 0;
  let totaleCommissioni = 0;
  let totaleBollo       = 0;
  let totaleCapitalGain = 0;
  let totaleTasse       = 0;
  let totaleCedole      = 0;
  let cashResiduo       = 0;
  const flussiGlobali   = [];
  const strumenti       = {};

  for (const op of operazioni) {
    if (!op || !op.tipoOperazione || op.tipoOperazione === '') continue;

    const data    = parseData(op.dataValuta || op.dataOperazione);
    const importo = Number(op.importoEuro) || 0;
    const tipo    = String(op.tipoOperazione).trim();
    if (!data) continue;

    cashResiduo += importo;

    if (TIPI.entrata.includes(tipo)) {
      capitaleInvestito += importo;
      flussiGlobali.push({ data, importo: -Math.abs(importo) });
    }
    if (TIPI.uscita.includes(tipo)) {
      capitaleInvestito -= Math.abs(importo);
      flussiGlobali.push({ data, importo: Math.abs(importo) });
    }
    if (TIPI.commissioni.includes(tipo))      totaleCommissioni += Math.abs(importo);
    if (TIPI.bolloPortafoglio.includes(tipo)) totaleBollo       += Math.abs(importo);
    if (TIPI.capitalGain.includes(tipo))      totaleCapitalGain += Math.abs(importo);
    if (TIPI.tasse.includes(tipo))            totaleTasse       += Math.abs(importo);
    if (TIPI.stornoTasse.includes(tipo))      totaleTasse       -= Math.abs(importo);
    if (TIPI.cedole.includes(tipo))           totaleCedole      += Math.abs(importo);
    if (TIPI.storniCedole.includes(tipo))     totaleCedole      -= Math.abs(importo);
    if (TIPI.storni.includes(tipo))           totaleCedole      -= Math.abs(importo);

    if (!op.isin || String(op.isin).trim() === '') continue;
    const isin = String(op.isin).trim();

    if (!strumenti[isin]) {
      strumenti[isin] = {
        isin,
        ticker:           op.ticker      || '',
        descrizione:      op.descrizione || '',
        operazioni:       [],
        quantitaAttuale:  0,
        quantitaVenduta:  0,
        costoTotale:      0,
        ricaviTotali:     0,
        cedoleTotali:     0,
        commissioniTotali:0,
        tasseTotali:      0,
        flussi:           [],
      };
    }

    const s = strumenti[isin];
    s.operazioni.push(op);

    if (TIPI.acquisto.includes(tipo)) {
      s.quantitaAttuale   += Number(op.quantita) || 0;
      s.costoTotale       += Math.abs(importo);
      s.flussi.push({ data, importo: -Math.abs(importo) });
    }
    if (TIPI.vendita.includes(tipo)) {
      const qtaVenduta     = Math.abs(Number(op.quantita) || 0);
      s.quantitaAttuale   -= qtaVenduta;
      s.quantitaVenduta   += qtaVenduta;
      s.ricaviTotali      += Math.abs(importo);
      s.flussi.push({ data, importo: Math.abs(importo) });
    }
    if (TIPI.rimborso.includes(tipo)) {
      s.quantitaVenduta   += s.quantitaAttuale;
      s.quantitaAttuale    = 0;
      s.ricaviTotali      += Math.abs(importo);
      s.flussi.push({ data, importo: Math.abs(importo) });
    }
    if (TIPI.stornoRimborso.includes(tipo)) {
      const qtaRipristinata = Math.abs(Number(op.quantita) || s.quantitaVenduta || 0);
      s.ricaviTotali      -= Math.abs(importo);
      s.quantitaAttuale   += qtaRipristinata;
      s.quantitaVenduta   -= qtaRipristinata;
      s.flussi.push({ data, importo: -Math.abs(importo) });
    }
    if (TIPI.cedole.includes(tipo)) {
      s.cedoleTotali      += Math.abs(importo);
      s.flussi.push({ data, importo: Math.abs(importo) });
    }
    if (TIPI.storniCedole.includes(tipo)) {
      // Storno cedola: sottrae la cedola precedente errata
      s.cedoleTotali      -= Math.abs(importo);
      s.flussi.push({ data, importo: -Math.abs(importo) });
    }
    if (TIPI.storni.includes(tipo)) {
      s.cedoleTotali      -= Math.abs(importo);
      s.flussi.push({ data, importo: -Math.abs(importo) });
    }
    if (TIPI.commissioni.includes(tipo)) {
      s.commissioniTotali += Math.abs(importo);
      s.flussi.push({ data, importo: -Math.abs(importo) });
    }
    if (TIPI.tasse.includes(tipo)) {
      s.tasseTotali       += Math.abs(importo);
      s.flussi.push({ data, importo: -Math.abs(importo) });
    }
    if (TIPI.stornoTasse.includes(tipo)) {
      // Storno ritenuta: sottrae la ritenuta precedente errata
      s.tasseTotali       -= Math.abs(importo);
      s.flussi.push({ data, importo: Math.abs(importo) });
    }
  }

  const cashArrotondato = Math.round(cashResiduo * 100) / 100;
  const strumentoCash = {
    isin:             'CASH',
    ticker:           'CASH',
    descrizione:      'Liquidità sul conto',
    operazioni:       [],
    quantitaAttuale:  cashArrotondato,
    costoTotale:      0,
    ricaviTotali:     0,
    cedoleTotali:     0,
    commissioniTotali:0,
    tasseTotali:      0,
    flussi:           [],
    prezzoAttuale:    1,
    valoreAttuale:    cashArrotondato,
    plNonRealizzato:  0,
    irr:              null,
    isCash:           true,
  };

  const strumentiArray = Object.values(strumenti).map(s => {
    const qtaTotale      = s.quantitaAttuale + s.quantitaVenduta;
    const costoMedioUnit = qtaTotale > 0 ? s.costoTotale / qtaTotale : 0;
    const costoVenduto   = costoMedioUnit * s.quantitaVenduta;
    const plRealizzato   = s.quantitaVenduta > 0
      ? s.ricaviTotali - costoVenduto
      : null;

    return {
      ...s,
      irr:             calcolaIRR(s.flussi),
      prezzoAttuale:   null,
      valoreAttuale:   null,
      plNonRealizzato: null,
      plRealizzato,
      costoMedioUnit,
    };
  });

  if (cashArrotondato > 0) {
    strumentiArray.push(strumentoCash);
  }

  const plRealizzatoTotale = strumentiArray.reduce(
    (acc, s) => acc + (s.plRealizzato || 0), 0
  );

  const globale = {
    capitaleInvestito,
    totaleCommissioni,
    totaleBollo,
    totaleCapitalGain,
    totaleTasse,
    totaleCedole,
    cashResiduo:              cashArrotondato,
    flussiGlobali,
    plRealizzatoTotale,
    irrGlobale:               null,
    valoreAttualePortafoglio: null,
    plTotale:                 null,
  };

  const storicoMap = {};
  for (const op of operazioni) {
    if (!op || !op.tipoOperazione) continue;
    const data = parseData(op.dataValuta || op.dataOperazione);
    if (!data) continue;
    const tipo   = String(op.tipoOperazione).trim();
    const chiave = `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}`;
    if (!storicoMap[chiave]) storicoMap[chiave] = 0;
    if (TIPI.acquisto.includes(tipo)) storicoMap[chiave] -= Math.abs(Number(op.importoEuro)||0);
    if (TIPI.vendita.includes(tipo))  storicoMap[chiave] += Math.abs(Number(op.importoEuro)||0);
    if (TIPI.entrata.includes(tipo))  storicoMap[chiave] += Math.abs(Number(op.importoEuro)||0);
    if (TIPI.uscita.includes(tipo))   storicoMap[chiave] -= Math.abs(Number(op.importoEuro)||0);
  }

  const storicoMensile = Object.entries(storicoMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mese, flusso]) => ({ mese, flusso }));

  return { globale, strumenti: strumentiArray, storicoMensile };
}