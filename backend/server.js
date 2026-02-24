const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

const cache = {};

// ── Yahoo Finance ─────────────────────────────────────────────────────────────
const SUFFISSI = ['.MI', '.DE', '.L', '.PA', '.AS', '.SW', '.F', ''];

async function cercaSuYahoo(ticker) {
  for (const suffisso of SUFFISSI) {
    const symbol = ticker + suffisso;
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });
      const meta = res.data?.chart?.result?.[0]?.meta;
      if (meta && meta.regularMarketPrice) {
        console.log(`✓ Yahoo: ${ticker} → ${symbol}: ${meta.regularMarketPrice} ${meta.currency}`);
        return {
          symbol,
          name: meta.longName || meta.shortName || ticker,
          price: meta.regularMarketPrice,
          currency: meta.currency || 'EUR',
          mercato: meta.fullExchangeName || 'Yahoo',
          fonte: 'yahoo',
        };
      }
    } catch (e) { /* prossimo suffisso */ }
  }
  return null;
}

// ── Borsa Italiana ────────────────────────────────────────────────────────────
const HEADERS_BI = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'it-IT,it;q=0.9',
  'Accept': 'text/html,application/xhtml+xml',
};

function estraiPrezzoBI($, isin, rangeMin, rangeMax) {
  // Verifica che la pagina contenga l'ISIN — se non c'è, è una pagina sbagliata
  const testoCompleto = $('body').text();
  if (!testoCompleto.includes(isin)) {
    console.log(`  BI: pagina non contiene ISIN ${isin}, scarto`);
    return null;
  }

  let price = null;

  // Selettore 1: tabelle tipiche BI con dati strumento (T18, T11, T14)
  $('table.T18 td, table.T11 td, table.T14 td').each((_, el) => {
    if (price !== null) return;
    const text = $(el).text().trim();
    if (!/^\d+[,.]?\d*$/.test(text)) return;
    const num = parseFloat(text.replace(',', '.'));
    if (!isNaN(num) && num >= rangeMin && num <= rangeMax) price = num;
  });

  // Selettore 2: elementi con classe che contiene "price" o "last"
  if (!price) {
    $('[class*="price"],[class*="Price"],[class*="last"],[class*="Last"],[id*="last"]').each((_, el) => {
      if (price !== null) return;
      const text = $(el).text().trim().replace(',', '.');
      const num = parseFloat(text);
      if (!isNaN(num) && num >= rangeMin && num <= rangeMax) price = num;
    });
  }

  return price;
}

async function fetchBI(url, isin, rangeMin, rangeMax) {
  try {
    const res = await axios.get(url, { headers: HEADERS_BI, timeout: 8000 });
    if (res.status !== 200) return null;
    const $ = cheerio.load(res.data);
    const price = estraiPrezzoBI($, isin, rangeMin, rangeMax);
    if (!price) return null;
    const name = $('h1').first().text().trim() ||
                 $('title').text().replace(/[-|].*Borsa Italiana.*/i, '').trim();
    return { price, name };
  } catch (e) {
    if (e.response?.status !== 404) {
      console.log(`  BI errore ${url.split('/').slice(-1)}: ${e.message}`);
    }
    return null;
  }
}

