import express from 'express';
const router = express.Router();
import { asyncHandler } from '../lib/asyncHandler.js';
import technicalAnalysis from '../services/technicalAnalysis.js';
import prisma from '../lib/prisma.js';
import cache from '../lib/cache.js';

// Teknik göstergeleri getir
router.get('/:symbol/indicators', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { period = '1Y' } = req.query;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `analysis:indicators:${upperSymbol}:${period}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    // Periyoda göre tarih hesaplama
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1M': startDate.setMonth(now.getMonth() - 1); break;
      case '3M': startDate.setMonth(now.getMonth() - 3); break;
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      case '5Y': startDate.setFullYear(now.getFullYear() - 5); break;
      default: startDate.setFullYear(now.getFullYear() - 1);
    }

    const prices = await prisma.pricePoint.findMany({
      where: {
        stockTicker: upperSymbol,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    if (prices.length < 30) {
      throw new Error('Yetersiz veri');
    }

    const indicators = technicalAnalysis.calculateAllIndicators(prices);
    const trend = technicalAnalysis.analyzeTrend(prices);
    const signals = technicalAnalysis.generateSignals(indicators);

    return {
      symbol: upperSymbol,
      period,
      currentPrice: prices[prices.length - 1].close,
      indicators,
      trend,
      signals,
      dataPoints: prices.length,
    };
  }, cache.isMarketOpen() ? 60 : 600);

  res.json({
    success: true,
    data,
  });
}));

// Trend analizi
router.get('/:symbol/trend', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { period = '1Y' } = req.query;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `analysis:trend:${upperSymbol}:${period}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1M': startDate.setMonth(now.getMonth() - 1); break;
      case '3M': startDate.setMonth(now.getMonth() - 3); break;
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      case '5Y': startDate.setFullYear(now.getFullYear() - 5); break;
      default: startDate.setFullYear(now.getFullYear() - 1);
    }

    const prices = await prisma.pricePoint.findMany({
      where: {
        stockTicker: upperSymbol,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    if (prices.length < 50) {
      throw new Error('Yetersiz veri');
    }

    const trend = technicalAnalysis.analyzeTrend(prices);
    const sma20 = technicalAnalysis.calculateSMA(prices, 20);
    const sma50 = technicalAnalysis.calculateSMA(prices, 50);
    const sma200 = technicalAnalysis.calculateSMA(prices, 200);

    // Trend değişim noktaları
    const trendChanges = [];
    for (let i = 50; i < prices.length; i++) {
      const slice = prices.slice(0, i);
      const prevSlice = prices.slice(0, i - 1);
      
      const currentSMA20 = technicalAnalysis.calculateSMA(slice, 20);
      const prevSMA20 = technicalAnalysis.calculateSMA(prevSlice, 20);
      
      if (prevSMA20 && currentSMA20) {
        const prevTrend = prevSMA20 > technicalAnalysis.calculateSMA(prevSlice, 50) ? 'up' : 'down';
        const currentTrend = currentSMA20 > technicalAnalysis.calculateSMA(slice, 50) ? 'up' : 'down';
        
        if (prevTrend !== currentTrend) {
          trendChanges.push({
            date: prices[i - 1].date,
            from: prevTrend,
            to: currentTrend,
            price: prices[i - 1].close,
          });
        }
      }
    }

    return {
      symbol: upperSymbol,
      period,
      currentTrend: trend,
      movingAverages: { sma20, sma50, sma200 },
      trendChanges: trendChanges.slice(-10),
      totalChanges: trendChanges.length,
    };
  }, 300);

  res.json({
    success: true,
    data,
  });
}));

