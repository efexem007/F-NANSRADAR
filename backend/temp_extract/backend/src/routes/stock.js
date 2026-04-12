const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { stockRateLimit } = require('../middleware/smartRateLimit');
const cache = require('../lib/cache');
const { prisma } = require('../lib/prisma');
const logger = require('../lib/logger');
const { addJob } = require('../lib/queue');

// Rate limiting
router.use(stockRateLimit);

// Hisse senedi detayları (cache'li)
router.get('/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `stock:detail:${upperSymbol}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    // Veritabanından veya harici API'den çek
    const stock = await prisma.stock.findUnique({
      where: { symbol: upperSymbol },
      include: {
        prices: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        company: true,
      },
    });

    if (!stock) {
      throw new Error('Hisse senedi bulunamadı');
    }

    return stock;
  }, 60); // 60 saniye cache

  res.json({
    success: true,
    data,
    cached: false,
  });
}));

// Hisse senedi fiyat geçmişi (periyot bazlı)
router.get('/:symbol/history', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { period = '1M', interval = '1d' } = req.query;
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `stock:history:${upperSymbol}:${period}:${interval}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    // Periyoda göre tarih hesaplama
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case '1D': startDate.setDate(now.getDate() - 1); break;
      case '1W': startDate.setDate(now.getDate() - 7); break;
      case '1M': startDate.setMonth(now.getMonth() - 1); break;
      case '3M': startDate.setMonth(now.getMonth() - 3); break;
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      case '5Y': startDate.setFullYear(now.getFullYear() - 5); break;
      case 'ALL': startDate = new Date('2000-01-01'); break;
      default: startDate.setMonth(now.getMonth() - 1);
    }

    const prices = await prisma.stockPrice.findMany({
      where: {
        stock: { symbol: upperSymbol },
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });

    return prices;
  }, cache.isMarketOpen() ? 30 : 3600);

  res.json({
    success: true,
    data: {
      symbol: upperSymbol,
      period,
      interval,
      prices: data,
    },
  });
}));

// Çoklu hisse senedi fiyatları (batch)
router.post('/prices', asyncHandler(async (req, res) => {
  const { symbols } = req.body;

  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Sembol listesi gereklidir',
    });
  }

  if (symbols.length > 50) {
    return res.status(400).json({
      success: false,
      error: 'En fazla 50 sembol sorgulanabilir',
    });
  }

  const upperSymbols = symbols.map(s => s.toUpperCase());
  const results = await Promise.all(
    upperSymbols.map(async (symbol) => {
      const cacheKey = `stock:price:${symbol}`;
      return cache.getOrSet(cacheKey, async () => {
        const price = await prisma.stockPrice.findFirst({
          where: { stock: { symbol } },
          orderBy: { date: 'desc' },
          include: { stock: { select: { name: true, symbol: true } } },
        });
        return price;
      }, 30);
    })
  );

  res.json({
    success: true,
    data: results.filter(Boolean),
  });
}));

// Hisse senedi arama
router.get('/search/:query', asyncHandler(async (req, res) => {
  const { query } = req.params;
  const cacheKey = `stock:search:${query.toLowerCase()}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const stocks = await prisma.stock.findMany({
      where: {
        OR: [
          { symbol: { contains: query.toUpperCase() } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: {
        symbol: true,
        name: true,
        sector: true,
        prices: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { close: true, change: true },
        },
      },
    });
    return stocks;
  }, 300); // 5 dakika cache

  res.json({
    success: true,
    data,
  });
}));

// Popüler hisse senetleri
router.get('/trending/popular', asyncHandler(async (req, res) => {
  const cacheKey = 'stock:trending:popular';

  const data = await cache.getOrSet(cacheKey, async () => {
    const stocks = await prisma.stock.findMany({
      where: { isPopular: true },
      take: 20,
      include: {
        prices: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { close: true, change: true, volume: true },
        },
      },
    });
    return stocks;
  }, 300);

  res.json({
    success: true,
    data,
  });
}));

