// v6.0-F-NANSRADAR Gelistirme

import prisma from '../lib/prisma.js';

export async function analyzeSignalAccuracy(symbol, options = {}) {
  const { lookbackDays = 365 } = options;

  // Sinyal geçmişini getir (örnek sorgu)
  const signals = await prisma.signalHistory.findMany({
    where: {
      symbol,
      date: { gte: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000) }
    },
    orderBy: { date: 'asc' }
  });

  if (signals.length === 0) {
    return { error: 'Sinyal bulunamadı' };
  }

  // Fiyat verilerini getir (örnek)
  const priceData = await fetchPriceData(symbol); // Bu fonksiyon mevcut değil, placeholder

  // Her sinyal için doğruluk hesapla
  const results = [];
  for (const signal of signals) {
    const entryIdx = priceData.findIndex(p => p.date >= signal.date);
    if (entryIdx === -1) continue;

    // 1, 5, 21 gün sonrası fiyat
    const price1 = entryIdx + 1 < priceData.length ? priceData[entryIdx + 1].close : null;
    const price5 = entryIdx + 5 < priceData.length ? priceData[entryIdx + 5].close : null;
    const price21 = entryIdx + 21 < priceData.length ? priceData[entryIdx + 21].close : null;

    const accuracy1 = price1 ? (signal.signal === 'AL' || signal.signal === 'GÜÇLÜ AL' ? (price1 > signal.price ? 1 : 0) : (price1 < signal.price ? 1 : 0)) : null;
    const accuracy5 = price5 ? (signal.signal.includes('AL') ? (price5 > signal.price ? 1 : 0) : (price5 < signal.price ? 1 : 0)) : null;
    const accuracy21 = price21 ? (signal.signal.includes('AL') ? (price21 > signal.price ? 1 : 0) : (price21 < signal.price ? 1 : 0)) : null;

    results.push({
      date: signal.date,
      signal: signal.signal,
      score: signal.score,
      accuracy1,
      accuracy5,
      accuracy21
    });
  }

  // Genel istatistikler
  const strongBuy = results.filter(r => r.signal === 'GÜÇLÜ AL');
  const buy = results.filter(r => r.signal === 'AL');
  const sell = results.filter(r => r.signal === 'SAT');

  const calculateAvg = (arr, field) => {
    const vals = arr.map(r => r[field]).filter(v => v !== null);
    return vals.length > 0 ? vals.reduce((a,b)=>a+b,0)/vals.length * 100 : null;
  };

  return {
    symbol,
    totalSignals: results.length,
    bySignalType: {
      strongBuy: {
        count: strongBuy.length,
        accuracy1g: calculateAvg(strongBuy, 'accuracy1'),
        accuracy5g: calculateAvg(strongBuy, 'accuracy5'),
        accuracy21g: calculateAvg(strongBuy, 'accuracy21')
      },
      buy: {
        count: buy.length,
        accuracy1g: calculateAvg(buy, 'accuracy1'),
        accuracy5g: calculateAvg(buy, 'accuracy5'),
        accuracy21g: calculateAvg(buy, 'accuracy21')
      },
      sell: {
        count: sell.length,
        accuracy1g: calculateAvg(sell, 'accuracy1'),
        accuracy5g: calculateAvg(sell, 'accuracy5'),
        accuracy21g: calculateAvg(sell, 'accuracy21')
      }
    },
    byScoreThreshold: {
      over70: {
        count: results.filter(r => r.score > 70).length,
        accuracy1g: calculateAvg(results.filter(r => r.score > 70), 'accuracy1'),
        accuracy5g: calculateAvg(results.filter(r => r.score > 70), 'accuracy5'),
        accuracy21g: calculateAvg(results.filter(r => r.score > 70), 'accuracy21')
      },
      over50: {
        count: results.filter(r => r.score > 50).length,
        accuracy1g: calculateAvg(results.filter(r => r.score > 50), 'accuracy1'),
        accuracy5g: calculateAvg(results.filter(r => r.score > 50), 'accuracy5'),
        accuracy21g: calculateAvg(results.filter(r => r.score > 50), 'accuracy21')
      }
    },
    details: results.slice(-20)
  };
}

// Placeholder price fetch
async function fetchPriceData(symbol) {
  // Gerçek uygulamada yahooFinance vs kullanılır
  return [];
}
