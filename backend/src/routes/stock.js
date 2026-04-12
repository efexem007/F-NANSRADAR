import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { fetchStockPrices } from '../services/yahooFinance.js';
import { analyzeStock } from '../services/analysis.js';
import { getPredictionHistory } from '../services/predictionHistory.js';
const router = Router();

router.get('/list', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const [stocks, total] = await prisma.$transaction([
    prisma.stock.findMany({ include: { ratios: true }, take: limit, skip: offset, orderBy: { ticker: 'asc' } }),
    prisma.stock.count()
  ]);
  res.json({ data: stocks, total, limit, offset });
}));

router.get('/:ticker/price', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const { period = '3mo' } = req.query;
  const data = await fetchStockPrices(ticker, period);
  res.json(data);
}));

router.get('/:ticker/fundamental', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const stock = await prisma.stock.findUnique({ where: { ticker }, include: { fundamental: { orderBy: { period: 'desc' }, take: 1 }, ratios: true } });
  res.json(stock);
}));

// Tam indikatör analizi - sistemde olmayan hisseler de dahil
router.get('/:ticker/analyze', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const { period = '3mo' } = req.query;
  const result = await analyzeStock(ticker.toUpperCase(), period);
  res.json(result);
}));

// Tahmin geçmişi karşılaştırma
router.get('/:ticker/history', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const history = await getPredictionHistory(ticker.toUpperCase(), limit);
  res.json(history);
}));

export default router;
