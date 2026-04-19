import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { scanMarket, generateAIPicks, addToWatchlist, removeFromWatchlist, getWatchlist, ASSET_UNIVERSES } from '../services/universalScanner.js';

const router = Router();
router.use(authenticate);

// ─── Mevcut piyasa evreni listesi (Seçenekler) ────────────────────────
router.get('/universes', (req, res) => {
  const summary = {};
  for (const [key, val] of Object.entries(ASSET_UNIVERSES)) {
    summary[key] = { label: val.label, icon: val.icon, count: val.symbols.length };
  }
  res.json(summary);
});

// ─── Belirli bir piyasayı tara (veya hepsini) ─────────────────────────
// GET /universal/scan?market=forex   veya  ?market=all
router.get('/scan', asyncHandler(async (req, res) => {
  const market = req.query.market || 'all';
  const result = await scanMarket(market);
  res.json(result);
}));

// ─── Canlı tarama (SSE - Server Sent Events) ────────────────────────
router.get('/scan-stream', async (req, res) => {
  // SSE Header ayarları
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // nginx proxy buffering'i kapat
  });

  const market = req.query.market || 'all';
  const customSymbolsStr = req.query.symbols;
  
  const notify = (type, data) => {
    try { res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); } catch(e) {}
  };

  // Keep-alive: bağlantıyı 30 saniyede bir ayakta tut (proxy timeout'larına karşı)
  const keepAliveTimer = setInterval(() => {
    try { res.write(': ping\n\n'); } catch(e) { clearInterval(keepAliveTimer); }
  }, 15000);

  // Timeout ile güvenli analiz wrapper'ı (tek hisse 25sn'yi aşarsa atla)
  const analyzeWithTimeout = (analyzeFn, timeoutMs = 25000) => {
    return Promise.race([
      analyzeFn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
    ]);
  };

  let totalScanned = 0;

  try {
    const { analyzeAsset } = await import('../services/universalScanner.js');

    // DURUM 1: Özel sembol listesi tarama
    if (customSymbolsStr) {
      const customSymbols = customSymbolsStr.split(',').map(s => s.trim()).filter(s => s);
      const CONCURRENCY = 3; // Özel listede daha az concurrent (daha stabil)
      notify('progress', { current: 0, total: customSymbols.length, text: 'Tarama başlatılıyor...' });

      for (let i = 0; i < customSymbols.length; i += CONCURRENCY) {
        const chunk = customSymbols.slice(i, i + CONCURRENCY);
        await Promise.allSettled(chunk.map(async (sym) => {
          try {
            let type = 'bist';
            if (sym.includes('-USD') || sym.includes('-USDT')) type = 'crypto';
            else if (sym.includes('=X')) type = 'forex';
            else if (sym.includes('=F')) type = 'commodity';

            const analyzed = await analyzeWithTimeout(() => analyzeAsset(sym, sym, type));
            totalScanned++;
            if (analyzed && analyzed.currentPrice > 0) {
              notify('assetAnalyzed', analyzed);
            }
            notify('progress', { current: totalScanned, total: customSymbols.length });
          } catch (e) {
            totalScanned++;
            notify('assetSkipped', { symbol: sym, reason: e.message });
            notify('progress', { current: totalScanned, total: customSymbols.length });
          }
        }));
        await new Promise(r => setTimeout(r, 200));
      }
    } 
    // DURUM 2: Standart piyasa evreni tarama
    else {
      const universes = market === 'all' 
        ? Object.keys(ASSET_UNIVERSES) 
        : [market];

      // Önce toplam sayıyı hesapla (progress için)
      let allSymbols = [];
      for (const uniKey of universes) {
        if (!ASSET_UNIVERSES[uniKey]) continue;
        if (uniKey === 'bist') {
          const { default: prisma } = await import('../lib/prisma.js');
          const dbStocks = await prisma.stock.findMany({ select: { ticker: true, name: true } });
          allSymbols.push(...dbStocks.map(s => ({ symbol: s.ticker, name: s.name, flag: '🇹🇷', type: 'bist' })));
        } else {
          allSymbols.push(...(ASSET_UNIVERSES[uniKey].symbols || []).map(s => ({ ...s, type: uniKey })));
        }
      }

      notify('progress', { current: 0, total: allSymbols.length, text: `${allSymbols.length} varlık taranacak...` });

      const CONCURRENCY = 4; // 4'lü concurrent - Yahoo rate limitine karşı dengeli
      for (let i = 0; i < allSymbols.length; i += CONCURRENCY) {
        const chunk = allSymbols.slice(i, i + CONCURRENCY);
        await Promise.allSettled(chunk.map(async (item) => {
          try {
            const analyzed = await analyzeWithTimeout(() => analyzeAsset(item.symbol, item.name, item.type));
            totalScanned++;
            if (analyzed && analyzed.currentPrice > 0) {
              notify('assetAnalyzed', analyzed);
            }
            notify('progress', { current: totalScanned, total: allSymbols.length });
          } catch (e) {
            totalScanned++;
            notify('assetSkipped', { symbol: item.symbol, reason: e.message });
            notify('progress', { current: totalScanned, total: allSymbols.length });
          }
        }));
        // Rate limit tampon süresi: her 4 hisseden sonra 300ms bekle
        await new Promise(r => setTimeout(r, 300));
      }
    }
  } catch(e) {
    console.error('[SSE FATAL]:', e.message);
    notify('error', { message: e.message });
  } finally {
    clearInterval(keepAliveTimer);
    notify('done', { message: 'Tarama tamamlandı!', totalScanned });
    res.end();
  }
});


// ─── AI Önerileri (Scan sonuçlarına göre) ──────────────────────────────
router.post('/ai-picks', asyncHandler(async (req, res) => {
  const { scanResults } = req.body;
  // scanResults yoksa hepsini tara
  const data = scanResults || await scanMarket('all');
  const picks = generateAIPicks(data);
  res.json(picks);
}));

// ─── Tekil varlık taraması ─────────────────────────────────────────────
router.get('/scan/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const type = req.query.type || 'bist';
  
  // universalScanner'dan import dinamik analiz
  const { default: yahoo } = await import('yahoo-finance2');
  const { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } = await import('../services/technical.js');
  
  // analyzeAsset modül-düzeyinde export değil, scanMarket içinde. 
  // Tek sembol için scanMarket ile çalıştıralım (küçük evren):
  const tmpUniverse = { [type]: { label: '', icon: '', symbols: [{ symbol, name: symbol, flag: '' }], suffix: '' } };
  
  // Direkt importla:
  const result = await scanMarket(type);
  const found = result.results.find(r => r.symbol === symbol);
  
  if (found) {
    res.json(found);
  } else {
    res.status(404).json({ error: `${symbol} bulunamadı veya analiz edilemedi` });
  }
}));

// ═══ WATCHLIST ═══════════════════════════════════════════════════════════

// Takip listesi al
router.get('/watchlist', asyncHandler(async (req, res) => {
  const items = await getWatchlist(req.user.id);
  res.json(items);
}));

// Takip listesine ekle
router.post('/watchlist', asyncHandler(async (req, res) => {
  const { symbol, name, assetType, targetPrice, stopLoss, notes, tags } = req.body;
  const item = await addToWatchlist(req.user.id, { symbol, name, assetType, targetPrice, stopLoss, notes, tags });
  res.json(item);
}));

// Takip listesinden çıkar
router.delete('/watchlist/:symbol', asyncHandler(async (req, res) => {
  await removeFromWatchlist(req.user.id, req.params.symbol);
  res.json({ success: true });
}));

export default router;
