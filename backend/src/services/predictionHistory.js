/**
 * FinansRadar — Tahmin Geçmişi & Karşılaştırma Servisi
 * =====================================================
 * - Her analizde tahminleri DB'ye kaydet
 * - Geçmiş tahminlerle gerçekleşen fiyatları karşılaştır
 * - Başarı metrikleri: MAPE, Hit Rate, RMSE
 */

import prisma from '../lib/prisma.js';
import { fetchCurrentPrice } from './yahooFinance.js';

/**
 * Yeni tahmin kaydı oluştur
 */
export async function savePrediction(ticker, currentPrice, predictions, signal, score) {
  try {
    await prisma.predictionHistory.create({
      data: {
        ticker,
        currentPrice,
        pred1w: predictions?.weekly?.target || null,
        pred1m: predictions?.monthly?.monthlyPoints?.[0]?.median || null,
        pred3m: predictions?.monthly?.target || null,
        pred1y: predictions?.yearly?.target || null,
        pred3y: predictions?.threeYear?.target || null,
        signal,
        score,
      },
    });
  } catch (e) {
    console.error('Tahmin kayıt hatası:', e.message);
  }
}

/**
 * Geçmiş tahminleri güncelle — Gerçekleşen fiyatları doldur
 * Bu fonksiyon her analizde çağrılır ve geçmişteki tahminlerin
 * actual fiyatlarını günceller
 */
export async function updateActuals(ticker) {
  try {
    const currentPrice = await fetchCurrentPrice(ticker);
    if (!currentPrice) return;

    const now = new Date();

    // 1 hafta önce yapılan tahminlerin actual1w'sini güncelle
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    await prisma.predictionHistory.updateMany({
      where: {
        ticker,
        actual1w: null,
        analysisDate: { gte: twoWeeksAgo, lte: oneWeekAgo },
      },
      data: { actual1w: currentPrice },
    });

    // 1 ay önce yapılan tahminlerin actual1m'sini güncelle
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    await prisma.predictionHistory.updateMany({
      where: {
        ticker,
        actual1m: null,
        analysisDate: { gte: twoMonthsAgo, lte: oneMonthAgo },
      },
      data: { actual1m: currentPrice },
    });

    // 3 ay önce yapılan tahminlerin actual3m'sini güncelle
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const fourMonthsAgo = new Date(now);
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    await prisma.predictionHistory.updateMany({
      where: {
        ticker,
        actual3m: null,
        analysisDate: { gte: fourMonthsAgo, lte: threeMonthsAgo },
      },
      data: { actual3m: currentPrice },
    });
  } catch (e) {
    console.error('Actual güncelleme hatası:', e.message);
  }
}

/**
 * Geçmiş tahmin karşılaştırma raporu
 */
export async function getPredictionHistory(ticker, limit = 20) {
  try {
    // Geçmişi güncelle
    await updateActuals(ticker);

    const predictions = await prisma.predictionHistory.findMany({
      where: { ticker },
      orderBy: { analysisDate: 'desc' },
      take: limit,
    });

    if (!predictions || predictions.length === 0) {
      return {
        ticker,
        history: [],
        metrics: { mape1w: null, hitRate1w: null, totalPredictions: 0 },
        message: 'Henüz tahmin geçmişi yok. İlk analiz ile kayıt başlayacak.',
      };
    }

    // Her kayıt için hata hesapla
    const history = predictions.map(p => {
      const errors = {};

      if (p.pred1w && p.actual1w) {
        errors.error1w = parseFloat(((Math.abs(p.actual1w - p.pred1w) / p.actual1w) * 100).toFixed(2));
        errors.direction1w = (p.pred1w > p.currentPrice) === (p.actual1w > p.currentPrice);
      }
      if (p.pred1m && p.actual1m) {
        errors.error1m = parseFloat(((Math.abs(p.actual1m - p.pred1m) / p.actual1m) * 100).toFixed(2));
        errors.direction1m = (p.pred1m > p.currentPrice) === (p.actual1m > p.currentPrice);
      }
      if (p.pred3m && p.actual3m) {
        errors.error3m = parseFloat(((Math.abs(p.actual3m - p.pred3m) / p.actual3m) * 100).toFixed(2));
        errors.direction3m = (p.pred3m > p.currentPrice) === (p.actual3m > p.currentPrice);
      }

      return {
        id: p.id,
        date: p.analysisDate,
        currentPrice: p.currentPrice,
        signal: p.signal,
        score: p.score,
        predictions: {
          '1w': p.pred1w,
          '1m': p.pred1m,
          '3m': p.pred3m,
          '1y': p.pred1y,
          '3y': p.pred3y,
        },
        actuals: {
          '1w': p.actual1w,
          '1m': p.actual1m,
          '3m': p.actual3m,
        },
        errors,
      };
    });

    // Toplam metrikler
    const withActual1w = history.filter(h => h.errors.error1w !== undefined);
    const withActual1m = history.filter(h => h.errors.error1m !== undefined);

    const mape1w = withActual1w.length > 0
      ? parseFloat((withActual1w.reduce((s, h) => s + h.errors.error1w, 0) / withActual1w.length).toFixed(2))
      : null;

    const hitRate1w = withActual1w.length > 0
      ? parseFloat(((withActual1w.filter(h => h.errors.direction1w).length / withActual1w.length) * 100).toFixed(1))
      : null;

    const mape1m = withActual1m.length > 0
      ? parseFloat((withActual1m.reduce((s, h) => s + h.errors.error1m, 0) / withActual1m.length).toFixed(2))
      : null;

    const hitRate1m = withActual1m.length > 0
      ? parseFloat(((withActual1m.filter(h => h.errors.direction1m).length / withActual1m.length) * 100).toFixed(1))
      : null;

    return {
      ticker,
      history: history.slice(0, 10), // Son 10 tahmin
      metrics: {
        mape1w,
        hitRate1w,
        mape1m,
        hitRate1m,
        totalPredictions: predictions.length,
        evaluatedPredictions: withActual1w.length,
      },
    };
  } catch (e) {
    console.error('Tahmin geçmişi hatası:', e.message);
    return {
      ticker,
      history: [],
      metrics: { mape1w: null, hitRate1w: null, totalPredictions: 0 },
      message: 'Tahmin geçmişi oluşturulurken hata: ' + e.message,
    };
  }
}