async function cercaSuBorsaItaliana(isin) {
  // Obbligazioni MOT (prezzo in % del nominale: 50-200)
  const catObb = isin.startsWith('IT')
    ? ['btp', 'btp-indicizzati-alleuribor', 'euro-obbligazioni', 'obbligazioni-euro']
    : ['euro-obbligazioni', 'obbligazioni-euro', 'btp'];

  for (const cat of catObb) {
    const r = await fetchBI(
      `https://www.borsaitaliana.it/borsa/obbligazioni/mot/${cat}/scheda/${isin}-MOTX.html`,
      isin, 50, 200
    );
    if (r) {
      console.log(`✓ BorsaIT obbligazioni/${cat}: ${isin} → ${r.price}`);
      return { symbol:isin, name:r.name||isin, price:r.price, currency:'EUR', mercato:'Borsa Italiana (MOT)', fonte:'borsaitaliana' };
    }
  }

  // ETF (prezzo in €: 0.5-10000)
  for (const suffix of ['ETFX', 'XETR', 'XMIL']) {
    const r = await fetchBI(
      `https://www.borsaitaliana.it/borsa/etf/scheda/${isin}-${suffix}.html`,
      isin, 0.5, 10000
    );
    if (r) {
      console.log(`✓ BorsaIT ETF (${suffix}): ${isin} → ${r.price}`);
      return { symbol:isin, name:r.name||isin, price:r.price, currency:'EUR', mercato:'Borsa Italiana (ETF)', fonte:'borsaitaliana' };
    }
  }

  // ETC/ETN — crypto ETP, commodity (prezzo in €: 0.5-10000)
  for (const suffix of ['ETCX', 'ETPX', 'XETR', 'XMIL']) {
    const r = await fetchBI(
      `https://www.borsaitaliana.it/borsa/etc-etn/scheda/${isin}-${suffix}.html`,
      isin, 0.5, 10000
    );
    if (r) {
      console.log(`✓ BorsaIT ETC/ETN (${suffix}): ${isin} → ${r.price}`);
      return { symbol:isin, name:r.name||isin, price:r.price, currency:'EUR', mercato:'Borsa Italiana (ETC/ETN)', fonte:'borsaitaliana' };
    }
  }

  console.log(`✗ BorsaIT: ${isin} non trovato`);
  return null;
}

// ── Rotte ─────────────────────────────────────────────────────────────────────
app.get('/ping', (req, res) => res.json({ message: 'Backend funzionante!' }));

app.get('/api/price/:ticker', async (req, res) => {
  const ticker   = req.params.ticker.toUpperCase();
  const isin     = req.query.isin ? req.query.isin.toUpperCase() : null;
  const cacheKey = isin || ticker;

  if (cache[cacheKey]) {
    console.log(`Cache: ${cacheKey}`);
    return res.json(cache[cacheKey]);
  }

  // 1. Yahoo con ISIN
  if (isin) {
    const r = await cercaSuYahoo(isin);
    if (r) { cache[cacheKey] = r; return res.json(r); }
  }

  // 2. Yahoo con ticker
  const rT = await cercaSuYahoo(ticker);
  if (rT) { cache[cacheKey] = rT; return res.json(rT); }

  // 3. Borsa Italiana con ISIN
  if (isin) {
    const rBI = await cercaSuBorsaItaliana(isin);
    if (rBI) { cache[cacheKey] = rBI; return res.json(rBI); }
  }

  console.log(`✗ Nessuna fonte: ${ticker} / ${isin}`);
  return res.status(404).json({ error: `Prezzo non trovato per ${ticker}` });
});

// ── Storico prezzi (Yahoo Finance, mensile, max 10 anni) ─────────────────────
app.get('/api/history/:symbol', async (req, res) => {
  const symbol   = req.params.symbol;
  const cacheKey = `history_${symbol}`;

  if (cache[cacheKey]) {
    return res.json(cache[cacheKey]);
  }

  // Prova diversi suffissi di mercato come per il prezzo corrente
  const candidati = symbol.includes('.') ? [symbol] : SUFFISSI.map(s => symbol + s);
  console.log(`Storico richiesto per: ${symbol} → candidati: ${candidati.join(', ')}`);

  for (const sym of candidati) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1mo&range=10y`;
      const r = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000
      });
      const result = r.data?.chart?.result?.[0];
      if (!result) continue;

      const timestamps = result.timestamp;
      const closes     = result.indicators?.quote?.[0]?.close;
      if (!timestamps || !closes) continue;

      const data = timestamps
        .map((ts, i) => ({
          data: (() => {
            // Aggiungi 12h per evitare shift di timezone (Yahoo usa mezzanotte UTC)
            const d = new Date((ts + 43200) * 1000);
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
          })(), // YYYY-MM
          prezzo: closes[i] != null ? Math.round(closes[i] * 100) / 100 : null,
        }))
        .filter(d => d.prezzo != null);

      if (data.length === 0) continue;

      const risposta = { symbol: sym, data };
      cache[cacheKey] = risposta;
      console.log(`✓ Storico: ${sym} — ${data.length} punti`);
      return res.json(risposta);
    } catch (e) { /* prossimo */ }
  }

  console.log(`✗ Storico non disponibile: ${symbol}`);
  return res.status(404).json({ error: 'Storico non disponibile' });
});

app.listen(PORT, () => console.log(`Backend avviato su http://localhost:${PORT}`));
