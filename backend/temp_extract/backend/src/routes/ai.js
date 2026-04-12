const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const aiLearning = require('../services/aiLearningService');
const { prisma } = require('../lib/prisma');
const cache = require('../lib/cache');

// AI öğrenme istatistikleri
router.get('/stats', asyncHandler(async (req, res) => {
  const { symbol } = req.query;
  const stats = await aiLearning.getLearningStats(symbol);

  res.json({
    success: true,
    data: stats,
  });
}));

// Model performansı
router.get('/models/performance', asyncHandler(async (req, res) => {
  const { symbol } = req.query;
  const cacheKey = `ai:models:performance:${symbol || 'all'}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const performances = await prisma.modelPerformance.findMany({
      orderBy: { avgAccuracy: 'desc' },
    });

    let symbolPerformance = null;
    if (symbol) {
      const predictions = await prisma.prediction.findMany({
        where: {
          symbol: symbol.toUpperCase(),
          accuracy: { not: null },
        },
      });

      const methodStats = {};
      for (const pred of predictions) {
        if (!methodStats[pred.method]) {
          methodStats[pred.method] = { total: 0, accuracy: 0 };
        }
        methodStats[pred.method].total++;
        methodStats[pred.method].accuracy += pred.accuracy;
      }

      symbolPerformance = Object.entries(methodStats).map(([method, data]) => ({
        method,
        avgAccuracy: parseFloat((data.accuracy / data.total).toFixed(2)),
        predictions: data.total,
      }));
    }

    return {
      global: performances,
      symbol: symbol ? symbolPerformance : null,
    };
  }, 3600);

  res.json({
    success: true,
    data,
  });
}));

// Özellik önem analizi
router.get('/features/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const analysis = await aiLearning.analyzeFeatureImportance(symbol.toUpperCase());

  res.json({
    success: true,
    data: analysis,
  });
}));

// İyileştirme önerileri
router.get('/suggestions/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const suggestions = await aiLearning.getImprovementSuggestions(symbol.toUpperCase());

  res.json({
    success: true,
    data: suggestions,
  });
}));

// Model kalibrasyonu
router.get('/calibrate/:method', asyncHandler(async (req, res) => {
  const { method } = req.params;
  const calibration = await aiLearning.calibrateModel(method);

  res.json({
    success: true,
    data: calibration,
  });
}));

// Piyasa koşulu tespiti
router.post('/market-condition', asyncHandler(async (req, res) => {
  const { symbol } = req.body;
  const upperSymbol = symbol.toUpperCase();

  const prices = await prisma.stockPrice.findMany({
    where: {
      stock: { symbol: upperSymbol },
      date: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { date: 'asc' },
  });

  if (prices.length < 50) {
    return res.status(400).json({
      success: false,
      error: 'Yetersiz veri',
    });
  }

  const condition = aiLearning.detectMarketCondition(prices);

  res.json({
    success: true,
    data: {
      symbol: upperSymbol,
      marketCondition: condition,
      dataPoints: prices.length,
    },
  });
}));

// Adaptif ağırlıklar
router.get('/adaptive-weights/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const upperSymbol = symbol.toUpperCase();

  const prices = await prisma.stockPrice.findMany({
    where: {
      stock: { symbol: upperSymbol },
      date: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { date: 'asc' },
  });

  const weights = await aiLearning.getAdaptiveWeights(upperSymbol, { prices });

  res.json({
    success: true,
    data: {
      symbol: upperSymbol,
      adaptiveWeights: weights,
    },
  });
}));

// Tüm tahminleri listele
router.get('/predictions', asyncHandler(async (req, res) => {
  const { symbol, method, limit = 50, evaluated } = req.query;

  const whereClause = {};
  if (symbol) whereClause.symbol = symbol.toUpperCase();
  if (method) whereClause.method = method;
  if (evaluated === 'true') whereClause.accuracy = { not: null };
  if (evaluated === 'false') whereClause.accuracy = null;

  const predictions = await prisma.prediction.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit),
  });

  res.json({
    success: true,
    data: predictions,
  });
}));

// AI öğrenmeyi aç/kapat
router.post('/toggle-learning', asyncHandler(async (req, res) => {
  const { enabled } = req.body;

  aiLearning.learningEnabled = enabled;

  res.json({
    success: true,
    data: {
      learningEnabled: aiLearning.learningEnabled,
    },
  });
}));

module.exports = router;
