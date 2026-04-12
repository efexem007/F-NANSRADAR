const express = require('express');
const router = express.Router();
const { asyncHandler, AuthorizationError } = require('../middleware/errorHandler');
const { portfolioRateLimit } = require('../middleware/smartRateLimit');
const cache = require('../lib/cache');
const { prisma, withTransaction } = require('../lib/prisma');
const logger = require('../lib/logger');
const { addJob } = require('../lib/queue');

// Rate limiting
router.use(portfolioRateLimit);

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({
      success: false,
      error: 'Giriş yapmalısınız',
    });
  }
  next();
};

// Kullanıcının tüm portföylerini getir
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `portfolios:user:${userId}`;

  const portfolios = await cache.getOrSet(cacheKey, async () => {
    return prisma.portfolio.findMany({
      where: { userId },
      include: {
        _count: {
          select: { holdings: true },
        },
      },
    });
  }, 60);

  res.json({
    success: true,
    data: portfolios,
  });
}));

// Yeni portföy oluştur
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { name, description, currency = 'TRY' } = req.body;
  const userId = req.user.id;

  const portfolio = await prisma.portfolio.create({
    data: {
      name,
      description,
      currency,
      userId,
    },
  });

  // Cache'i temizle
  await cache.delete(`portfolios:user:${userId}`);

  res.status(201).json({
    success: true,
    message: 'Portföy oluşturuldu',
    data: portfolio,
  });
}));

// Portföy detayları
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const cacheKey = `portfolio:${id}:user:${userId}`;

  const portfolio = await cache.getOrSet(cacheKey, async () => {
    return prisma.portfolio.findFirst({
      where: { id, userId },
      include: {
        holdings: {
          include: {
            stock: {
              select: {
                symbol: true,
                name: true,
                prices: {
                  orderBy: { date: 'desc' },
                  take: 1,
                  select: { close: true, change: true },
                },
              },
            },
          },
        },
        transactions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });
  }, 30);

  if (!portfolio) {
    return res.status(404).json({
      success: false,
      error: 'Portföy bulunamadı',
    });
  }

  // Portföy değerlerini hesapla
  let totalValue = 0;
  let totalCost = 0;

  const holdingsWithValue = portfolio.holdings.map(holding => {
    const currentPrice = holding.stock.prices[0]?.close || 0;
    const currentValue = holding.quantity * currentPrice;
    const costBasis = holding.quantity * holding.avgPrice;
    const profit = currentValue - costBasis;
    const profitPercent = (profit / costBasis) * 100;

    totalValue += currentValue;
    totalCost += costBasis;

    return {
      ...holding,
      currentPrice,
      currentValue,
      profit,
      profitPercent: parseFloat(profitPercent.toFixed(2)),
    };
  });

  const totalProfit = totalValue - totalCost;
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  res.json({
    success: true,
    data: {
      ...portfolio,
      holdings: holdingsWithValue,
      summary: {
        totalValue: parseFloat(totalValue.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        totalProfitPercent: parseFloat(totalProfitPercent.toFixed(2)),
      },
    },
  });
}));

// Portföye hisse ekle
router.post('/:id/holdings', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { symbol, quantity, price, date = new Date() } = req.body;
  const userId = req.user.id;

  // Portföy kontrolü
  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId },
  });

  if (!portfolio) {
    return res.status(404).json({
      success: false,
      error: 'Portföy bulunamadı',
    });
  }

  // Hisse senedi kontrolü
  const stock = await prisma.stock.findUnique({
    where: { symbol: symbol.toUpperCase() },
  });

  if (!stock) {
    return res.status(404).json({
      success: false,
      error: 'Hisse senedi bulunamadı',
    });
  }

  const result = await withTransaction(async (tx) => {
    // Mevcut holding'i kontrol et
    const existingHolding = await tx.holding.findFirst({
      where: {
        portfolioId: id,
        stockId: stock.id,
      },
    });

    let holding;
    const totalCost = quantity * price;

    if (existingHolding) {
      // Güncelle
      const newQuantity = existingHolding.quantity + quantity;
      const newAvgPrice = ((existingHolding.quantity * existingHolding.avgPrice) + totalCost) / newQuantity;

      holding = await tx.holding.update({
        where: { id: existingHolding.id },
        data: {
          quantity: newQuantity,
          avgPrice: newAvgPrice,
        },
      });
    } else {
      // Yeni holding oluştur
      holding = await tx.holding.create({
        data: {
          portfolioId: id,
          stockId: stock.id,
          quantity,
          avgPrice: price,
        },
      });
    }

    // İşlem kaydı
    await tx.transaction.create({
      data: {
        portfolioId: id,
        stockId: stock.id,
        type: 'BUY',
        quantity,
        price,
        total: totalCost,
        date,
      },
    });

    return holding;
  });

  // Cache'i temizle
  await cache.deletePattern(`portfolio:${id}*`);

  res.status(201).json({
    success: true,
    message: 'Hisse senedi eklendi',
    data: result,
  });
}));

