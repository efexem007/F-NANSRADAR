/**
 * FinansRadar — Batch Data Processing Engine
 * ============================================
 * Görev 21-30: Veri Çekme Sistemi
 * - Batch işlem, Rate limit, Queue yönetimi
 * - Paralel ve sıralı çekme modları
 * - Progress tracking
 */

import { fetchStockPrices } from './yahooFinance.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS TRACKER
// ═══════════════════════════════════════════════════════════════════════════

class BatchProgressTracker {
  constructor(totalItems, jobId) {
    this.jobId = jobId || `batch_${Date.now()}`;
    this.total = totalItems;
    this.completed = 0;
    this.failed = 0;
    this.startTime = Date.now();
    this.results = [];
    this.errors = [];
    this.status = 'running'; // running, completed, failed, cancelled
    this._listeners = [];
  }

  onProgress(callback) {
    this._listeners.push(callback);
  }

  update(ticker, success, data = null) {
    if (success) {
      this.completed++;
      this.results.push({ ticker, success: true, data });
    } else {
      this.failed++;
      this.errors.push({ ticker, error: data });
    }

    const progress = this.getProgress();
    this._listeners.forEach(cb => cb(progress));

    // WebSocket broadcast (global.io varsa)
    if (global.io) {
      global.io.emit('batch:progress', progress);
    }
  }

  getProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const processed = this.completed + this.failed;
    const rate = elapsed > 0 ? processed / elapsed : 0;
    const eta = rate > 0 ? (this.total - processed) / rate : 0;

    return {
      jobId: this.jobId,
      status: this.status,
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      processed,
      percent: this.total > 0 ? Math.round((processed / this.total) * 100) : 0,
      elapsed: Math.round(elapsed),
      eta: Math.round(eta),
      rate: parseFloat(rate.toFixed(2)),
    };
  }

  finish() {
    this.status = 'completed';
    return {
      ...this.getProgress(),
      results: this.results,
      errors: this.errors,
    };
  }
}

// Aktif batch job'ları sakla
const activeJobs = new Map();

export function getJobProgress(jobId) {
  const tracker = activeJobs.get(jobId);
  if (!tracker) return null;
  return tracker.getProgress();
}

