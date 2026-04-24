import express from 'express';
const router = express.Router();
import { asyncHandler } from '../lib/asyncHandler.js';
import predictionService from '../services/predictionService.js';
import aiLearning from '../services/aiLearningService.js';
import prisma from '../lib/prisma.js';
import cache from '../lib/cache.js';
import logger from '../lib/logger.js';
import { GARCHModel } from '../services/volatilityModel.js';
import { estimateJumpParams, simulateMJD, calculateFullPercentiles, calculatePriceDistribution, calculatePathStatistics, selectRepresentativePaths } from '../services/prediction.js';

// Fiyat tahmini (tüm metodlar)
router.get('/:symbol/comprehensive', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { days = 30, period = '1Y' } = req.query;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `prediction:comprehensive:${upperSymbol}:${days}:${period}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      case '2Y': startDate.setFullYear(now.getFullYear() - 2); break;
      case '5Y': startDate.setFullYear(now.getFullYear() - 5); break;
      default: startDate.setFullYear(now.getFullYear() - 1);
    }

    const prices = await prisma.stockPrice.findMany({
      where: {
        stock: { symbol: upperSymbol },
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    if (prices.length < 60) {
      throw new Error('Yetersiz veri (en az 60 gün gerekli)');
    }

    const prediction = await predictionService.comprehensivePrediction(prices, parseInt(days));
    
    // Tahmini kaydet (öğrenme için)
    await aiLearning.savePrediction({
      symbol: upperSymbol,
      method: 'comprehensive',
      predictedPrice: prediction.predictedPrice,
      targetDate: prediction.predictions[prediction.predictions.length - 1].date,
      confidence: prediction.confidence,
      features: { dataPoints: prices.length },
      marketCondition: aiLearning.detectMarketCondition(prices),
    });

    return prediction;
  }, 300);

  res.json({
    success: true,
    data,
  });
}));

// Teknik göstergelerle tahmin
router.get('/:symbol/technical', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { days = 30 } = req.query;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `prediction:technical:${upperSymbol}:${days}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const prices = await prisma.stockPrice.findMany({
      where: {
        stock: { symbol: upperSymbol },
        date: { gte: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: 'asc' },
    });

    if (prices.length < 60) {
      throw new Error('Yetersiz veri');
    }

    const prediction = await predictionService.technicalPrediction(prices, parseInt(days));

    await aiLearning.savePrediction({
      symbol: upperSymbol,
      method: 'technical',
      predictedPrice: prediction.predictedPrice,
      targetDate: prediction.predictions[prediction.predictions.length - 1].date,
      confidence: prediction.confidence,
      features: prediction.technicalFactors,
      marketCondition: aiLearning.detectMarketCondition(prices),
    });

    return prediction;
  }, 300);

  res.json({
    success: true,
    data,
  });
}));

