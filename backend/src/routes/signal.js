import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, signalCalcSchema } from '../lib/validate.js';
import { fundamentalScore, technicalScore, macroScore, calculateFinalSignal } from '../services/signal.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } from '../services/technical.js';
import { analyzeStock } from '../services/analysis.js';
import { createRequire } from 'module';

const require2 = createRequire(import.meta.url);
const bistMaster = require2('../data/bistMaster.json');

const router = Router();

// ─── Tek hisse sinyal hesaplama ────────────────────────────────────────
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

// ─── Geçmiş sinyalleri getir ───────────────────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  const recentPredictions = await prisma.predictionHistory.findMany({
    orderBy: { analysisDate: 'desc' },
  });

  const uniqueS = [];
  const tkSet = new Set();
  
  for (const p of recentPredictions) {
    if (!tkSet.has(p.ticker)) {
      tkSet.add(p.ticker);
      uniqueS.push({
        ticker: p.ticker,
        signal: p.signal,
        score: p.score,
        price: p.currentPrice,
        createdAt: p.analysisDate,
      });
    }
  }

  res.json(uniqueS);
}));

// ═══════════════════════════════════════════════════════════════════════════
// PİYASAYI TARA — SSE (Server-Sent Events) ile canlı akış
// Tüm BIST hisselerini tek tek tarar, her birini anında frontend'e gönderir
// ═══════════════════════════════════════════════════════════════════════════
router.get('/scan-all', async (req, res) => {
  // SSE başlıkları
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Tüm BIST hisselerini veritabanından çek (500+ Hisse)
  const stocks = await prisma.stock.findMany({
    select: { ticker: true }
  });
  
  // Ticker'ları işle (sonunda .IS olan/olmayan)
  const uniqueTickers = [...new Set(stocks.map(s => s.ticker.replace('.IS', '')))];
  const total = uniqueTickers.length;

  // Frontend'e toplam sayıyı bildir
  res.write(`event: init\ndata: ${JSON.stringify({ total })}\n\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < uniqueTickers.length; i++) {
    const symbol = uniqueTickers[i];
    const ticker = `${symbol}.IS`;

    try {
      const result = await analyzeStock(ticker);

      const signalData = {
        ticker: symbol,
        signal: result.signal || 'BEKLE',
        score: result.finalScore || 0,
        price: result.currentPrice || 0,
        rsi: result.indicators?.rsi?.raw ? parseFloat(result.indicators.rsi.raw.toFixed(1)) : null,
        macdHist: result.indicators?.macd?.raw?.hist ? parseFloat(result.indicators.macd.raw.hist.toFixed(3)) : null,
        regime: result.regime?.name || 'Sakin',
        createdAt: new Date().toISOString(),
        index: i + 1,
        total,
      };

      res.write(`event: signal\ndata: ${JSON.stringify(signalData)}\n\n`);
      successCount++;
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ ticker: symbol, error: err.message, index: i + 1, total })}\n\n`);
      failCount++;
    }

    // Rate limit — Yahoo API'yi boğmamak için
    await new Promise(r => setTimeout(r, 1200));
  }

  // Tarama bitti
  res.write(`event: done\ndata: ${JSON.stringify({ total, success: successCount, failed: failCount })}\n\n`);
  res.end();
});

export default router;
