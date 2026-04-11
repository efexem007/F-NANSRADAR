import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, signalCalcSchema } from '../lib/validate.js';
import { fundamentalScore, technicalScore, macroScore, calculateFinalSignal } from '../services/signal.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } from '../services/technical.js';
const router = Router();

router.post('/calculate', validate(signalCalcSchema), asyncHandler(async (req, res) => {
  const { ticker } = req.body;
  const stock = await prisma.stock.findUnique({ where: { ticker }, include: { ratios: true, fundamental: { orderBy: { period: 'desc' }, take: 1 } } });
  const prices = await prisma.pricePoint.findMany({ where: { stockTicker: ticker }, orderBy: { date: 'asc' }, take: 50 });
  const cds = await prisma.macroIndicator.findFirst({ where: { type: 'CDS' }, orderBy: { date: 'desc' } });
  const vix = await prisma.macroIndicator.findFirst({ where: { type: 'VIX' }, orderBy: { date: 'desc' } });
  let fundScore = 50, techScoreVal = 50, macroScoreVal = 50;
  if (stock?.ratios) fundScore = fundamentalScore(stock.ratios);
  if (prices.length >= 14) {
    const rsi14 = calculateRSI(prices);
    const macd = calculateMACD(prices);
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const bollinger = calculateBollinger(prices);
    const currentPrice = prices[prices.length-1].close;
    techScoreVal = technicalScore({ rsi14, macdHist: macd?.hist, sma20, sma50, bollingerLower: bollinger?.lower, currentPrice });
  }
  if (cds && vix) macroScoreVal = macroScore(cds.value, vix.value);
  const { signal, score } = calculateFinalSignal(fundScore, techScoreVal, macroScoreVal);
  const lastPrice = prices.length ? prices[prices.length-1].close : null;
  await prisma.signalHistory.create({ data: { ticker, signal, score, price: lastPrice || 0 } });
  res.json({ ticker, signal, score, fundScore, techScore: techScoreVal, macroScore: macroScoreVal });
}));

router.get('/history', asyncHandler(async (req, res) => {
  // SQLite compatible: get the latest signal for each ticker
  const latestSignals = await prisma.signalHistory.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['ticker'],
  });
  res.json(latestSignals);
}));

export default router;
