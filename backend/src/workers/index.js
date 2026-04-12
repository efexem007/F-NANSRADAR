import { queues } from '../lib/queue.js';
import logger from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import yahooFinance from 'yahoo-finance2';
import technicalAnalysis from '../services/technicalAnalysis.js';
import aiLearning from '../services/aiLearningService.js';

/**
 * Worker İşlemcileri
 * Queue job'larını işler
 */

// Hisse senedi tarama işlemcisi
queues.stockScanner.process('scan-stocks', 3, async (job) => {
  const { symbols, filters, userId } = job.data;
  logger.info(`Tarama başlatıldı: ${symbols.length} hisse`);

  const results = [];
  const errors = [];

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    
    try {
      // İlerleme güncelle
      await job.progress(Math.round((i / symbols.length) * 100));

      // Yahoo Finance'den veri çek
      const quote = await yahooFinance.quote(symbol);
      
      // Filtreleme
      let passesFilters = true;
      
      if (filters.minPrice && quote.regularMarketPrice < filters.minPrice) {
        passesFilters = false;
      }
      if (filters.maxPrice && quote.regularMarketPrice > filters.maxPrice) {
        passesFilters = false;
      }
      if (filters.minVolume && quote.regularMarketVolume < filters.minVolume) {
        passesFilters = false;
      }
      if (filters.minChange && quote.regularMarketChangePercent < filters.minChange) {
        passesFilters = false;
      }

      if (passesFilters) {
        results.push({
          symbol,
          name: quote.shortName,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChangePercent,
          volume: quote.regularMarketVolume,
          marketCap: quote.marketCap,
        });
      }

      // Rate limit koruması
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      logger.error(`Tarama hatası ${symbol}:`, error.message);
      errors.push({ symbol, error: error.message });
    }
  }

  await job.progress(100);

  return {
    scanned: symbols.length,
    matched: results.length,
    results,
    errors,
  };
});

// Tek hisse analizi işlemcisi
queues.stockScanner.process('analyze-stock', 2, async (job) => {
  const { symbol, analysisType, userId } = job.data;
  logger.info(`Analiz başlatıldı: ${symbol}`);

  try {
    // Geçmiş verileri çek
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);

    const historical = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    if (historical.length < 30) {
      throw new Error('Yetersiz veri');
    }

    // Teknik analiz
    const indicators = technicalAnalysis.calculateAllIndicators(historical);
    const trend = technicalAnalysis.analyzeTrend(historical);
    const signals = technicalAnalysis.generateSignals(indicators);

    // Veritabanına kaydet
    await prisma.stockAnalysis.upsert({
      where: { symbol },
      update: {
        indicators,
        trend,
        signals,
        lastAnalyzed: new Date(),
      },
      create: {
        symbol,
        indicators,
        trend,
        signals,
        lastAnalyzed: new Date(),
      },
    });

    await job.progress(100);

    return {
      symbol,
      indicators,
      trend,
      signals,
      dataPoints: historical.length,
    };

  } catch (error) {
    logger.error(`Analiz hatası ${symbol}:`, error.message);
    throw error;
  }
});

// Portföy senkronizasyon işlemcisi
queues.portfolioSync.process('sync-portfolio', 2, async (job) => {
  const { portfolioId, userId } = job.data;
  logger.info(`Portföy senkronizasyonu: ${portfolioId}`);

  try {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { holdings: { include: { stock: true } } },
    });

    if (!portfolio) {
      throw new Error('Portföy bulunamadı');
    }

    const updatedHoldings = [];

    for (let i = 0; i < portfolio.holdings.length; i++) {
      const holding = portfolio.holdings[i];
      
      await job.progress(Math.round((i / portfolio.holdings.length) * 100));

      try {
        const quote = await yahooFinance.quote(holding.stock.symbol);
        
        updatedHoldings.push({
          symbol: holding.stock.symbol,
          currentPrice: quote.regularMarketPrice,
          change: quote.regularMarketChangePercent,
          currentValue: holding.quantity * quote.regularMarketPrice,
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`Senkronizasyon hatası ${holding.stock.symbol}:`, error.message);
      }
    }

    await job.progress(100);

    return {
      portfolioId,
      holdingsUpdated: updatedHoldings.length,
      holdings: updatedHoldings,
    };

  } catch (error) {
    logger.error(`Portföy senkronizasyon hatası:`, error.message);
    throw error;
  }
});

// Portföy tarama işlemcisi
queues.portfolioSync.process('scan-portfolio', 2, async (job) => {
  const { portfolioId, scanType } = job.data;
  logger.info(`Portföy taraması: ${portfolioId} - ${scanType}`);

  // Tarama mantığı burada implemente edilecek
  return { portfolioId, scanType, status: 'completed' };
});

// Bildirim işlemcisi
queues.notifications.process('send-notification', 5, async (job) => {
  const { type, userId, data } = job.data;
  logger.info(`Bildirim gönderiliyor: ${type} - ${userId}`);

  // Bildirim mantığı (email, push, vb.)
  return { type, userId, sent: true };
});

// Rapor oluşturma işlemcisi
queues.reports.process('generate-report', 2, async (job) => {
  const { userId, reportType, dateRange } = job.data;
  logger.info(`Rapor oluşturuluyor: ${reportType} - ${userId}`);

  // Rapor oluşturma mantığı
  await job.progress(50);
  
  // Simülasyon
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await job.progress(100);

  return {
    reportType,
    generatedAt: new Date().toISOString(),
    downloadUrl: `/reports/${userId}/${Date.now()}.pdf`,
  };
});

// Veri temizleme işlemcisi
queues.cleanup.process('cleanup-old-data', 1, async (job) => {
  logger.info('Veri temizleme başlatıldı');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Eski tahminleri temizle
  const deletedPredictions = await prisma.prediction.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
      accuracy: null, // Değerlendirilmemişler
    },
  });

  // Eski job kayıtlarını temizle (opsiyonel)
  logger.info(`Temizlendi: ${deletedPredictions.count} tahmin`);

  return {
    deletedPredictions: deletedPredictions.count,
    cleanedAt: new Date().toISOString(),
  };
});

// AI öğrenme işlemcisi
queues.cleanup.process('ai-learning-cycle', 1, async (job) => {
  logger.info('AI öğrenme döngüsü başlatıldı');

  // Değerlendirilmemiş tahminleri bul ve değerlendir
  const unevaluatedPredictions = await prisma.prediction.findMany({
    where: {
      targetDate: { lte: new Date() },
      actualPrice: null,
    },
    take: 100,
  });

  for (const pred of unevaluatedPredictions) {
    try {
      // Gerçek fiyatı al
      const latestPrice = await prisma.stockPrice.findFirst({
        where: { stock: { symbol: pred.symbol } },
        orderBy: { date: 'desc' },
      });

      if (latestPrice) {
        await aiLearning.evaluatePredictions(pred.symbol, latestPrice.close);
      }
    } catch (error) {
      logger.error(`AI değerlendirme hatası ${pred.symbol}:`, error.message);
    }
  }

  return {
    evaluated: unevaluatedPredictions.length,
    processedAt: new Date().toISOString(),
  };
});

// Worker başlatma
logger.info('🚀 Worker\'lar başlatıldı');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Worker kapatılıyor...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Worker kapatılıyor...');
  await prisma.$disconnect();
  process.exit(0);
});
