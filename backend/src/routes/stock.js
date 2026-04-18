/**
 * FinansRadar — Stock Routes v2.0
 * ================================
 * Görev 18: Hisse doğrulama endpoint
 * Görev 19: Hisse listeleme API (filtreli, sayfalı)
 * Görev 20: Hisse arama API
 * Görev 35: Hisse ekleme API
 * Görev 38: Çoklu hisse ekleme
 */

import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { fetchStockPrices } from '../services/yahooFinance.js';
import { getAnalyzeStock } from '../services/analysis.js';
import { getPredictionHistory } from '../services/predictionHistory.js';
import {
  validateTicker,
  enrichStockInfo,
  batchEnrichStocks,
  discoverAndRegister,
  batchDiscover,
  searchStocks,
  listStocks,
  batchUpdatePrices,
} from '../services/stockDiscovery.js';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// GÖREV 19: HİSSE LİSTELEME (Filtreli, Sayfalı)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/list', asyncHandler(async (req, res) => {
  const {
    page, pageSize, type, sector, exchange, isActive,
    sortBy, sortOrder, minMarketCap, maxMarketCap, indexFilter
  } = req.query;

  const result = await listStocks({
    page: parseInt(page) || 1,
    pageSize: parseInt(pageSize) || 50,
    type: type || undefined,
    sector: sector || undefined,
    exchange: exchange || undefined,
    isActive: isActive === 'false' ? false : isActive === 'all' ? null : true,
    sortBy: sortBy || 'ticker',
    sortOrder: sortOrder || 'asc',
    minMarketCap: minMarketCap ? parseFloat(minMarketCap) : undefined,
    maxMarketCap: maxMarketCap ? parseFloat(maxMarketCap) : undefined,
    indexFilter: indexFilter || undefined,
  });

  res.json(result);
}));

// ═══════════════════════════════════════════════════════════════════════════
// GÖREV 20: HİSSE ARAMA (Fuzzy Search)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit, type } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Arama terimi gerekli (q parametresi)' });
  }

  const results = await searchStocks(q, {
    limit: parseInt(limit) || 20,
    type: type || undefined,
    includeScore: false,
  });

  res.json({ query: q, count: results.length, results });
}));

// ═══════════════════════════════════════════════════════════════════════════
// GÖREV 18: HİSSE DOĞRULAMA
// ═══════════════════════════════════════════════════════════════════════════

router.get('/validate/:ticker', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const result = await validateTicker(ticker);
  res.json(result);
}));

// ═══════════════════════════════════════════════════════════════════════════
// GÖREV 35: HİSSE EKLEME (Tekli Otomatik Keşif)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/discover', asyncHandler(async (req, res) => {
  const { ticker } = req.body;

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker gerekli' });
  }

  const result = await discoverAndRegister(ticker);
  
  if (result.action === 'error' || result.action === 'invalid') {
    return res.status(400).json(result);
  }

  res.json(result);
}));

// ═══════════════════════════════════════════════════════════════════════════
// GÖREV 38: ÇOKLU HİSSE EKLEME (Batch Discovery)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/discover/batch', asyncHandler(async (req, res) => {
  const { tickers } = req.body;

  if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
    return res.status(400).json({ error: 'tickers dizisi gerekli' });
  }

  if (tickers.length > 50) {
    return res.status(400).json({ error: 'Tek seferde en fazla 50 hisse eklenebilir' });
  }

  const result = await batchDiscover(tickers);
  res.json(result);
}));

// ═══════════════════════════════════════════════════════════════════════════
// GÖREV 17: HİSSE BİLGİSİ GÜNCELLEME (Enrichment)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/enrich/:ticker', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const result = await enrichStockInfo(ticker);
  res.json(result);
}));

router.post('/enrich-batch', asyncHandler(async (req, res) => {
  const { type = 'bist', limit = 20 } = req.body;
  
  const stocks = await prisma.stock.findMany({
    where: { isActive: true, type },
    select: { ticker: true },
    take: Math.min(parseInt(limit), 100),
    orderBy: { lastUpdate: 'asc' },
  });

  const tickers = stocks.map(s => s.ticker);
  const result = await batchEnrichStocks(tickers);
  res.json(result);
}));

// ═══════════════════════════════════════════════════════════════════════════
// BATCH FİYAT GÜNCELLEME
// ═══════════════════════════════════════════════════════════════════════════

router.post('/update-prices', asyncHandler(async (req, res) => {
  const { type = 'bist', batchSize = 10 } = req.body;
  const result = await batchUpdatePrices({ type, batchSize });
  res.json(result);
}));

// ═══════════════════════════════════════════════════════════════════════════
// SEKTÖR & İSTATİSTİK
// ═══════════════════════════════════════════════════════════════════════════

router.get('/sectors', asyncHandler(async (req, res) => {
  const sectors = await prisma.stock.groupBy({
    by: ['sector'],
    where: { isActive: true },
    _count: { ticker: true },
    _avg: { lastPrice: true },
    orderBy: { _count: { ticker: 'desc' } },
  });

  res.json({
    sectors: sectors.map(s => ({
      name: s.sector || 'Tanımsız',
      stockCount: s._count.ticker,
      avgPrice: s._avg.lastPrice ? parseFloat(s._avg.lastPrice.toFixed(2)) : null,
    })),
  });
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const [totalStocks, activeStocks, typeDistribution] = await Promise.all([
    prisma.stock.count(),
    prisma.stock.count({ where: { isActive: true } }),
    prisma.stock.groupBy({
      by: ['type'],
      _count: { ticker: true },
    }),
  ]);

  res.json({
    total: totalStocks,
    active: activeStocks,
    types: typeDistribution.map(t => ({ type: t.type, count: t._count.ticker })),
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// MEVCUT ENDPOINT'LER (Korundu)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/:ticker/price', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const { period = '3mo' } = req.query;
  const data = await fetchStockPrices(ticker, period);
  res.json(data);
}));

router.get('/:ticker/fundamental', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const stock = await prisma.stock.findUnique({
    where: { ticker },
    include: { fundamental: { orderBy: { period: 'desc' }, take: 1 }, ratios: true }
  });
  res.json(stock);
}));

// Tam indikatör analizi - sistemde olmayan hisseler de dahil
router.get('/:ticker/analyze', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const { period = '3mo' } = req.query;
  const result = await getAnalyzeStock(ticker.toUpperCase(), period);
  res.json(result);
}));

// Tahmin geçmişi karşılaştırma
import { auditStockData, auditAllData } from '../services/dataAudit.js';
// ... existing imports ...

router.get('/:ticker/audit', asyncHandler(async (req, res) => {
  const result = await auditStockData(req.params.ticker.toUpperCase());
  res.json(result);
}));

router.get('/audit/all', asyncHandler(async (req, res) => {
  const result = await auditAllData();
  res.json(result);
}));

export default router;