// En çok kazanan/kaybeden
router.get('/market/movers', asyncHandler(async (req, res) => {
  const { type = 'gainers', limit = 10 } = req.query;
  const cacheKey = `stock:movers:${type}:${limit}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const orderBy = type === 'gainers' 
      ? { change: 'desc' } 
      : { change: 'asc' };

    const prices = await prisma.stockPrice.findMany({
      where: {
        date: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Son 24 saat
        },
      },
      orderBy,
      take: parseInt(limit),
      include: {
        stock: {
          select: { symbol: true, name: true },
        },
      },
    });

    return prices;
  }, 60);

  res.json({
    success: true,
    data,
  });
}));

// Sektör performansı
router.get('/sectors/performance', asyncHandler(async (req, res) => {
  const cacheKey = 'stock:sectors:performance';

  const data = await cache.getOrSet(cacheKey, async () => {
    const sectors = await prisma.stock.groupBy({
      by: ['sector'],
      _count: { symbol: true },
    });

    const sectorPerformance = await Promise.all(
      sectors.map(async (sector) => {
        const stocks = await prisma.stock.findMany({
          where: { sector: sector.sector },
          include: {
            prices: {
              orderBy: { date: 'desc' },
              take: 2, // Bugün ve dün
            },
          },
        });

        const avgChange = stocks.reduce((sum, stock) => {
          const prices = stock.prices;
          if (prices.length >= 2) {
            const change = ((prices[0].close - prices[1].close) / prices[1].close) * 100;
            return sum + change;
          }
          return sum;
        }, 0) / (stocks.length || 1);

        return {
          sector: sector.sector,
          stockCount: sector._count.symbol,
          avgChange: parseFloat(avgChange.toFixed(2)),
        };
      })
    );

    return sectorPerformance.sort((a, b) => b.avgChange - a.avgChange);
  }, 300);

  res.json({
    success: true,
    data,
  });
}));

// Hisse senedi karşılaştırma
router.post('/compare', asyncHandler(async (req, res) => {
  const { symbols, period = '1M' } = req.body;

  if (!Array.isArray(symbols) || symbols.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'En az 2 sembol gereklidir',
    });
  }

  const upperSymbols = symbols.map(s => s.toUpperCase());
  const cacheKey = `stock:compare:${upperSymbols.join(',')}:${period}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1M': startDate.setMonth(now.getMonth() - 1); break;
      case '3M': startDate.setMonth(now.getMonth() - 3); break;
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      default: startDate.setMonth(now.getMonth() - 1);
    }

    const comparison = await Promise.all(
      upperSymbols.map(async (symbol) => {
        const prices = await prisma.stockPrice.findMany({
          where: {
            stock: { symbol },
            date: { gte: startDate },
          },
          orderBy: { date: 'asc' },
          select: { date: true, close: true },
        });

        if (prices.length === 0) return null;

        const firstPrice = prices[0].close;
        const lastPrice = prices[prices.length - 1].close;
        const change = ((lastPrice - firstPrice) / firstPrice) * 100;

        return {
          symbol,
          prices: prices.map(p => ({
            date: p.date,
            normalizedPrice: (p.close / firstPrice) * 100,
          })),
          change: parseFloat(change.toFixed(2)),
        };
      })
    );

    return comparison.filter(Boolean);
  }, 300);

  res.json({
    success: true,
    data,
  });
}));

// Fiyat alarmı oluştur
router.post('/:symbol/alert', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { targetPrice, condition, type = 'price' } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Giriş yapmalısınız',
    });
  }

  const alert = await prisma.priceAlert.create({
    data: {
      userId,
      symbol: symbol.toUpperCase(),
      targetPrice: parseFloat(targetPrice),
      condition, // 'above' veya 'below'
      type,
      isActive: true,
    },
  });

  // Cache'i temizle
  await cache.deletePattern(`alerts:${userId}*`);

  res.status(201).json({
    success: true,
    message: 'Fiyat alarmı oluşturuldu',
    data: alert,
  });
}));

// Hisse senedi haberleri
router.get('/:symbol/news', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { limit = 10 } = req.query;
  const cacheKey = `stock:news:${symbol.toUpperCase()}:${limit}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const news = await prisma.news.findMany({
      where: {
        OR: [
          { relatedStocks: { has: symbol.toUpperCase() } },
          { title: { contains: symbol, mode: 'insensitive' } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: parseInt(limit),
    });
    return news;
  }, 300);

  res.json({
    success: true,
    data,
  });
}));

module.exports = router;
