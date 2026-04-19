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
    'X-Accel-Buffering': 'no'
  });

  // ─── Client kopma algılama ───
  let clientDisconnected = false;
  req.on('close', () => { clientDisconnected = true; });

  // ─── Güvenli yazma fonksiyonu (bağlantı kopmuşsa sessizce geç) ───
  const safeSend = (event, data) => {
    if (clientDisconnected) return false;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (e) {
      clientDisconnected = true;
      return false;
    }
  };

  // Keep-alive: 12sn'de bir ping (proxy timeout'larına karşı)
  const keepAliveTimer = setInterval(() => {
    if (clientDisconnected) { clearInterval(keepAliveTimer); return; }
    try { res.write(': ping\n\n'); } catch(e) { clientDisconnected = true; clearInterval(keepAliveTimer); }
  }, 12000);

  // Timeout wrapper (tek hisse max 20sn)
  const analyzeWithTimeout = (fn, ms = 20000) => Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (20s)')), ms))
  ]);

  const market = req.query.market || 'all';
  const customSymbolsStr = req.query.symbols;
  let totalScanned = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;

  try {
    const { analyzeAsset } = await import('../services/universalScanner.js');

    // ─── Sembol listesini hazırla ───
    let allSymbols = [];

    if (customSymbolsStr) {
      // Özel sembol listesi
      allSymbols = customSymbolsStr.split(',').map(s => s.trim()).filter(s => s).map(sym => {
        let type = 'bist';
        if (sym.includes('-USD') || sym.includes('-USDT')) type = 'crypto';
        else if (sym.includes('=X')) type = 'forex';
        else if (sym.includes('=F')) type = 'commodity';
        return { symbol: sym, name: sym, type };
      });
    } else {
      // Standart piyasa evreni
      const universes = market === 'all' ? Object.keys(ASSET_UNIVERSES) : [market];
      for (const uniKey of universes) {
        if (!ASSET_UNIVERSES[uniKey]) continue;
        if (uniKey === 'bist') {
          const { default: prisma } = await import('../lib/prisma.js');
          const dbStocks = await prisma.stock.findMany({ select: { ticker: true, name: true } });
          allSymbols.push(...dbStocks.map(s => ({ symbol: s.ticker, name: s.name, type: 'bist' })));
        } else {
          allSymbols.push(...(ASSET_UNIVERSES[uniKey].symbols || []).map(s => ({ ...s, type: uniKey })));
        }
      }
    }

    const total = allSymbols.length;
    safeSend('progress', { current: 0, total, text: `${total} varlık taranacak...` });

    // ─── Ana tarama döngüsü (4'lü chunk, her hisse bağımsız) ───
    const CONCURRENCY = 4;
    for (let i = 0; i < allSymbols.length; i += CONCURRENCY) {
      // Client kopmuşsa döngüyü kes
      if (clientDisconnected) break;

      const chunk = allSymbols.slice(i, i + CONCURRENCY);

      await Promise.allSettled(chunk.map(async (item) => {
        if (clientDisconnected) return; // Zaten kapandıysa boşuna çalışma

        totalScanned++;
        try {
          const analyzed = await analyzeWithTimeout(() => analyzeAsset(item.symbol, item.name, item.type));

          if (analyzed && analyzed.currentPrice > 0) {
            safeSend('assetAnalyzed', analyzed);
            totalSuccess++;
          } else {
            totalSkipped++;
            safeSend('assetSkipped', { symbol: item.symbol, reason: 'Fiyat bilgisi alınamadı' });
          }
        } catch (err) {
          totalSkipped++;
          safeSend('assetSkipped', { symbol: item.symbol, reason: err.message || 'Bilinmeyen hata' });
        }

        // Her hisseden sonra ilerleme gönder
        safeSend('progress', { current: totalScanned, total, text: `${totalScanned}/${total} tarandı` });
      }));

      // Rate limit koruması: her 4 hisseden sonra 350ms bekle
      if (!clientDisconnected) {
        await new Promise(r => setTimeout(r, 350));
      }
    }
  } catch (fatalErr) {
    console.error('[SSE FATAL]:', fatalErr.message);
    safeSend('error', { message: fatalErr.message });
  } finally {
    clearInterval(keepAliveTimer);
    safeSend('done', { 
      message: 'Tarama tamamlandı!', 
      totalScanned, 
      totalSuccess, 
      totalSkipped 
    });
    try { res.end(); } catch(e) {}
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
