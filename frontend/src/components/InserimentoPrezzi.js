import React, { useState } from 'react';

export default function InserimentoPrezzi({ strumentiMancanti, onComplete }) {
  const [prezzi, setPrezzi] = useState(
    Object.fromEntries(strumentiMancanti.map(s => [s.isin, '']))
  );

  const handleChange = (isin, value) => {
    setPrezzi(prev => ({ ...prev, [isin]: value }));
  };

  const handleSubmit = () => {
    const risultato = {};
    for (const s of strumentiMancanti) {
      const val = parseFloat(String(prezzi[s.isin]).replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        risultato[s.isin] = { price: val, symbol: s.ticker, name: s.descrizione, currency: 'EUR', manuale: true };
      }
    }
    onComplete(risultato);
  };

  const tuttiInseriti = strumentiMancanti.every(s => {
    const val = parseFloat(String(prezzi[s.isin]).replace(',', '.'));
    return !isNaN(val) && val > 0;
  });

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>📋 Inserimento Prezzi Manuali</h2>
        <p style={styles.subtitle}>
          Non è stato possibile trovare automaticamente il prezzo di questi strumenti.<br/>
          Inserisci il prezzo attuale di mercato per ciascuno (in €).
        </p>

        <div style={styles.lista}>
          {strumentiMancanti.map(s => (
            <div key={s.isin} style={styles.riga}>
              <div style={styles.info}>
                <span style={styles.ticker}>{s.ticker || s.isin}</span>
                <span style={styles.desc}>{s.descrizione || ''}</span>
                <span style={styles.isin}>{s.isin}</span>
              </div>
              <div style={styles.inputWrap}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="es. 98.50"
                  value={prezzi[s.isin]}
                  onChange={e => handleChange(s.isin, e.target.value)}
                  style={styles.input}
                />
                <span style={styles.euroSign}>€</span>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          <button
            onClick={() => onComplete({})}
            style={styles.btnSkip}
          >
            Salta — mostra dashboard senza questi prezzi
          </button>
          <button
            onClick={handleSubmit}
            disabled={!tuttiInseriti}
            style={{ ...styles.btnOk, opacity: tuttiInseriti ? 1 : 0.4 }}
          >
            ✓ Conferma e vai alla Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, fontFamily: 'Segoe UI, sans-serif',
  },
  modal: {
    background: '#1e293b', borderRadius: 16, padding: '32px 36px',
    maxWidth: 640, width: '90%', maxHeight: '85vh',
    display: 'flex', flexDirection: 'column', gap: 20,
    border: '1px solid #334155',
  },
  title: { color: '#7dd3fc', fontSize: '1.2rem', margin: 0 },
  subtitle: { color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 },
  lista: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },
  riga: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#0f1117', borderRadius: 10, padding: '12px 16px', gap: 16,
  },
  info: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  ticker: { color: '#7dd3fc', fontWeight: 700, fontSize: '0.9rem' },
  desc: { color: '#cbd5e1', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  isin: { color: '#475569', fontSize: '0.7rem', fontFamily: 'monospace' },
  inputWrap: { display: 'flex', alignItems: 'center', gap: 6 },
  input: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
    color: '#f1f5f9', padding: '8px 12px', fontSize: '0.95rem',
    width: 110, textAlign: 'right', outline: 'none',
  },
  euroSign: { color: '#64748b', fontSize: '0.9rem' },
  footer: { display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' },
  btnSkip: {
    background: 'transparent', border: '1px solid #334155', color: '#64748b',
    borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: '0.82rem',
  },
  btnOk: {
    background: '#1d4ed8', color: 'white', border: 'none',
    borderRadius: 8, padding: '10px 24px', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 700,
  },
};