import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import InserimentoPrezzi from './components/InserimentoPrezzi';
import { elaboraPortafoglio, calcolaIRR } from './utils/calcoli';
import { getPrezziPortafoglio } from './utils/api';

// Maialino salvadanaio SVG azzurro (usato anche nell'upload screen)
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

function UploadScreen({ onDataReady }) {
  const [dragging, setDragging] = useState(false);
  const [errore, setErrore]     = useState(null);

  const elabora = async (file) => {
    if (!file) return;
    setErrore(null);
    try {
      const { read, utils } = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb     = read(buffer, { type:'array', cellDates:true });
      const ws     = wb.Sheets[wb.SheetNames[0]];
      const rows   = utils.sheet_to_json(ws, { defval:'' });
      if (rows.length === 0) throw new Error('File vuoto o formato non riconosciuto');

      // Detect formato: Directa esporta con colonne __EMPTY_X (header righe 6-7)
      // La prima riga con __EMPTY indica che bisogna saltare le righe di intestazione
      const isDirectaFormat = rows[0] && rows[0]['__EMPTY'] !== undefined;

      let dataRows = rows;
      if (isDirectaFormat) {
        // Salta le righe di intestazione del file Directa (prime 8 righe)
        dataRows = rows.slice(8);
      }

      const norm = dataRows.map(r => {
        const get = (...keys) => { for (const k of keys) if (r[k]!==undefined && r[k]!=='') return r[k]; return ''; };
        if (isDirectaFormat) {
          // Formato reale Directa: Conto/__EMPTY/__EMPTY_1/...__EMPTY_9
          return {
            dataOperazione: r['Conto'] || '',
            dataValuta:     r['__EMPTY'] || '',
            tipoOperazione: r['__EMPTY_1'] || '',
            ticker:         r['__EMPTY_2'] || '',
            isin:           r['__EMPTY_3'] || '',
            protocollo:     r['__EMPTY_4'] || '',
            descrizione:    r['__EMPTY_5'] || '',
            quantita:       parseFloat(r['__EMPTY_6']) || 0,
            importoEuro:    parseFloat(r['__EMPTY_7']) || 0,
            importoDivisa:  parseFloat(r['__EMPTY_8']) || 0,
            divisa:         r['__EMPTY_9'] || '',
          };
        } else {
          // Formato con nomi colonna espliciti (fallback)
          return {
            dataOperazione: get('Data operazione','Data Op.','DataOperazione','data_operazione'),
            dataValuta:     get('Data valuta','DataValuta','data_valuta'),
            tipoOperazione: get('Tipo operazione','Tipo Op.','TipoOperazione','tipo_operazione','Causale'),
            descrizione:    get('Descrizione','descrizione','Titolo'),
            isin:           get('ISIN','Isin','isin','Codice ISIN'),
            ticker:         get('Ticker','ticker','Simbolo'),
            quantita:       parseFloat(get('Quantità','Quantita','quantita','Qty')) || 0,
            importoEuro:    parseFloat(get('Importo in EUR','Importo EUR','ImportoEuro','importo_euro','Importo','Controvalore EUR')) || 0,
          };
        }
      }).filter(r => r.tipoOperazione !== '');

      console.log('Formato rilevato:', isDirectaFormat ? 'Directa __EMPTY' : 'Colonne nominali');
      console.log('Operazioni parsate:', norm.length);
      if (norm.length > 0) {
        console.log('Prima op:', norm[0]);
        console.log('Tipi distinti:', [...new Set(norm.map(o => o.tipoOperazione))]);
      }
      onDataReady(norm);
    } catch(e) {
      setErrore('Errore nella lettura del file: ' + e.message);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0f1117', display:'flex',
                  alignItems:'center', justifyContent:'center',
                  fontFamily:'Segoe UI, sans-serif', padding:'32px 16px' }}>
      <div style={{ width:'100%', maxWidth:680 }}>

        {/* Logo + titolo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <PigLogo size={64} />
          <h1 style={{ color:'#7dd3fc', fontSize:'1.8rem', fontWeight:700, margin:'16px 0 4px' }}>
            Portfolio Tracker
          </h1>
          <p style={{ color:'#64748b', fontSize:'0.9rem' }}>
            Analisi del portafoglio Directa SIM
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); elabora(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById('file-input').click()}
          style={{ border:`2px dashed ${dragging?'#3b82f6':'#334155'}`,
                   borderRadius:16, padding:'48px 32px', textAlign:'center',
                   cursor:'pointer', transition:'border-color 0.2s',
                   background:dragging?'#1e293b':'transparent', marginBottom:32 }}>
          <input id="file-input" type="file" accept=".xlsx,.xls"
                 style={{ display:'none' }} onChange={e => elabora(e.target.files[0])} />
          <p style={{ color:'#7dd3fc', fontSize:'1.1rem', fontWeight:600, margin:'0 0 8px' }}>
            Trascina qui il file Excel di Directa
          </p>
          <p style={{ color:'#475569', fontSize:'0.85rem', margin:0 }}>
            oppure clicca per selezionarlo — formato .xlsx
          </p>
          {errore && (
            <p style={{ color:'#ef4444', marginTop:16, fontSize:'0.85rem' }}>{errore}</p>
          )}
        </div>

        {/* Istruzioni */}
        <div style={{ background:'#1e293b', borderRadius:12, padding:'24px 28px',
                      borderLeft:'4px solid #334155' }}>
          <h2 style={{ color:'#94a3b8', fontSize:'0.85rem', fontWeight:700,
                       textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 16px' }}>
            Come ottenere il file da Directa
          </h2>
          <ol style={{ color:'#64748b', fontSize:'0.85rem', lineHeight:1.8,
                       margin:0, paddingLeft:20 }}>
            <li>Accedi a Directa e vai nella sezione <strong style={{ color:'#94a3b8' }}>Libera</strong></li>
            <li>Apri il menu <strong style={{ color:'#94a3b8' }}>Movimenti</strong></li>
            <li>Usa il filtro in alto a destra per impostare l'intervallo di date desiderato</li>
            <li>Clicca su <strong style={{ color:'#94a3b8' }}>Esporta</strong> e scarica il file in formato <strong style={{ color:'#94a3b8' }}>XLSX</strong></li>
          </ol>
          <p style={{ color:'#475569', fontSize:'0.82rem', marginTop:16, marginBottom:0,
                      borderTop:'1px solid #334155', paddingTop:14, lineHeight:1.7 }}>
            <strong style={{ color:'#64748b' }}>Nota:</strong> l'export ha un limite di 3.000 righe. Se la tua storia operativa è più lunga, esporta più intervalli separati e unisci manualmente i file Excel prima di caricarlo qui.
          </p>
          <p style={{ color:'#475569', fontSize:'0.82rem', marginTop:12, marginBottom:0, lineHeight:1.7 }}>
            <strong style={{ color:'#64748b' }}>Privacy:</strong> nessun dato personale lascia il tuo computer. L'unica informazione inviata esternamente sono i codici ISIN dei tuoi strumenti, utilizzati esclusivamente per recuperarne il valore di mercato aggiornato.
          </p>
        </div>

      </div>
    </div>
  );
}

function App() {
  const [fase, setFase]                     = useState('upload');
  const [portfolioData, setPortfolioData]   = useState(null);
  const [strumentiMancanti, setStrumentiMancanti] = useState([]);
  const [risultatoTemp, setRisultatoTemp]   = useState(null);
  const [prezziTrovati, setPrezziTrovati]   = useState({});

  const handleDataReady = async (operazioni) => {
    setFase('caricamento');
    const risultato = elaboraPortafoglio(operazioni);

    let prezzi = {};
    try {
      prezzi = await getPrezziPortafoglio(risultato.strumenti);
    } catch(e) {
      console.error('Errore prezzi:', e);
    }

    const mancanti = risultato.strumenti.filter(
      s => !s.isCash && s.quantitaAttuale > 0.001 && !prezzi[s.isin]
    );

    setRisultatoTemp(risultato);
    setPrezziTrovati(prezzi);

    if (mancanti.length > 0) {
      setStrumentiMancanti(mancanti);
      setFase('prezzi');
    } else {
      finalizza(risultato, prezzi);
    }
  };

  const handlePrezziManuali = (prezziManuali) => {
    const tuttiPrezzi = { ...prezziTrovati, ...prezziManuali };
    finalizza(risultatoTemp, tuttiPrezzi);
  };

  const finalizza = (risultato, prezzi) => {
    risultato.strumenti = risultato.strumenti.map(s => {
      // Il cash ha già valoreAttuale corretto da calcoli.js, non va toccato
      if (s.isCash) return s;

      const datiPrezzo = prezzi[s.isin];

      // Ricalcola sempre plRealizzato (per strumenti chiusi o con vendite parziali)
      const qtaTotAcq = s.quantitaAttuale + (s.quantitaVenduta || 0);
      const cmu       = qtaTotAcq > 0 ? s.costoTotale / qtaTotAcq : 0;
      const plRealizz = (s.quantitaVenduta || 0) > 0
        ? s.ricaviTotali - cmu * s.quantitaVenduta
        : null;
      if (!datiPrezzo || s.quantitaAttuale <= 0) return { ...s, plRealizzato: plRealizz };

      const prezzoAttuale   = datiPrezzo.price;
      const isObb           = s.ticker?.startsWith('M.');
      const valoreAttuale   = isObb
        ? (prezzoAttuale / 100) * s.quantitaAttuale
        : prezzoAttuale * s.quantitaAttuale;
      // Costo medio per unità × quantità residua (gestisce rimborsi parziali correttamente)
      const qtaTotaleAcquistata = s.quantitaAttuale + (s.quantitaVenduta || 0);
      const costoMedioUnitario  = qtaTotaleAcquistata > 0 ? s.costoTotale / qtaTotaleAcquistata : 0;
      const costoResiduo        = costoMedioUnitario * s.quantitaAttuale;
      const plNonRealizzato     = valoreAttuale - costoResiduo;

      const flussiAggiornati = [...s.flussi, { data: new Date(), importo: valoreAttuale }];
      const irrAggiornato    = calcolaIRR(flussiAggiornati);

      return {
        ...s,
        prezzoAttuale,
        valoreAttuale,
        plNonRealizzato,
        irr: irrAggiornato,
        nomeCompleto: datiPrezzo.name,
        mercato: datiPrezzo.mercato,
        yahooSymbol: datiPrezzo.symbol || null,
        prezzoManuale: datiPrezzo.manuale || false,
      };
    });

    // DEBUG - rimuovere dopo verifica
    risultato.strumenti.forEach(s => {
      if (!s.isCash) console.log(
        s.ticker?.padEnd(12),
        'qtà:', s.quantitaAttuale,
        '| valore:', s.valoreAttuale?.toFixed(0),
        '| costo:', s.costoTotale?.toFixed(0),
        '| ricavi:', s.ricaviTotali?.toFixed(0),
        '| pl:', s.plNonRealizzato?.toFixed(0)
      );
    });
    const valoreTotale = risultato.strumenti.reduce(
      (acc, s) => acc + (s.valoreAttuale || 0), 0
    );
    // P&L non realizzato = somma dei plNonRealizzato dei singoli strumenti (esclude cash)
    const plNonRealizzatoTotale = risultato.strumenti.reduce(
      (acc, s) => acc + (s.isCash ? 0 : (s.plNonRealizzato || 0)), 0
    );
    // Ricalcola plRealizzatoTotale dagli strumenti aggiornati
    const plRealizzatoTotale = risultato.strumenti.reduce(
      (acc, s) => acc + (s.isCash ? 0 : (s.plRealizzato || 0)), 0
    );
    risultato.globale.valoreAttualePortafoglio = valoreTotale;
    risultato.globale.plTotale = plNonRealizzatoTotale;
    risultato.globale.plRealizzatoTotale = plRealizzatoTotale;

    const flussiGlobaliConFinale = [
      ...risultato.globale.flussiGlobali,
      { data: new Date(), importo: valoreTotale }
    ];
    risultato.globale.irrGlobale = calcolaIRR(flussiGlobaliConFinale);

    setPortfolioData(risultato);
    setFase('dashboard');
  };

  if (fase === 'caricamento') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', minHeight:'100vh',
                  background:'#0f1117', color:'#7dd3fc', fontFamily:'Segoe UI, sans-serif' }}>
      <PigLogo size={48} />
      <p style={{ fontSize:'1.3rem', marginTop:16 }}>Elaborazione in corso...</p>
      <p style={{ color:'#64748b', marginTop:8 }}>Recupero prezzi di mercato...</p>
    </div>
  );

  return (
    <div className="App">
      {fase === 'upload' && <UploadScreen onDataReady={handleDataReady} />}
      {fase === 'prezzi' && (
        <>
          <Dashboard data={{ ...risultatoTemp }} onReset={() => setFase('upload')} />
          <InserimentoPrezzi
            strumentiMancanti={strumentiMancanti}
            onComplete={handlePrezziManuali}
          />
        </>
      )}
      {fase === 'dashboard' && (
        <Dashboard data={portfolioData} onReset={() => setFase('upload')} />
      )}
    </div>
  );
}

export default App;