// Monte Carlo simülasyonu (v6.0-F-NANSRADAR)
router.get('/:symbol/montecarlo', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { days = 30, simulations = 5000, useGARCH = true, timeFrame = '1D' } = req.query;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `prediction:montecarlo:${upperSymbol}:${days}:${simulations}:${useGARCH}:${timeFrame}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const prices = await prisma.stockPrice.findMany({
      where: {
        stock: { symbol: upperSymbol },
        date: { gte: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: 'asc' },
    });

    if (prices.length < 60) {
      throw new Error('Yetersiz veri');
    }

    return predictionService.monteCarloSimulate(
      prices, 
      parseInt(days), 
      parseInt(simulations),
      useGARCH === 'true',
      timeFrame
    );
  }, 600);

  res.json({
    success: true,
    data,
  });
}));

// Detaylı Monte Carlo raporu (v6.0-F-NANSRADAR)
router.get('/:symbol/montecarlo/detailed', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { days = 30, simulations = 5000 } = req.query;
  const upperSymbol = symbol.toUpperCase();

  const prices = await prisma.stockPrice.findMany({
    where: {
      stock: { symbol: upperSymbol },
      date: { gte: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { date: 'asc' },
  });

  if (prices.length < 60) {
    throw new Error('Yetersiz veri');
  }

  const garch = new GARCHModel();
  const returns = prices.slice(1).map((p, i) => Math.log(p.close / prices[i].close));
  garch.fit(returns);

  const jumpParams = estimateJumpParams(returns);
  const paths = simulateMJD(prices[prices.length - 1].close, 0, 0.2, parseInt(days), parseInt(simulations), jumpParams);
  const percentiles = calculateFullPercentiles(paths);
  const dist = calculatePriceDistribution(paths, parseInt(days));
  const pathStats = calculatePathStatistics(paths);

  res.json({
    success: true,
    data: {
      priceDistribution: dist,
      pathStatistics: pathStats,
      percentiles,
      representativePaths: selectRepresentativePaths(paths)
    }
  });
}));

// Tahmin geçmişi
router.get('/:symbol/history', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { limit = 50 } = req.query;
  const upperSymbol = symbol.toUpperCase();

  const predictions = await prisma.prediction.findMany({
    where: { symbol: upperSymbol },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit),
  });

  res.json({
    success: true,
    data: predictions,
  });
}));

// Tahmin doğruluğu
router.get('/:symbol/accuracy', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const upperSymbol = symbol.toUpperCase();

  const predictions = await prisma.prediction.findMany({
    where: {
      symbol: upperSymbol,
      accuracy: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (predictions.length === 0) {
    return res.json({
      success: true,
      data: {
        message: 'Henüz değerlendirilmiş tahmin yok',
        totalPredictions: 0,
      },
    });
  }

  const methodAccuracy = {};
  for (const pred of predictions) {
    if (!methodAccuracy[pred.method]) {
      methodAccuracy[pred.method] = { total: 0, accuracy: 0 };
    }
    methodAccuracy[pred.method].total++;
    methodAccuracy[pred.method].accuracy += pred.accuracy;
  }

  const avgAccuracy = predictions.reduce((sum, p) => sum + p.accuracy, 0) / predictions.length;

  res.json({
    success: true,
    data: {
      symbol: upperSymbol,
      totalPredictions: predictions.length,
      averageAccuracy: parseFloat(avgAccuracy.toFixed(2)),
      methodPerformance: Object.entries(methodAccuracy).map(([method, data]) => ({
        method,
        avgAccuracy: parseFloat((data.accuracy / data.total).toFixed(2)),
        predictions: data.total,
      })),
      recentPredictions: predictions.slice(0, 10),
    },
  });
}));

// Tahmin değerlendir (manuel)
router.post('/:symbol/evaluate', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { actualPrice } = req.body;
  const upperSymbol = symbol.toUpperCase();

  if (!actualPrice) {
    return res.status(400).json({
      success: false,
      error: 'Gerçek fiyat gereklidir',
    });
  }

  await aiLearning.evaluatePredictions(upperSymbol, parseFloat(actualPrice));

  res.json({
    success: true,
    message: 'Tahminler değerlendirildi',
  });
}));

// Çoklu hisse tahmini
router.post('/batch', asyncHandler(async (req, res) => {
  const { symbols, days = 30 } = req.body;

  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Sembol listesi gereklidir',
    });
  }

  if (symbols.length > 10) {
    return res.status(400).json({
      success: false,
      error: 'En fazla 10 sembol aynı anda tahmin edilebilir',
    });
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const upperSymbol = symbol.toUpperCase();
      try {
        const prices = await prisma.stockPrice.findMany({
          where: {
            stock: { symbol: upperSymbol },
            date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { date: 'asc' },
        });

        if (prices.length < 60) {
          return { symbol: upperSymbol, error: 'Yetersiz veri' };
        }

        const prediction = await predictionService.comprehensivePrediction(prices, parseInt(days));
        return { symbol: upperSymbol, ...prediction };
      } catch (error) {
        return { symbol: upperSymbol, error: error.message };
      }
    })
  );

  res.json({
    success: true,
    data: results,
  });
}));

export default router;