export function getActiveJobs() {
  const jobs = [];
  for (const [id, tracker] of activeJobs) {
    jobs.push(tracker.getProgress());
  }
  return jobs;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH PRICE DATA FETCHER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Toplu fiyat verisi çekme ve PricePoint tablosuna kaydetme
 * @param {Object} options - Batch işlem ayarları
 */
export async function batchFetchPriceHistory(options = {}) {
  const {
    type = 'bist',
    period = '3mo',
    concurrency = 3,   // Paralel istek sayısı
    delayMs = 1500,     // Batch'ler arası bekleme
    saveToDB = true,    // PricePoint'lere kaydet
    tickerFilter,       // Belirli ticker'lar (opsiyonel)
  } = options;

  // Hangi hisseleri çekeceğiz?
  let stocks;
  if (tickerFilter && tickerFilter.length > 0) {
    stocks = tickerFilter.map(t => ({ ticker: t }));
  } else {
    stocks = await prisma.stock.findMany({
      where: { isActive: true, type },
      select: { ticker: true },
      orderBy: { lastUpdate: 'asc' },
    });
  }

  const tracker = new BatchProgressTracker(stocks.length);
  activeJobs.set(tracker.jobId, tracker);

  logger.info(`[BatchFetch] Başlatıldı: ${stocks.length} hisse, period=${period}, concurrency=${concurrency}`);

  // Concurrency havuzu
  const processItem = async (stock) => {
    try {
      const { priceData, currentPrice } = await fetchStockPrices(stock.ticker, period);

      if (!priceData || priceData.length === 0) {
        tracker.update(stock.ticker, false, 'Veri yok');
        return;
      }

      // DB'ye fiyat güncelle
      await prisma.stock.update({
        where: { ticker: stock.ticker },
        data: { lastPrice: currentPrice, lastUpdate: new Date() },
      }).catch(() => {});

      // PricePoint'lere kaydet (opsiyonel)
      if (saveToDB && priceData.length > 0) {
        const upsertOps = priceData.slice(-60).map(p => 
          prisma.pricePoint.upsert({
            where: { stockTicker_date: { stockTicker: stock.ticker, date: new Date(p.date) } },
            update: { open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume || 0 },
            create: { stockTicker: stock.ticker, date: new Date(p.date), open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume || 0 },
          })
        );

        // Batch upsert (10'ar 10'ar)
        for (let i = 0; i < upsertOps.length; i += 10) {
          await prisma.$transaction(upsertOps.slice(i, i + 10)).catch(e => {
            logger.warn(`[BatchFetch] PricePoint kayıt hatası ${stock.ticker}: ${e.message}`);
          });
        }
      }

      tracker.update(stock.ticker, true, { points: priceData.length, currentPrice });
    } catch (e) {
      tracker.update(stock.ticker, false, e.message);
    }
  };

  // Concurrency ile batch işle
  for (let i = 0; i < stocks.length; i += concurrency) {
    const batch = stocks.slice(i, i + concurrency);
    await Promise.all(batch.map(processItem));

    // Rate limit bekleme
    if (i + concurrency < stocks.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  const finalResult = tracker.finish();
  
  // 10 dakika sonra temizle
  setTimeout(() => activeJobs.delete(tracker.jobId), 10 * 60 * 1000);

  logger.info(`[BatchFetch] Tamamlandı: ${tracker.completed}/${tracker.total} başarılı, ${tracker.failed} hatalı`);

  return finalResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH TECHNICAL INDICATOR CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Toplu teknik indikatör hesaplama ve TechnicalIndicator tablosuna kaydetme
 */
export async function batchCalculateIndicators(options = {}) {
  const { type = 'bist', concurrency = 5, delayMs = 500 } = options;
  const { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } = await import('./technical.js');

  const stocks = await prisma.stock.findMany({
    where: { isActive: true, type },
    select: { ticker: true },
  });

  const tracker = new BatchProgressTracker(stocks.length);
  activeJobs.set(tracker.jobId, tracker);

  const processItem = async (stock) => {
    try {
      const { priceData } = await fetchStockPrices(stock.ticker, '3mo');
      if (!priceData || priceData.length < 26) {
        tracker.update(stock.ticker, false, 'Yetersiz veri');
        return;
      }

      const rsi = calculateRSI(priceData);
      const macd = calculateMACD(priceData);
      const sma20 = calculateSMA(priceData, 20);
      const sma50 = calculateSMA(priceData, 50);
      const bollinger = calculateBollinger(priceData);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.technicalIndicator.upsert({
        where: { ticker_date: { ticker: stock.ticker, date: today } },
        update: {
          rsi14: rsi,
          macd: macd?.macd || null,
          macdSignal: macd?.signal || null,
          macdHist: macd?.hist || null,
          sma20,
          sma50,
          bollingerUpper: bollinger?.upper || null,
          bollingerLower: bollinger?.lower || null,
        },
        create: {
          ticker: stock.ticker,
          date: today,
          rsi14: rsi,
          macd: macd?.macd || null,
          macdSignal: macd?.signal || null,
          macdHist: macd?.hist || null,
          sma20,
          sma50,
          bollingerUpper: bollinger?.upper || null,
          bollingerLower: bollinger?.lower || null,
        },
      });

      tracker.update(stock.ticker, true);
    } catch (e) {
      tracker.update(stock.ticker, false, e.message);
    }
  };

  for (let i = 0; i < stocks.length; i += concurrency) {
    const batch = stocks.slice(i, i + concurrency);
    await Promise.all(batch.map(processItem));
    if (i + concurrency < stocks.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  const result = tracker.finish();
  setTimeout(() => activeJobs.delete(tracker.jobId), 10 * 60 * 1000);
  return result;
}