// Destek ve direnç seviyeleri
router.get('/:symbol/levels', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { period = '1Y' } = req.query;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `analysis:levels:${upperSymbol}:${period}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      case '5Y': startDate.setFullYear(now.getFullYear() - 5); break;
      default: startDate.setFullYear(now.getFullYear() - 1);
    }

    const prices = await prisma.pricePoint.findMany({
      where: {
        stockTicker: upperSymbol,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    if (prices.length < 30) {
      throw new Error('Yetersiz veri');
    }

    const levels = technicalAnalysis.calculateSupportResistance(prices);
    const fibonacci = technicalAnalysis.calculateFibonacciLevels(prices);
    const bollinger = technicalAnalysis.calculateBollingerBands(prices);

    const currentPrice = prices[prices.length - 1].close;

    return {
      symbol: upperSymbol,
      currentPrice,
      supportResistance: levels,
      fibonacciLevels: fibonacci,
      bollingerBands: bollinger,
      nearestSupport: levels.closestSupport,
      nearestResistance: levels.closestResistance,
      distanceToSupport: levels.closestSupport 
        ? ((currentPrice - levels.closestSupport) / currentPrice * 100).toFixed(2)
        : null,
      distanceToResistance: levels.closestResistance
        ? ((levels.closestResistance - currentPrice) / currentPrice * 100).toFixed(2)
        : null,
    };
  }, 300);

  res.json({
    success: true,
    data,
  });
}));

// Sinyaller
router.get('/:symbol/signals', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `analysis:signals:${upperSymbol}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const prices = await prisma.pricePoint.findMany({
      where: {
        stockTicker: upperSymbol,
        date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: 'asc' },
    });

    if (prices.length < 30) {
      throw new Error('Yetersiz veri');
    }

    const indicators = technicalAnalysis.calculateAllIndicators(prices);
    const signals = technicalAnalysis.generateSignals(indicators);

    // Sinyal gücü hesaplama
    const buySignals = signals.filter(s => s.signal === 'buy');
    const sellSignals = signals.filter(s => s.signal === 'sell');
    
    const buyStrength = buySignals.reduce((sum, s) => {
      return sum + (s.strength === 'strong' ? 3 : s.strength === 'medium' ? 2 : 1);
    }, 0);
    
    const sellStrength = sellSignals.reduce((sum, s) => {
      return sum + (s.strength === 'strong' ? 3 : s.strength === 'medium' ? 2 : 1);
    }, 0);

    let overallSignal = 'neutral';
    if (buyStrength > sellStrength * 1.5) overallSignal = 'strong_buy';
    else if (buyStrength > sellStrength) overallSignal = 'buy';
    else if (sellStrength > buyStrength * 1.5) overallSignal = 'strong_sell';
    else if (sellStrength > buyStrength) overallSignal = 'sell';

    return {
      symbol: upperSymbol,
      currentPrice: prices[prices.length - 1].close,
      overallSignal,
      buyStrength,
      sellStrength,
      signals,
      lastUpdated: new Date().toISOString(),
    };
  }, 60);

  res.json({
    success: true,
    data,
  });
}));

// Karşılaştırmalı analiz
router.post('/compare', asyncHandler(async (req, res) => {
  const { symbols, indicators = ['rsi', 'macd', 'sma20'] } = req.body;

  if (!Array.isArray(symbols) || symbols.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'En az 2 sembol gereklidir',
    });
  }

  const comparison = await Promise.all(
    symbols.map(async (symbol) => {
      const upperSymbol = symbol.toUpperCase();
      const prices = await prisma.pricePoint.findMany({
        where: {
          stockTicker: upperSymbol,
          date: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { date: 'asc' },
      });

      if (prices.length < 30) return null;

      const result = { symbol: upperSymbol };

      if (indicators.includes('rsi')) {
        result.rsi = technicalAnalysis.calculateRSI(prices);
      }
      if (indicators.includes('macd')) {
        result.macd = technicalAnalysis.calculateMACD(prices);
      }
      if (indicators.includes('sma20')) {
        result.sma20 = technicalAnalysis.calculateSMA(prices, 20);
      }
      if (indicators.includes('sma50')) {
        result.sma50 = technicalAnalysis.calculateSMA(prices, 50);
      }
      if (indicators.includes('bollinger')) {
        result.bollinger = technicalAnalysis.calculateBollingerBands(prices);
      }

      const trend = technicalAnalysis.analyzeTrend(prices);
      result.trend = trend.direction;
      result.trendStrength = trend.strength;
      result.currentPrice = prices[prices.length - 1].close;

      return result;
    })
  );

  res.json({
    success: true,
    data: comparison.filter(Boolean),
  });
}));

export default router;
