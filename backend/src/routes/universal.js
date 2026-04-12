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