// Hisse sat
router.post('/:id/holdings/:holdingId/sell', requireAuth, asyncHandler(async (req, res) => {
  const { id, holdingId } = req.params;
  const { quantity, price, date = new Date() } = req.body;
  const userId = req.user.id;

  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId },
    include: {
      holdings: {
        where: { id: holdingId },
      },
    },
  });

  if (!portfolio || portfolio.holdings.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Holding bulunamadı',
    });
  }

  const holding = portfolio.holdings[0];

  if (holding.quantity < quantity) {
    return res.status(400).json({
      success: false,
      error: 'Yetersiz hisse miktarı',
    });
  }

  const result = await withTransaction(async (tx) => {
    const totalValue = quantity * price;
    const newQuantity = holding.quantity - quantity;

    if (newQuantity === 0) {
      // Tümünü sat - holding'i sil
      await tx.holding.delete({
        where: { id: holdingId },
      });
    } else {
      // Kısmi satış - miktarı güncelle
      await tx.holding.update({
        where: { id: holdingId },
        data: { quantity: newQuantity },
      });
    }

    // İşlem kaydı
    await tx.transaction.create({
      data: {
        portfolioId: id,
        stockId: holding.stockId,
        type: 'SELL',
        quantity,
        price,
        total: totalValue,
        date,
      },
    });

    return { sold: quantity, remaining: newQuantity };
  });

  // Cache'i temizle
  await cache.deletePattern(`portfolio:${id}*`);

  res.json({
    success: true,
    message: 'Hisse senedi satıldı',
    data: result,
  });
}));

// Portföy sil
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId },
  });

  if (!portfolio) {
    return res.status(404).json({
      success: false,
      error: 'Portföy bulunamadı',
    });
  }

  await prisma.portfolio.delete({
    where: { id },
  });

  // Cache'i temizle
  await cache.deletePattern(`portfolio:${id}*`);
  await cache.delete(`portfolios:user:${userId}`);

  res.json({
    success: true,
    message: 'Portföy silindi',
  });
}));

// Portföy performans geçmişi
router.get('/:id/performance', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { period = '1M' } = req.query;
  const userId = req.user.id;
  const cacheKey = `portfolio:${id}:performance:${period}:user:${userId}`;

  const performance = await cache.getOrSet(cacheKey, async () => {
    const portfolio = await prisma.portfolio.findFirst({
      where: { id, userId },
      include: {
        holdings: {
          include: {
            stock: {
              include: {
                prices: {
                  orderBy: { date: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!portfolio) return null;

    // Periyoda göre tarih hesaplama
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '1W': startDate.setDate(now.getDate() - 7); break;
      case '1M': startDate.setMonth(now.getMonth() - 1); break;
      case '3M': startDate.setMonth(now.getMonth() - 3); break;
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      default: startDate.setMonth(now.getMonth() - 1);
    }

    // Günlük portföy değeri hesaplama
    const dailyValues = {};

    portfolio.holdings.forEach(holding => {
      holding.stock.prices.forEach(price => {
        if (new Date(price.date) >= startDate) {
          const dateKey = price.date.toISOString().split('T')[0];
          if (!dailyValues[dateKey]) {
            dailyValues[dateKey] = 0;
          }
          dailyValues[dateKey] += holding.quantity * price.close;
        }
      });
    });

    return Object.entries(dailyValues)
      .map(([date, value]) => ({ date, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, 300);

  if (!performance) {
    return res.status(404).json({
      success: false,
      error: 'Portföy bulunamadı',
    });
  }

  res.json({
    success: true,
    data: performance,
  });
}));

// Portföy senkronizasyonu başlat
router.post('/:id/sync', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId },
  });

  if (!portfolio) {
    return res.status(404).json({
      success: false,
      error: 'Portföy bulunamadı',
    });
  }

  const job = await addJob('portfolioSync', 'sync-portfolio', {
    portfolioId: id,
    userId,
  });

  res.status(202).json({
    success: true,
    message: 'Senkronizasyon başlatıldı',
    data: {
      jobId: job.id,
      status: 'pending',
    },
  });
}));

module.exports = router;
