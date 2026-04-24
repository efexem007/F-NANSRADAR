// v6.0-F-NANSRADAR Gelistirme

import express from 'express';
import { predictAllHorizons } from '../services/multiHorizonPredictor.js';
import { runBacktest } from '../services/backtestEngine.js';
import { fullRiskAnalysis } from '../services/riskMetrics.js';
import { analyzeSignalAccuracy } from '../services/signalAccuracy.js';
import { fetchStockPrices } from '../services/yahooFinance.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /:symbol/full – tüm horizon tahminleri
router.get('/:symbol/full', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const priceData = await fetchStockPrices(symbol, '1y', '1d');
    if (!priceData || priceData.length === 0) {
      return res.status(404).json({ success: false, error: 'Fiyat verisi bulunamadı' });
    }
    const result = await predictAllHorizons(priceData, { simulations: 10000 });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /:symbol/backtest – backtest çalıştır
router.get('/:symbol/backtest', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const { period = 'ALL', holdingPeriod = 5, stopLoss = 0.08, takeProfit = 0.15 } = req.query;
    const priceData = await fetchStockPrices(symbol, '3y', '1d');
    if (!priceData || priceData.length === 0) {
      return res.status(404).json({ success: false, error: 'Fiyat verisi bulunamadı' });
    }
    const result = await runBacktest(symbol, priceData, {
      period,
      holdingPeriod: Number(holdingPeriod),
      stopLoss: Number(stopLoss),
      takeProfit: Number(takeProfit)
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /:symbol/risk – risk metrikleri
router.get('/:symbol/risk', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const priceData = await fetchStockPrices(symbol, '1y', '1d');
    if (!priceData || priceData.length < 60) {
      return res.status(400).json({ success: false, error: 'En az 60 günlük veri gereklidir' });
    }
    const returns = [];
    for (let i = 1; i < priceData.length; i++) {
      returns.push(Math.log(priceData[i].close / priceData[i - 1].close));
    }
    // Piyasa getirisi (BIST100) placeholder – gerçekte ayrıca fetch edilmeli
    const marketReturns = returns.map(() => (Math.random() - 0.5) * 0.02); // dummy
    const riskMetrics = fullRiskAnalysis(returns, marketReturns);
    res.json({ success: true, data: riskMetrics });
  } catch (error) {
    next(error);
  }
});

// GET /:symbol/accuracy – sinyal doğruluğu
router.get('/:symbol/accuracy', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const { lookbackDays = 365 } = req.query;
    const accuracy = await analyzeSignalAccuracy(symbol, { lookbackDays: Number(lookbackDays) });
    res.json({ success: true, data: accuracy });
  } catch (error) {
    next(error);
  }
});

export default router;
