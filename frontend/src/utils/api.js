export async function getPrezzoPerStrumento(ticker, isin) {
  try {
    const params = isin ? `?isin=${isin}` : '';
    const res = await fetch(`https://portfolio-tracker-backend-xh7o.onrender.com/api/price/${ticker}${params}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`Prezzo non trovato per ${ticker}:`, e.message);
    return null;
  }
}

export async function getPrezziPortafoglio(strumenti) {
  const attivi = strumenti.filter(s => s.quantitaAttuale > 0.001);

  const risultati = await Promise.all(
    attivi.map(async s => {
      const prezzo = await getPrezzoPerStrumento(s.ticker, s.isin);
      return { isin: s.isin, prezzo };
    })
  );

  const mappa = {};
  for (const r of risultati) {
    if (r.prezzo && r.prezzo.price) mappa[r.isin] = r.prezzo;
  }
  return mappa;
}