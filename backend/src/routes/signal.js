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
// PİYASAYI TARA — SSE (Server-Sent Events) ile canlı akış (OPTİMİZE)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/scan-all', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const write = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch(e) {}
  };

  // Keep-alive: her 12 saniyede bir boş ping gönder (nginx/proxy timeout'a karşı)
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch(e) { clearInterval(keepAlive); }
  }, 12000);

  // Timeout wrapper: bir hisse çok uzun sürerse otomatik atla
  const withTimeout = (fn, ms = 20000) => Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (20s)')), ms))
  ]);

  let successCount = 0;
  let failCount = 0;
  let processedCount = 0;

  try {
    const stocks = await prisma.stock.findMany({ select: { ticker: true } });
    const uniqueTickers = [...new Set(stocks.map(s => s.ticker.replace('.IS', '')))];
    const total = uniqueTickers.length;

    write('init', { total });

    const CONCURRENCY = 4; // 4 paralel hisse — Yahoo rate limit için optimal denge
    for (let i = 0; i < uniqueTickers.length; i += CONCURRENCY) {
      const chunk = uniqueTickers.slice(i, i + CONCURRENCY);
      
      await Promise.allSettled(chunk.map(async (symbol) => {
        const ticker = `${symbol}.IS`;
        processedCount++;
        try {
          const result = await withTimeout(() => analyzeStock(ticker));

          const signalData = {
            ticker: symbol,
            signal: result.signal || 'BEKLE',
            score: result.finalScore || 50,
            price: result.currentPrice || 0,
            rsi: result.indicators?.rsi?.raw != null ? parseFloat(result.indicators.rsi.raw.toFixed(1)) : null,
            macdHist: result.indicators?.macd?.raw?.hist != null ? parseFloat(result.indicators.macd.raw.hist.toFixed(3)) : null,
            regime: result.regime?.name || 'Sakin',
            createdAt: new Date().toISOString(),
            index: processedCount,
            total,
          };

          write('signal', signalData);
          successCount++;
        } catch (err) {
          write('error', { ticker: symbol, error: err.message, index: processedCount, total });
          failCount++;
        }
      }));

      // Her chunk'tan sonra kısa bekleme (Yahoo API koruması)
      await new Promise(r => setTimeout(r, 400));
    }
  } catch (fatalErr) {
    console.error('[scan-all FATAL]:', fatalErr.message);
    write('error', { ticker: 'SYSTEM', error: fatalErr.message, index: 0, total: 0 });
  } finally {
    clearInterval(keepAlive);
    write('done', { total: processedCount, success: successCount, failed: failCount });
    res.end();
  }
});


export default router;
