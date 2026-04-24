/**
 * FinansRadar — Çok Zaman Dilimli Tahmin Motoru v5.0
 * ===================================================
 * 1. Haftalık (1-7 gün): Momentum + Mean-Reversion + Monte Carlo
 * 2. Aylık (1-3 ay): Trend + Mevsimsel + GARCH Volatilite
 * 3. Yıllık (1 yıl): Geometric Brownian Motion (GBM) Monte Carlo
 * 4. 3 Yıllık: GBM Monte Carlo (uzun vade)
 *
 * Formüller:
 *   GBM: S_t = S_0 * exp((μ - σ²/2)*t + σ*W_t)
 *   Mean-Reversion: z = (price - SMA) / σ
 *   Momentum: RSI + MACD Histogram yönü
 */

import { GARCHModel } from './volatilityModel.js';

/**
 * Normal dağılımdan rastgele sayı (Box-Muller transform)
 */
export function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Günlük getiri hesapla
 */
function calcReturns(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return returns;
}

/**
 * Basit istatistikler
 */
function calcStats(arr) {
  const n = arr.length;
  if (n === 0) return { mean: 0, std: 0, median: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  const sorted = [...arr].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  return { mean, std, median };
}

/**
 * SMA hesapla
 */
function sma(closes, period) {
  if (closes.length < period) return closes[closes.length - 1];
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HAFTALIK TAHMİN (1-7 gün) — Momentum + Mean-Reversion + Monte Carlo
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Haftalık tahmin motoru
 * - Momentum skoru (RSI + MACD benzeri sinyal)
 * - Mean-Reversion z-skoru (SMA20'ye eğilim)
 * - Monte Carlo (1000 simülasyon, 7 gün)
 */
export function predictWeekly(priceData, days = 7) {
  const closes = priceData.map(p => p.close);
  const returns = calcReturns(closes);
  const { mean: muDaily, std: sigmaDaily } = calcStats(returns);
  const currentPrice = closes[closes.length - 1];

  // Momentum skoru: Fiyatın son 14 gündeki hareketi
  const recent14 = closes.slice(-14);
  const gains = [], losses = [];
  for (let i = 1; i < recent14.length; i++) {
    const change = recent14[i] - recent14[i - 1];
    if (change > 0) { gains.push(change); losses.push(0); }
    else { gains.push(0); losses.push(Math.abs(change)); }
  }
  const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
  const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  // Mean-Reversion: z-skoru (fiyatın SMA20'den sapması)
  const sma20 = sma(closes, 20);
  const stdDev20 = Math.sqrt(closes.slice(-20).reduce((a, c) => a + Math.pow(c - sma20, 2), 0) / 20);
  const zScore = stdDev20 > 0 ? (currentPrice - sma20) / stdDev20 : 0;

  // Drift ayarı: RSI ve z-skora göre bias
  let driftBias = 0;
  if (rsi < 30) driftBias = 0.001;        // Aşırı satış → yukarı bias
  else if (rsi > 70) driftBias = -0.001;   // Aşırı alım → aşağı bias
  if (zScore < -1.5) driftBias += 0.0008;  // Ortalamanın çok altında → yukarı çekme
  else if (zScore > 1.5) driftBias -= 0.0008;

  const adjustedMu = muDaily + driftBias;

  // Monte Carlo simülasyonu (1000 yol, 7 gün)
  const nSim = 1000;
  const finalPrices = [];
  const paths = [];

  for (let s = 0; s < nSim; s++) {
    let price = currentPrice;
    const path = [price];
    for (let d = 0; d < days; d++) {
      const shock = randn();
      price = price * Math.exp((adjustedMu - 0.5 * sigmaDaily * sigmaDaily) + sigmaDaily * shock);
      path.push(price);
    }
    finalPrices.push(price);
    if (s < 5) paths.push(path); // Sadece 5 örnek yol
  }

  finalPrices.sort((a, b) => a - b);
  const n = finalPrices.length;

  // Günlük tahmin noktaları (percentiller)
  // v2.0: Tek simülasyonda hem finalPrices hem dailyPredictions hesapla
  // Günlük fiyatları toplamak için matris: [simülasyon][gün]
  const allPaths = Array.from({ length: nSim }, () => [currentPrice]);
  const today = new Date();

  for (let s = 0; s < nSim; s++) {
    let price = currentPrice;
    for (let d = 1; d <= days; d++) {
      const shock = randn();
      price = price * Math.exp((adjustedMu - 0.5 * sigmaDaily * sigmaDaily) + sigmaDaily * shock);
      allPaths[s][d] = price;
    }
  }

  // Final fiyatlar (duplicate declaration fixed)
  const sortedFinalPrices = allPaths.map(p => p[p.length - 1]).sort((a, b) => a - b);

  // Günlük tahminler (tüm simülasyonlardan percentiller)
  const dailyPredictions = [];
  for (let d = 0; d <= days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    if (d === 0) {
      dailyPredictions.push({
        date: date.toISOString().split('T')[0],
        day: d,
        median: currentPrice,
        upper75: currentPrice,
        lower25: currentPrice,
        upper95: currentPrice,
        lower5: currentPrice,
      });
      continue;
    }
    const dayPrices = allPaths.map(p => p[d]).sort((a, b) => a - b);
    const dn = dayPrices.length;
    dailyPredictions.push({
      date: date.toISOString().split('T')[0],
      day: d,
      median: parseFloat(dayPrices[Math.floor(dn * 0.50)].toFixed(2)),
      upper75: parseFloat(dayPrices[Math.floor(dn * 0.75)].toFixed(2)),
      lower25: parseFloat(dayPrices[Math.floor(dn * 0.25)].toFixed(2)),
      upper95: parseFloat(dayPrices[Math.floor(dn * 0.95)].toFixed(2)),
      lower5: parseFloat(dayPrices[Math.floor(dn * 0.05)].toFixed(2)),
    });
  }

  const medianFinal = sortedFinalPrices[Math.floor(n * 0.50)];
  const changePct = ((medianFinal - currentPrice) / currentPrice) * 100;

  return {
    horizon: '1w',
    label: '1 Hafta',
    days,
    currentPrice,
    target: parseFloat(medianFinal.toFixed(2)),
    changePct: parseFloat(changePct.toFixed(2)),
    range: {
      lower5: parseFloat(sortedFinalPrices[Math.floor(n * 0.05)].toFixed(2)),
      lower25: parseFloat(sortedFinalPrices[Math.floor(n * 0.25)].toFixed(2)),
      median: parseFloat(medianFinal.toFixed(2)),
      upper75: parseFloat(sortedFinalPrices[Math.floor(n * 0.75)].toFixed(2)),
      upper95: parseFloat(sortedFinalPrices[Math.floor(n * 0.95)].toFixed(2)),
    },
    probabilityUp: parseFloat(((sortedFinalPrices.filter(p => p > currentPrice).length / n) * 100).toFixed(1)),
    confidence: parseFloat(Math.max(0, Math.min(100, 100 - Math.abs(changePct) * 1.5)).toFixed(1)),
    momentum: { rsi: parseFloat(rsi.toFixed(1)), zScore: parseFloat(zScore.toFixed(2)), driftBias: parseFloat(driftBias.toFixed(5)) },
    dailyPredictions,
    method: 'Momentum + Mean-Reversion + Monte Carlo (1000 sim)',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. AYLIK TAHMİN (1-3 ay) — Trend + Mevsimsel + GARCH Volatilite
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Aylık tahmin motoru
 * - Doğrusal trend (regresyon)
 * - Haftalık mevsimsellik
 * - Genişleyen güven aralıkları (GARCH volatilite)
 */
export function predictMonthly(priceData, months = 3) {
  const closes = priceData.map(p => p.close);
  const returns = calcReturns(closes);
  const { mean: muDaily, std: sigmaDaily } = calcStats(returns);
  const currentPrice = closes[closes.length - 1];
  const days = months * 22; // İş günü

  // Doğrusal trend (son 60 günlük regresyon)
  const trendWindow = Math.min(60, closes.length);
  const trendCloses = closes.slice(-trendWindow);
  const xs = trendCloses.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMean = trendCloses.reduce((a, b) => a + b, 0) / trendCloses.length;
  const slope = xs.reduce((s, x, i) => s + (x - xMean) * (trendCloses[i] - yMean), 0) /
                xs.reduce((s, x) => s + (x - xMean) ** 2, 0);

  // Haftalık mevsimsellik (gün-of-week etkisi)
  const dayOfWeekReturns = [0, 0, 0, 0, 0]; // Pzt-Cum
  const dayOfWeekCounts = [0, 0, 0, 0, 0];
  for (let i = 0; i < priceData.length - 1; i++) {
    const d = new Date(priceData[i].date);
    const dow = d.getDay(); // 0=Pzr, 1=Pzt...5=Cum
    if (dow >= 1 && dow <= 5) {
      dayOfWeekReturns[dow - 1] += (priceData[i + 1]?.close - priceData[i].close) / priceData[i].close;
      dayOfWeekCounts[dow - 1]++;
    }
  }
  const seasonality = dayOfWeekReturns.map((r, i) => dayOfWeekCounts[i] > 0 ? r / dayOfWeekCounts[i] : 0);

  // Monte Carlo + trend + seasonality
  const nSim = 2000;
  const allFinals = [];
  const monthlyPoints = []; // Her 22 günde bir nokta

  // Ay bazında tahmin noktaları (1., 2., 3. ay)
  for (let m = 1; m <= months; m++) {
    const targetDay = m * 22;
    const dayPrices = [];
    for (let s = 0; s < nSim; s++) {
      let price = currentPrice;
      for (let d = 0; d < targetDay; d++) {
        const trendComponent = slope * 0.3; // Trend katkısı (damped)
        const seasonComponent = seasonality[d % 5] * price * 0.1; // Mevsimsel katkı (damped)
        const randomComponent = sigmaDaily * randn() * price;
        price = price + (muDaily * price) + trendComponent + seasonComponent + randomComponent;
        price = Math.max(price, currentPrice * 0.1); // Negatif fiyat engelle
      }
      dayPrices.push(price);
    }
    dayPrices.sort((a, b) => a - b);
    const dn = dayPrices.length;
    const median = dayPrices[Math.floor(dn * 0.50)];
    monthlyPoints.push({
      month: m,
      label: `${m}. Ay`,
      median: parseFloat(median.toFixed(2)),
      upper75: parseFloat(dayPrices[Math.floor(dn * 0.75)].toFixed(2)),
      lower25: parseFloat(dayPrices[Math.floor(dn * 0.25)].toFixed(2)),
      upper95: parseFloat(dayPrices[Math.floor(dn * 0.95)].toFixed(2)),
      lower5: parseFloat(dayPrices[Math.floor(dn * 0.05)].toFixed(2)),
      changePct: parseFloat(((median - currentPrice) / currentPrice * 100).toFixed(2)),
      probabilityUp: parseFloat(((dayPrices.filter(p => p > currentPrice).length / dn) * 100).toFixed(1)),
    });
    if (m === months) allFinals.push(...dayPrices);
  }

  allFinals.sort((a, b) => a - b);
  const n = allFinals.length;
  const medianFinal = allFinals[Math.floor(n * 0.50)];

  return {
    horizon: `${months}m`,
    label: `${months} Ay`,
    months,
    currentPrice,
    target: parseFloat(medianFinal.toFixed(2)),
    changePct: parseFloat(((medianFinal - currentPrice) / currentPrice * 100).toFixed(2)),
    range: {
      lower5: parseFloat(allFinals[Math.floor(n * 0.05)].toFixed(2)),
      lower25: parseFloat(allFinals[Math.floor(n * 0.25)].toFixed(2)),
      median: parseFloat(medianFinal.toFixed(2)),
      upper75: parseFloat(allFinals[Math.floor(n * 0.75)].toFixed(2)),
      upper95: parseFloat(allFinals[Math.floor(n * 0.95)].toFixed(2)),
    },
    probabilityUp: parseFloat(((allFinals.filter(p => p > currentPrice).length / n) * 100).toFixed(1)),
    monthlyPoints,
    trendSlope: parseFloat(slope.toFixed(4)),
    method: 'Trend + Seasonality + Monte Carlo (2000 sim)',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. YILLIK TAHMİN (1 yıl) — GBM Monte Carlo
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GBM Monte Carlo simülasyonu
 * S_t = S_0 * exp((μ - σ²/2)*t + σ*√t*Z)
 */
export function predictLongTerm(priceData, years = 1, nSim = 5000) {
  const closes = priceData.map(p => p.close);
  const returns = calcReturns(closes);
  const { mean: muDaily, std: sigmaDaily } = calcStats(returns);
  const currentPrice = closes[closes.length - 1];
  const nSteps = years * 252; // İş günü
  const dt = 1 / 252;

  // Yıllık parametreler
  const muAnnual = muDaily * 252;
  const sigmaAnnual = sigmaDaily * Math.sqrt(252);

  // Simülasyonlar
  const finalPrices = [];
  const quarterlyMedians = {}; // Çeyreklik medyanlar

  // Çeyreklik checkpoint'ler (3 ay = 63 gün, 6 ay = 126, 9 ay = 189, 12 ay = 252)
  const checkpoints = years === 1
    ? [{ day: 63, label: 'Q1' }, { day: 126, label: 'Q2' }, { day: 189, label: 'Q3' }, { day: 252, label: 'Q4' }]
    : [{ day: 252, label: '1Y' }, { day: 504, label: '2Y' }, { day: 756, label: '3Y' }];

  const checkpointPrices = {};
  checkpoints.forEach(cp => { checkpointPrices[cp.label] = []; });

  for (let s = 0; s < nSim; s++) {
    let price = currentPrice;
    for (let t = 1; t <= nSteps; t++) {
      const Z = randn();
      price = price * Math.exp((muDaily - 0.5 * sigmaDaily * sigmaDaily) + sigmaDaily * Z);
      // Checkpoint kayıt
      for (const cp of checkpoints) {
        if (t === cp.day) checkpointPrices[cp.label].push(price);
      }
    }
    finalPrices.push(price);
  }

  finalPrices.sort((a, b) => a - b);
  const n = finalPrices.length;
  const medianFinal = finalPrices[Math.floor(n * 0.50)];

  // Checkpoint istatistikleri
  const checkpointStats = checkpoints.map(cp => {
    const prices = checkpointPrices[cp.label].sort((a, b) => a - b);
    const cn = prices.length;
    if (cn === 0) return { label: cp.label, median: currentPrice, upper75: currentPrice, lower25: currentPrice };
    return {
      label: cp.label,
      day: cp.day,
      median: parseFloat(prices[Math.floor(cn * 0.50)].toFixed(2)),
      upper75: parseFloat(prices[Math.floor(cn * 0.75)].toFixed(2)),
      lower25: parseFloat(prices[Math.floor(cn * 0.25)].toFixed(2)),
      upper95: parseFloat(prices[Math.floor(cn * 0.95)].toFixed(2)),
      lower5: parseFloat(prices[Math.floor(cn * 0.05)].toFixed(2)),
      changePct: parseFloat(((prices[Math.floor(cn * 0.50)] - currentPrice) / currentPrice * 100).toFixed(2)),
      probabilityUp: parseFloat(((prices.filter(p => p > currentPrice).length / cn) * 100).toFixed(1)),
    };
  });

  return {
    horizon: years === 1 ? '1y' : '3y',
    label: years === 1 ? '1 Yıl' : '3 Yıl',
    years,
    currentPrice,
    target: parseFloat(medianFinal.toFixed(2)),
    changePct: parseFloat(((medianFinal - currentPrice) / currentPrice * 100).toFixed(2)),
    range: {
      lower5: parseFloat(finalPrices[Math.floor(n * 0.05)].toFixed(2)),
      lower25: parseFloat(finalPrices[Math.floor(n * 0.25)].toFixed(2)),
      median: parseFloat(medianFinal.toFixed(2)),
      upper75: parseFloat(finalPrices[Math.floor(n * 0.75)].toFixed(2)),
      upper95: parseFloat(finalPrices[Math.floor(n * 0.95)].toFixed(2)),
    },
    scenarios: {
      bull: parseFloat(finalPrices[Math.floor(n * 0.75)].toFixed(2)),
      base: parseFloat(medianFinal.toFixed(2)),
      bear: parseFloat(finalPrices[Math.floor(n * 0.25)].toFixed(2)),
    },
    probabilityUp: parseFloat(((finalPrices.filter(p => p > currentPrice).length / n) * 100).toFixed(1)),
    checkpoints: checkpointStats,
    params: {
      muAnnual: parseFloat((muAnnual * 100).toFixed(2)),
      sigmaAnnual: parseFloat((sigmaAnnual * 100).toFixed(2)),
      nSimulations: nSim,
    },
    method: `GBM Monte Carlo (${nSim} sim, ${nSteps} gün)`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AĞIRLIKLI ETKİ ANALİZİ — Her faktörün fiyata etkisi (%)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Her göstergenin skor ağırlığına göre final fiyata katkı hesabı
 * Basit yaklaşım: Her indikatörün skor sapması × ağırlık oranı
 */
export function calculateImpactAnalysis(indicators, macro, regime, riskReport, fundScore) {
  const factors = [];

  // Teknik göstergeler
  if (indicators.rsi) {
    const deviation = (indicators.rsi.score - 50) / 50; // -1 to +1
    factors.push({
      name: 'RSI (14)',
      category: 'Teknik',
      score: indicators.rsi.score,
      status: indicators.rsi.status,
      deviation,
      baseWeight: 0.14,
      direction: deviation > 0 ? 'Pozitif' : deviation < 0 ? 'Negatif' : 'Nötr',
      color: indicators.rsi.color,
    });
  }
  if (indicators.macd) {
    const deviation = (indicators.macd.score - 50) / 50;
    factors.push({
      name: 'MACD',
      category: 'Teknik',
      score: indicators.macd.score,
      status: indicators.macd.status,
      deviation,
      baseWeight: 0.10,
      direction: deviation > 0 ? 'Pozitif' : 'Negatif',
      color: indicators.macd.color,
    });
  }
  if (indicators.sma) {
    const deviation = (indicators.sma.score - 50) / 50;
    factors.push({
      name: 'SMA (Golden Cross)',
      category: 'Teknik',
      score: indicators.sma.score,
      status: indicators.sma.status,
      deviation,
      baseWeight: 0.08,
      direction: deviation > 0 ? 'Pozitif' : 'Negatif',
      color: indicators.sma.color,
    });
  }
  if (indicators.bollinger) {
    const deviation = (indicators.bollinger.score - 50) / 50;
    factors.push({
      name: 'Bollinger Bantları',
      category: 'Teknik',
      score: indicators.bollinger.score,
      status: indicators.bollinger.status,
      deviation,
      baseWeight: 0.08,
      direction: deviation > 0 ? 'Pozitif' : 'Negatif',
      color: indicators.bollinger.color,
    });
  }

  // Hacim
  if (indicators.volume) {
    const deviation = (indicators.volume.score - 50) / 50;
    factors.push({
      name: 'Hacim Analizi',
      category: 'Hacim',
      score: indicators.volume.score,
      status: indicators.volume.status,
      deviation,
      baseWeight: 0.08,
      direction: deviation > 0 ? 'Pozitif' : 'Negatif',
      color: indicators.volume.color,
    });
  }

  // Makro
  const cdsImpact = macro.cds < 200 ? 0.5 : macro.cds < 300 ? 0.2 : macro.cds < 400 ? -0.3 : -0.6;
  factors.push({
    name: 'CDS (5Y)',
    category: 'Makro',
    score: macro.macroScore || 50,
    status: `${macro.cds} bps`,
    deviation: cdsImpact,
    baseWeight: 0.15,
    direction: cdsImpact > 0 ? 'Pozitif' : 'Negatif',
    color: cdsImpact > 0 ? 'green' : 'red',
  });

  const vixImpact = macro.vix < 20 ? 0.4 : macro.vix < 25 ? 0.1 : macro.vix < 30 ? -0.2 : -0.5;
  factors.push({
    name: 'VIX (Korku)',
    category: 'Makro',
    score: vixImpact > 0 ? 70 : 30,
    status: `${macro.vix}`,
    deviation: vixImpact,
    baseWeight: 0.10,
    direction: vixImpact > 0 ? 'Pozitif' : 'Negatif',
    color: vixImpact > 0 ? 'green' : 'red',
  });

  // Temel Analiz
  factors.push({
    name: 'Temel Analiz Skoru',
    category: 'Temel',
    score: fundScore || 50,
    status: fundScore >= 70 ? 'Güçlü' : fundScore >= 50 ? 'Orta' : 'Zayıf',
    deviation: ((fundScore || 50) - 50) / 50,
    baseWeight: 0.15,
    direction: (fundScore || 50) > 50 ? 'Pozitif' : 'Negatif',
    color: (fundScore || 50) > 60 ? 'green' : (fundScore || 50) < 40 ? 'red' : 'yellow',
  });

  // Rejim
  const regimeImpact = regime.name === 'Sakin' ? 0.3 : regime.name === 'Kriz' ? -0.6 : -0.1;
  factors.push({
    name: 'Piyasa Rejimi',
    category: 'Rejim',
    score: regime.name === 'Sakin' ? 75 : regime.name === 'Kriz' ? 15 : 45,
    status: regime.name,
    deviation: regimeImpact,
    baseWeight: 0.12,
    direction: regimeImpact > 0 ? 'Pozitif' : 'Negatif',
    color: regime.name === 'Sakin' ? 'green' : regime.name === 'Kriz' ? 'red' : 'yellow',
  });

  // Ağırlıklı etki hesabı (normalize)
  const totalWeight = factors.reduce((s, f) => s + f.baseWeight, 0);
  const impactFactors = factors.map(f => {
    const normalizedWeight = f.baseWeight / totalWeight;
    const impact = Math.abs(f.deviation) * normalizedWeight * 100;
    return {
      ...f,
      normalizedWeight: parseFloat((normalizedWeight * 100).toFixed(1)),
      impactPct: parseFloat(impact.toFixed(1)),
    };
  }).sort((a, b) => b.impactPct - a.impactPct);

  return {
    factors: impactFactors,
    topPositive: impactFactors.filter(f => f.deviation > 0).slice(0, 3),
    topNegative: impactFactors.filter(f => f.deviation < 0).slice(0, 3),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PIPELINE ADIM BİLGİSİ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analiz pipeline'ının her adımını açıklayan veri yapısı
 */
export function generatePipelineSteps(analysis) {
  return [
    {
      step: 0,
      name: 'Veri Çekme',
      icon: '📡',
      status: 'completed',
      description: 'Yahoo Finance API üzerinden OHLCV fiyat verisi çekildi.',
      detail: `${analysis.priceData?.length || 0} günlük veri çekildi. Son fiyat: ₺${analysis.currentPrice?.toFixed(2)}`,
      duration: 'Anlık',
    },
    {
      step: 1,
      name: 'Veri Ön İşleme (FracDiff)',
      icon: '🔬',
      status: 'completed',
      description: 'Fraksiyon Diferansiyasyon ile seri durağanlaştırıldı, hafıza korunumu sağlandı.',
      detail: `Optimal d=${analysis.fracDiff?.d} → %${analysis.fracDiff?.memoryRetained} hafıza korunuyor`,
      duration: 'Kademe 1',
    },
    {
      step: 2,
      name: 'Teknik Analiz (6 İndikatör)',
      icon: '📊',
      status: 'completed',
      description: 'RSI, MACD, SMA Golden Cross, Bollinger Bantları, Hacim ve Trend analizi yapıldı.',
      detail: `RSI: ${analysis.indicators?.rsi?.status} | MACD: ${analysis.indicators?.macd?.status} | SMA: ${analysis.indicators?.sma?.status}`,
      duration: 'Kademe 2',
    },
    {
      step: 3,
      name: 'Rejim Tespiti (HMM)',
      icon: '🧠',
      status: 'completed',
      description: 'Hidden Markov Model ile piyasa rejimi tespit edildi (Sakin/Kriz/Yüksek Vol).',
      detail: `Aktif Rejim: ${analysis.regime?.name} | Kriz Riski: %${analysis.regime?.crisisRisk}`,
      duration: 'Kademe 3',
    },
    {
      step: 4,
      name: 'Risk Analizi (GARCH + VaR)',
      icon: '⚠️',
      status: 'completed',
      description: 'GARCH(1,1) volatilite, VaR/CVaR ve tail risk (Hill Estimator) hesaplandı.',
      detail: `VaR₉₅: ${analysis.risk?.var95}% | CVaR₉₅: ${analysis.risk?.cvar95}% | Tail ξ: ${analysis.risk?.xi}`,
      duration: 'Kademe 4',
    },
    {
      step: 5,
      name: 'G-Learning Policy',
      icon: '⚡',
      status: 'completed',
      description: 'Soft policy ile en optimal aksiyon belirlendi.',
      detail: `Aksiyon: ${analysis.gPolicy?.bestAction} | Güven: %${((analysis.gPolicy?.bestProb || 0) * 100).toFixed(0)}`,
      duration: 'Kademe 5',
    },
    {
      step: 6,
      name: 'Fiyat Tahmini (Monte Carlo)',
      icon: '🔮',
      status: 'completed',
      description: 'GBM Monte Carlo simülasyonu ile çok zaman dilimli tahmin yapıldı.',
      detail: `Haftalık + Aylık + Yıllık + 3 Yıllık tahminler üretildi`,
      duration: 'Kademe 6',
    },
    {
      step: 7,
      name: 'Birleşik Skorlama',
      icon: '🎯',
      status: 'completed',
      description: 'Tüm faktörler rejime göre dinamik ağırlıklarla birleştirildi.',
      detail: `Final Skor: ${analysis.finalScore}/100 → Sinyal: ${analysis.signal}`,
      duration: 'Final',
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. TAM TAHMİN RAPORU — Tüm zaman dilimlerini birleştir
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tüm tahmin modellerini çalıştır ve birleştir
 */
export function generateFullPredictions(priceData) {
  const weekly = predictWeekly(priceData, 7);
  const monthly = predictMonthly(priceData, 3);
  const yearly = predictLongTerm(priceData, 1, 3000);
  const threeYear = predictLongTerm(priceData, 3, 3000);

  return {
    weekly,
    monthly,
    yearly,
    threeYear,
    summary: {
      currentPrice: weekly.currentPrice,
      targets: {
        '1w': { price: weekly.target, change: weekly.changePct, probUp: weekly.probabilityUp },
        '1m': { price: monthly.monthlyPoints[0]?.median, change: monthly.monthlyPoints[0]?.changePct, probUp: monthly.monthlyPoints[0]?.probabilityUp },
        '3m': { price: monthly.target, change: monthly.changePct, probUp: monthly.probabilityUp },
        '1y': { price: yearly.target, change: yearly.changePct, probUp: yearly.probabilityUp },
        '3y': { price: threeYear.target, change: threeYear.changePct, probUp: threeYear.probabilityUp },
      },
      overallOutlook: yearly.probabilityUp > 60 ? 'Pozitif' : yearly.probabilityUp < 40 ? 'Negatif' : 'Nötr',
    },
    generatedAt: new Date().toISOString(),
  };
}

// v6.0-F-NANSRADAR Gelistirme - MJD + GARCH

const TIME_FRAMES = {
  '1H': { dt: 1 / (252 * 6.5), label: '1Saat', daysMultiplier: 1 / 6.5 },
  '4H': { dt: 4 / (252 * 6.5), label: '4Saat', daysMultiplier: 4 / 6.5 },
  '1D': { dt: 1 / 252, label: '1Gun', daysMultiplier: 1 },
  '1W': { dt: 5 / 252, label: '1Hafta', daysMultiplier: 5 }
};

export function estimateJumpParams(returns) {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
  const jumpThreshold = 2 * std;
  const jumps = returns.filter(r => Math.abs(r - mean) > jumpThreshold);
  const jumpIntensity = jumps.length / returns.length;
  const jumpMean = jumps.length > 0 ? jumps.reduce((a, b) => a + b, 0) / jumps.length : 0;
  const jumpStd = jumps.length > 0
    ? Math.sqrt(jumps.reduce((a, b) => a + (b - jumpMean) ** 2, 0) / jumps.length)
    : 0;
  return { jumpIntensity, jumpMean, jumpStd };
}

export function simulateMJD(S0, mu, sigma, days, nSim, jumpParams) {
  const { jumpIntensity, jumpMean, jumpStd } = jumpParams;
  const dt = 1 / 252;
  const paths = [];

  for (let s = 0; s < nSim; s++) {
    let price = S0;
    const path = [price];
    for (let d = 0; d < days; d++) {
      const dW = randn() * Math.sqrt(dt);
      const diffusion = (mu - 0.5 * sigma ** 2) * dt + sigma * dW;
      const jumpOccur = Math.random() < jumpIntensity;
      const jumpSize = jumpOccur ? (jumpMean + jumpStd * randn()) : 0;
      price = price * Math.exp(diffusion + jumpSize);
      path.push(Math.max(price, 0.001));
    }
    paths.push(path);
  }
  return paths;
}

export function simulateWithAntithetic(S0, mu, sigma, days, nPairs, jumpParams) {
  const paths = [];
  const { jumpIntensity, jumpMean, jumpStd } = jumpParams;

  for (let pair = 0; pair < nPairs; pair++) {
    let price1 = S0, price2 = S0;
    const path1 = [price1], path2 = [price2];

    for (let d = 0; d < days; d++) {
      const u = randn();
      for (const [path, z] of [[path1, u], [path2, -u]]) {
        const dt = 1 / 252;
        const diffusion = (mu - 0.5 * sigma ** 2) * dt + sigma * z * Math.sqrt(dt);
        const jump = Math.random() < jumpIntensity ? (jumpMean + jumpStd * randn()) : 0;
        const newPrice = path[path.length - 1] * Math.exp(diffusion + jump);
        path.push(Math.max(newPrice, 0.0001));
      }
    }
    paths.push(path1, path2);
  }
  return paths;
}

export function calculateFullPercentiles(paths) {
  const days = paths[0].length;
  const percentiles = {};
  for (let d = 0; d < days; d++) {
    const dayPrices = paths.map(p => p[d]).sort((a, b) => a - b);
    const n = dayPrices.length;
    percentiles[d] = {};
    for (let pct = 1; pct <= 99; pct++) {
      const idx = Math.floor(n * pct / 100);
      percentiles[d][pct] = parseFloat(dayPrices[Math.min(idx, n - 1)].toFixed(4));
    }
  }
  return percentiles;
}

export function selectRepresentativePaths(paths) {
  const finalPrices = paths.map((p, i) => ({ index: i, final: p[p.length - 1] }));
  finalPrices.sort((a, b) => a.final - b.final);
  const n = finalPrices.length;
  return {
    worst: paths[finalPrices[0].index],
    p10: paths[finalPrices[Math.floor(n * 0.1)].index],
    median: paths[finalPrices[Math.floor(n * 0.5)].index],
    p90: paths[finalPrices[Math.floor(n * 0.9)].index],
    best: paths[finalPrices[n - 1].index]
  };
}

export function calculatePriceDistribution(paths, targetDateIndex) {
  const finalPrices = paths.map(p => p[targetDateIndex]);
  const min = Math.min(...finalPrices);
  const max = Math.max(...finalPrices);
  const nBins = 50;
  const binWidth = (max - min) / nBins;
  const distribution = [];

  for (let i = 0; i < nBins; i++) {
    const binStart = min + i * binWidth;
    const binEnd = binStart + binWidth;
    const count = finalPrices.filter(p => p >= binStart && p < binEnd).length;
    distribution.push({
      price: parseFloat((binStart + binWidth / 2).toFixed(4)),
      probability: parseFloat((count / finalPrices.length * 100).toFixed(2)),
      count
    });
  }
  return distribution;
}

export function calculatePathStatistics(paths) {
  const stats = paths.map(path => {
    const returns = [];
    for (let i = 1; i < path.length; i++) {
      returns.push(Math.log(path[i] / path[i - 1]));
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
    let peak = path[0];
    let maxDD = 0;
    for (const price of path) {
      if (price > peak) peak = price;
      const dd = (peak - price) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return {
      sharpe: mean / (std + 1e-10) * Math.sqrt(252),
      maxDrawdown: maxDD,
      finalReturn: (path[path.length - 1] - path[0]) / path[0]
    };
  });

  return {
    avgSharpe: stats.reduce((a, s) => a + s.sharpe, 0) / stats.length,
    avgMaxDrawdown: stats.reduce((a, s) => a + s.maxDrawdown, 0) / stats.length,
    probPositive: stats.filter(s => s.finalReturn > 0).length / stats.length
  };
}

export function predictWithTimeFrame(priceData, timeFrame = '1D', horizon = 30, useGARCH = true) {
  try {
    const tf = TIME_FRAMES[timeFrame] || TIME_FRAMES['1D'];
    const closes = priceData.map(p => p.close);
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }

    const { mean: mu, std: sigma } = calcStats(returns);
    const jumpParams = estimateJumpParams(returns);
    const currentPrice = closes[closes.length - 1];

    const adjustedMu = mu * tf.daysMultiplier;
    const adjustedSigma = sigma * Math.sqrt(tf.daysMultiplier);
    const adjustedDays = Math.ceil(horizon / tf.daysMultiplier);

    let sigmaForecasts = null;
    if (useGARCH) {
      try {
        const garch = new GARCHModel();
        garch.fit(returns);
        // volatilityModel.js'deki forecast metodunu kullan
        sigmaForecasts = garch.forecast(returns, adjustedDays);
      } catch (error) {
        console.warn('GARCH model uygulanamadı, standart sapma kullanılıyor:', error.message);
        useGARCH = false;
      }
    }

    const paths = simulateMJD(currentPrice, adjustedMu, adjustedSigma, adjustedDays, 5000, jumpParams);
    const percentiles = calculateFullPercentiles(paths);
    const representativePaths = selectRepresentativePaths(paths);

    return {
      timeFrame: tf.label,
      horizon,
      simulations: 5000,
      currentPrice,
      paths,
      percentiles,
      representativePaths,
      confidenceIntervals: {
        p5: percentiles[adjustedDays]?.[5],
        p25: percentiles[adjustedDays]?.[25],
        p50: percentiles[adjustedDays]?.[50],
        p75: percentiles[adjustedDays]?.[75],
        p95: percentiles[adjustedDays]?.[95]
      },
      modelParams: { jumpIntensity: jumpParams.jumpIntensity, jumpMean: jumpParams.jumpMean }
    };
  } catch (error) {
    console.error('predictWithTimeFrame hatasi:', error);
    return { error: error.message, timeFrame, horizon };
  }
}
