import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, portfolioAddSchema } from '../lib/validate.js';
import { authenticate } from '../middleware/auth.js';
import { optimizePortfolio } from '../services/hrpOptimizer.js';
import { fetchStockPrices } from '../services/yahooFinance.js';
const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const portfolio = await prisma.portfolio.findFirst({ where: { userId: req.user.id }, include: { items: true } });
  if (!portfolio) return res.json({ items: [], summary: {} });
  const tickers = portfolio.items.map(i => i.ticker);
  const stocks = await prisma.stock.findMany({ where: { ticker: { in: tickers } } });
  const stockMap = {};
  stocks.forEach(s => stockMap[s.ticker] = s);
  let totalValue = 0, totalCost = 0;
  const items = portfolio.items.map(item => {
    const stock = stockMap[item.ticker] || {};
    const currentPrice = stock.lastPrice || 0;
    const value = item.shares * currentPrice;
    const cost = item.shares * item.avgCost;
    totalValue += value; totalCost += cost;
    return { ...item, currentPrice, value, pl: value - cost, plPercent: cost ? ((value-cost)/cost)*100 : 0 };
  });
  res.json({ ...portfolio, items, summary: { totalValue, totalCost, totalPL: totalValue-totalCost, totalPLPercent: totalCost ? ((totalValue-totalCost)/totalCost)*100 : 0 } });
}));

router.post('/add', validate(portfolioAddSchema), asyncHandler(async (req, res) => {
  const { ticker, shares, avgCost } = req.body;
  let portfolio = await prisma.portfolio.findFirst({ where: { userId: req.user.id } });
  if (!portfolio) portfolio = await prisma.portfolio.create({ data: { name: 'Ana Portfoy', userId: req.user.id } });
  const item = await prisma.portfolioItem.upsert({
    where: { portfolioId_ticker: { portfolioId: portfolio.id, ticker } },
    update: { shares, avgCost },
    create: { portfolioId: portfolio.id, ticker, shares, avgCost }
  });
  res.json(item);
}));

router.delete('/:ticker', asyncHandler(async (req, res) => {
  const portfolio = await prisma.portfolio.findFirst({ where: { userId: req.user.id } });
  if (!portfolio) return res.status(404).json({ error: 'Portfoy yok' });
  await prisma.portfolioItem.deleteMany({ where: { portfolioId: portfolio.id, ticker: req.params.ticker } });
  res.json({ success: true });
}));

// HRP Optimizasyonu - Phase 2 AI Portföy Optimizasyonu
router.post('/optimize', asyncHandler(async (req, res) => {
  const portfolio = await prisma.portfolio.findFirst({ 
    where: { userId: req.user.id }, 
    include: { items: true } 
  });
  
  if (!portfolio || portfolio.items.length < 2) {
    return res.status(400).json({ error: 'Optimizasyon için portföyde en az 2 hisse bulunmalıdır.' });
  }

  // Hisse fiyatlarını çek (son 6 ay verisi ile korelasyon ölçümü)
  const tickers = portfolio.items.map(i => i.ticker);
  const priceDataMap = {}; 
  
  for (const ticker of tickers) {
    try {
      const { priceData } = await fetchStockPrices(ticker, '6mo');
      if (priceData && priceData.length > 10) {
        priceDataMap[ticker] = priceData;
      }
    } catch (e) {
      console.warn(`${ticker} veri çekilemedi optimizasyon için atlanıyor.`);
    }
  }

  const validTickers = Object.keys(priceDataMap);
  if (validTickers.length < 2) {
    return res.status(400).json({ error: 'Analiz için yeterli geçmiş veri bulunamadı.' });
  }

  // Veri uzunluklarını eşitle (minimum length)
  const minLength = Math.min(...validTickers.map(t => priceDataMap[t].length));
  for (const t of validTickers) {
    priceDataMap[t] = priceDataMap[t].slice(-minLength);
  }

  // HRP Optimizasyonunu çalıştır
  const optimalWeights = optimizePortfolio(priceDataMap);

  res.json({
    assets: validTickers.length,
    weights: optimalWeights,
  });
}));

export default router;
